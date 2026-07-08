// POST /api/orders/create
// Body: { customer:{name,phone,email,city,address,notes}, paymentMethod,
//         items:[{productId,size,color,qty}], userEmail?, couponCode?, redeemPoints? }
// Discount order: subtotal -> coupon -> loyalty points -> total.
// Everything is recomputed server-side; the client total is never trusted.
import { ok, fail, readJson, isEmail } from "../_lib/http.js";
import { sendNotification } from "../_lib/email.js";
import {
  validateCoupon, getBalance, ensureUser, pointsToJd, earnedPointsFor, round2,
} from "../_lib/loyalty.js";
import { resolveShipping } from "../_lib/shipping.js";
import { normalizePhone, isValidPhone } from "../_lib/phone.js";
import { SIZE_COLUMN } from "../products/index.js";
import { requireUser } from "../_lib/auth.js";

function orderNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `VW-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function onRequestPost(context) {
  const { env } = context;
  const body = await readJson(context.request);
  const c = body.customer || {};
  const items = Array.isArray(body.items) ? body.items : [];
  // Loyalty is tied to the AUTHENTICATED customer (session cookie), never a
  // client-supplied email — so points can't be credited to someone else.
  const session = await requireUser(context);
  const userEmail = session?.email ? String(session.email).toLowerCase() : "";
  const loggedIn = isEmail(userEmail);

  // --- validation ---
  if (!c.name || !String(c.name).trim()) return fail("Full name is required.");
  if (!c.phone || !String(c.phone).trim()) return fail("Phone number is required.");
  const phone = normalizePhone(c.phone, "JO");
  if (!isValidPhone(phone)) return fail("Enter a valid phone number in international format, e.g. +962791234567.");
  if (!isEmail(c.email)) return fail("A valid email is required.");
  if (!c.address || !String(c.address).trim()) return fail("Full address is required.");
  if (items.length === 0) return fail("Your cart is empty.");

  // Jordan-only delivery. Governorate must be an approved value; fee is computed
  // server-side and cannot be manipulated by the browser.
  const ship = resolveShipping(c.city);
  if (!ship.valid) return fail("Delivery is currently available inside Jordan only.");
  const governorate = ship.value; // canonical governorate stored on the order

  try {
    // 1) Resolve items -> trusted subtotal (+ pull per-size stock for validation)
    const resolved = [];
    for (const it of items) {
      const p = await env.DB.prepare(
        "SELECT id, name, price, sale_price, image_url, image_1, stock, stock_s, stock_m, stock_l, stock_xl FROM products WHERE id = ? AND hidden = 0"
      ).bind(it.productId).first();
      if (!p) continue;
      const unit = p.sale_price != null && p.sale_price > 0 && p.sale_price < p.price ? p.sale_price : p.price;
      const qty = Math.max(1, parseInt(it.qty, 10) || 1);
      resolved.push({
        productId: p.id, name: p.name, price: unit, size: it.size || "",
        color: it.color || "", qty, image: p.image_1 || p.image_url, row: p,
      });
    }
    if (resolved.length === 0) return fail("No valid items in cart.");

    // 1b) Stock validation (server-side, per product + size). Never oversell.
    const colFor = (size) => SIZE_COLUMN[String(size || "").toUpperCase()] || null; // null => legacy total
    const needed = new Map(); // key: productId|column -> total qty
    for (const i of resolved) {
      const key = i.productId + "|" + (colFor(i.size) || "stock");
      needed.set(key, (needed.get(key) || 0) + i.qty);
    }
    for (const i of resolved) {
      const col = colFor(i.size);
      const available = col ? (i.row[col] ?? 0) : (i.row.stock ?? 0);
      const key = i.productId + "|" + (col || "stock");
      if (needed.get(key) > available) {
        return fail(`Sorry — "${i.name}"${i.size ? ` in size ${i.size}` : ""} is out of stock. Please adjust your cart.`, 409);
      }
    }

    const subtotal = round2(resolved.reduce((s, i) => s + i.price * i.qty, 0));

    // 2) Coupon discount (applied first)
    let couponCode = "", couponDiscount = 0, couponRow = null;
    if (body.couponCode && String(body.couponCode).trim()) {
      const cv = await validateCoupon(env, body.couponCode, subtotal);
      if (!cv.valid) return fail(cv.message || "Invalid coupon.");
      couponCode = cv.coupon.code; couponDiscount = cv.discount; couponRow = cv.coupon;
    }
    const afterCoupon = round2(subtotal - couponDiscount);

    // 3) Loyalty points (logged-in only), applied second
    let redeemPoints = 0, pointsDiscount = 0, balance = 0;
    if (loggedIn) {
      balance = (await getBalance(env, userEmail)).balance;
      const requested = Math.max(0, parseInt(body.redeemPoints, 10) || 0);
      const maxByTotal = Math.floor(afterCoupon * 100); // points that would zero the remaining total
      redeemPoints = Math.min(requested, balance, maxByTotal);
      pointsDiscount = round2(pointsToJd(redeemPoints));
    }

    // 4) Shipping (added after discounts) + final total
    const shipping = ship.fee;
    const total = round2(afterCoupon - pointsDiscount + shipping);
    // 5) Points earned (from subtotal before discounts, logged-in only)
    const pointsEarned = loggedIn ? earnedPointsFor(subtotal) : 0;
    const paymentMethod = body.paymentMethod || "Cash on Delivery";
    const number = orderNumber();

    // Persist order
    const res = await env.DB.prepare(
      `INSERT INTO orders (order_number, customer_name, phone, email, city, address, notes,
        payment_method, status, subtotal, total, user_email,
        coupon_code, coupon_discount_jd, points_redeemed, points_discount_jd, points_earned, shipping_jd, total_after_discounts)
       VALUES (?,?,?,?,?,?,?,?,'Pending',?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      number, String(c.name).trim(), phone, String(c.email).trim().toLowerCase(),
      governorate, String(c.address).trim(), String(c.notes || "").trim(),
      paymentMethod, subtotal, total, userEmail,
      couponCode, couponDiscount, redeemPoints, pointsDiscount, pointsEarned, shipping, total
    ).run();
    const orderId = res.meta.last_row_id;

    for (const i of resolved) {
      await env.DB.prepare(
        `INSERT INTO order_items (order_id, product_id, name, price, size, color, qty, image_url)
         VALUES (?,?,?,?,?,?,?,?)`
      ).bind(orderId, i.productId, i.name, i.price, i.size, i.color, i.qty, i.image).run();
    }

    // Reduce stock for the exact product + size. The `>= ?` guard makes it
    // impossible to go negative even under concurrent orders. Column names come
    // from SIZE_COLUMN (fixed values), never from user input.
    for (const i of resolved) {
      const col = colFor(i.size);
      const r = col
        ? await env.DB.prepare(
            `UPDATE products SET ${col} = ${col} - ?, stock = stock - ? WHERE id = ? AND ${col} >= ?`
          ).bind(i.qty, i.qty, i.productId, i.qty).run()
        : await env.DB.prepare(
            "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?"
          ).bind(i.qty, i.productId, i.qty).run();
      if (!r.meta.changes) {
        console.error(`[order ${number}] stock decrement had no effect (product ${i.productId}, size ${i.size}) — possible race.`);
      }
    }

    // Coupon usage
    if (couponRow) {
      await env.DB.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?").bind(couponRow.id).run();
    }

    // Loyalty ledger + balance update
    let newBalance = balance;
    if (loggedIn) {
      const userId = await ensureUser(env, userEmail, c.name);
      if (redeemPoints > 0) {
        await env.DB.prepare(
          "INSERT INTO loyalty_transactions (user_id, order_id, type, points, jd_value, note) VALUES (?,?,?,?,?,?)"
        ).bind(userId, orderId, "redeemed", -redeemPoints, pointsDiscount, `Redeemed on ${number}`).run();
      }
      if (pointsEarned > 0) {
        await env.DB.prepare(
          "INSERT INTO loyalty_transactions (user_id, order_id, type, points, jd_value, note) VALUES (?,?,?,?,?,?)"
        ).bind(userId, orderId, "earned", pointsEarned, pointsToJd(pointsEarned), `Earned on ${number}`).run();
      }
      newBalance = balance - redeemPoints + pointsEarned;
      await env.DB.prepare("UPDATE users SET points_balance = ?, name = ? WHERE id = ?")
        .bind(newBalance, c.name, userId).run();
    }

    // ----- Email notification -------------------------------------------------
    // The order is already saved above. Email is sent AFTER saving and must NEVER
    // fail the order: any error is caught and logged, checkout still succeeds.
    const createdAt = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
    const itemLines = resolved.map((i) => {
      const opt = [i.size, i.color].filter(Boolean).join(" / ");
      return `- ${i.name}${opt ? ` — ${opt}` : ""} — x${i.qty} — ${(i.price * i.qty).toFixed(2)} JD`;
    }).join("\n");
    const totalsLines = [
      `Subtotal:          ${subtotal.toFixed(2)} JD`,
      couponDiscount ? `Coupon (${couponCode}):    -${couponDiscount.toFixed(2)} JD` : null,
      pointsDiscount ? `Points (${redeemPoints}):       -${pointsDiscount.toFixed(2)} JD` : null,
      `Delivery (${governorate}): ${shipping.toFixed(2)} JD`,
      `TOTAL:             ${total.toFixed(2)} JD`,
    ].filter(Boolean).join("\n");

    const emailText =
