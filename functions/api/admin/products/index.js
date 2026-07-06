// GET  /api/admin/products  -> all products (including hidden)
// POST /api/admin/products  -> create product
import { json, ok, fail, readJson } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
import { serializeProduct } from "../../products/index.js";

function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
const arr = (v) => JSON.stringify(Array.isArray(v) ? v : []);
const numOrNull = (v) => (v === "" || v == null ? null : Number(v));

export async function onRequestGet(context) {
  const { env } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM products ORDER BY created_at DESC"
    ).all();
    return json({ ok: true, products: (results || []).map(serializeProduct) });
  } catch (err) {
    return fail("Failed to load products: " + err.message, 500);
  }
}

export async function onRequestPost(context) {
  const { env } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);

  const b = await readJson(context.request);
  if (!b.name || !String(b.name).trim()) return fail("Product name is required.");
  const slug = (b.slug && slugify(b.slug)) || slugify(b.name) + "-" + Math.floor(Math.random() * 1000);

  try {
    const res = await env.DB.prepare(
      `INSERT INTO products
       (name, slug, price, sale_price, category, description, material, fit, care, gsm,
        model_info, colors, sizes, stock, status, drop_name, featured, hidden, image_url, gallery)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      String(b.name).trim(), slug, Number(b.price) || 0, numOrNull(b.salePrice),
      b.category || "T-Shirts", b.description || "", b.material || "", b.fit || "",
      b.care || "", b.gsm || "", b.modelInfo || "", arr(b.colors), arr(b.sizes),
      parseInt(b.stock, 10) || 0, b.status || "active", b.dropName || "Drop One",
      b.featured ? 1 : 0, b.hidden ? 1 : 0, b.image || "", arr(b.gallery)
    ).run();
    return ok({ id: res.meta.last_row_id, slug });
  } catch (err) {
    return fail("Failed to create product: " + err.message, 500);
  }
}
