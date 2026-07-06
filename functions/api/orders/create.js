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
  const userEmail = String(body.userEmail || "").toLowerCase();
  const loggedIn = isEmail(userEmail);

  // --- validation ---
  if (!c.name || !String(c.name).trim()) return fail("Full name is required.");
  if (!c.phone || !String(c.phone).trim()) return fail("Phone number is required.");
  if (!isEmail(c.email)) return fail("A valid email is required.");
  if (!c.city || !String(c.city).trim()) return fail("City is required.");
  if (!c.address || !String(c.address).trim()) return fail("Full address is required.");
  if (items.length === 0) return fail("Your cart is empty.");

  try {
    // 1) Resolve items -> trusted subtotal
    const resolved = [];
    for (const it of items) {
      const p = await env.DB.prepare(
        "SELECT id, name, price, sale_price, image_url FROM products WHERE id = ? AND hidden = 0"
      ).bind(it.productId).first();
      if (!p) continue;
      const unit = p.sale_price != null && p.sale_price > 0 && p.sale_price < p.price ? p.sale_price : p.price;
      const qty = Math.max(1, parseInt(it.qty, 10) || 1);
      resolved.push({ productId: p.id, name: p.name, price: unit, size: it.size || "", color: it.color || "", qty, image: p.image_url });
    }
    if (resolved.length === 0) return fail("No valid items in cart.");
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

    // 4) Final total
    const total = round2(afterCoupon - pointsDiscount);
    // 5) Points earned (from subtotal before discounts, logged-in only)
    const pointsEarned = loggedIn ? earnedPointsFor(subtotal) : 0;
    const paymentMethod = body.paymentMethod || "Cash on Delivery";
    const number = orderNumber();

    // Persist order
    const res = await env.DB.prepare(
      `INSERT INTO orders (order_number, customer_name, phone, email, city, address, notes,
        payment_method, status, subtotal, total, user_email,
        coupon_code, coupon_discount_jd, points_redeemed, points_discount_jd, points_earned, total_after_discounts)
       VALUES (?,?,?,?,?,?,?,?,'Pending',?,?,?,?,?,?,?,?,?)`
    ).bind(
      number, String(c.name).trim(), String(c.phone).trim(), String(c.email).trim().toLowerCase(),
      String(c.city).trim(), String(c.address).trim(), String(c.notes || "").trim(),
      paymentMethod, subtotal, total, userEmail,
      couponCode, couponDiscount, redeemPoints, pointsDiscount, pointsEarned, total
    ).run();
    const orderId = res.meta.last_row_id;

    for (const i of resolved) {
      await env.DB.prepare(
        `INSERT INTO order_items (order_id, product_id, name, price, size, color, qty, image_url)
         VALUES (?,?,?,?,?,?,?,?)`
      ).bind(orderId, i.productId, i.name, i.price, i.size, i.color, i.qty, i.image).run();
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

    // Email notification (optional / non-blocking)
    const lines = resolved.map(i => `- ${i.name} [${i.size}/${i.color}] x${i.qty} = ${(i.price * i.qty).toFixed(2)} JD`).join("\n");
    const discountLines =
      (couponDiscount ? `Coupon (${couponCode}): -${couponDiscount.toFixed(2)} JD\n` : "") +
      (pointsDiscount ? `Points (${redeemPoints}): -${pointsDiscount.toFixed(2)} JD\n` : "");
    context.waitUntil(sendNotification(env, {
      subject: `VIGORWOLF — new order ${number} (${total.toFixed(2)} JD)`,
      text:
`New order received.

Order: ${number}
Name: ${c.name}
Phone: ${c.phone}
Email: ${c.email}
City: ${c.city}
Address: ${c.address}
Notes: ${c.notes || "-"}
Payment: ${paymentMethod}

Items:
${lines}

Subtotal: ${subtotal.toFixed(2)} JD
${discountLines}Total: ${total.toFixed(2)} JD
${loggedIn ? `Points earned: ${pointsEarned} · New balance: ${newBalance}` : "Guest order (no points)"}`,
      replyTo: String(c.email).trim(),
    }));

    return ok({
      orderNumber: number,
      order: {
        orderNumber: number, customerName: c.name, phone: c.phone, email: c.email,
        city: c.city, address: c.address, notes: c.notes || "", paymentMethod,
        status: "Pending", subtotal, couponCode, couponDiscount,
        pointsRedeemed: redeemPoints, pointsDiscount, pointsEarned, total, items: resolved,
      },
      loyalty: loggedIn ? { pointsEarned, pointsRedeemed: redeemPoints, newBalance } : null,
    });
  } catch (err) {
    return fail("Could not place order: " + err.message, 500);
  }
}