`NEW ORDER — VIGORWOLF

Order:    ${number}
Date:     ${createdAt}
Payment:  ${paymentMethod}
Status:   Pending

CUSTOMER
Name:     ${c.name}
Phone:    ${phone}
Email:    ${c.email}

DELIVERY (Jordan only)
Governorate: ${governorate}
Address:     ${c.address}
Notes:       ${c.notes || "-"}

ITEMS
${itemLines}

TOTALS
${totalsLines}
${loggedIn ? `\nLoyalty: earned ${pointsEarned} pts · new balance ${newBalance}` : ""}`;

    let emailStatus = "skipped";
    try {
      const r = await sendNotification(env, {
        subject: `VIGORWOLF — New COD order ${number} (${total.toFixed(2)} JD)`,
        text: emailText,
        replyTo: String(c.email).trim(),
      });
      emailStatus = r.sent ? `sent:${r.provider}` : `failed:${r.provider || r.error || "not configured"}`;
    } catch (err) {
      emailStatus = "failed:" + String(err.message || err).slice(0, 140);
      console.error("[order] email notification threw:", err);
    }
    // Record the result on the order (defensive: column may not exist on an old DB).
    try {
      await env.DB.prepare("UPDATE orders SET email_status = ? WHERE id = ?").bind(emailStatus, orderId).run();
    } catch (e) {
      console.warn("[order] could not store email_status (run migration 0005?):", String(e.message || e));
    }

    return ok({
      orderNumber: number,
      order: {
        orderNumber: number, customerName: c.name, phone, email: c.email,
        city: governorate, address: c.address, notes: c.notes || "", paymentMethod,
        status: "Pending", subtotal, couponCode, couponDiscount,
        pointsRedeemed: redeemPoints, pointsDiscount, pointsEarned, shipping, total, items: resolved,
      },
      loyalty: loggedIn ? { pointsEarned, pointsRedeemed: redeemPoints, newBalance } : null,
    });
  } catch (err) {
    return fail("Could not place order: " + err.message, 500);
  }
}
