// PATCH  /api/admin/products/:id  -> update any subset of fields
// DELETE /api/admin/products/:id  -> delete product
import { ok, fail, readJson } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";

// Map incoming JSON keys -> DB columns (with value transform).
const FIELD_MAP = {
  name: ["name", (v) => String(v)],
  slug: ["slug", (v) => String(v)],
  price: ["price", (v) => Number(v) || 0],
  salePrice: ["sale_price", (v) => (v === "" || v == null ? null : Number(v))],
  category: ["category", (v) => String(v)],
  description: ["description", (v) => String(v)],
  material: ["material", (v) => String(v)],
  fit: ["fit", (v) => String(v)],
  care: ["care", (v) => String(v)],
  gsm: ["gsm", (v) => String(v)],
  modelInfo: ["model_info", (v) => String(v)],
  colors: ["colors", (v) => JSON.stringify(Array.isArray(v) ? v : [])],
  sizes: ["sizes", (v) => JSON.stringify(Array.isArray(v) ? v : [])],
  stock: ["stock", (v) => parseInt(v, 10) || 0],
  status: ["status", (v) => String(v)],
  dropName: ["drop_name", (v) => String(v)],
  featured: ["featured", (v) => (v ? 1 : 0)],
  hidden: ["hidden", (v) => (v ? 1 : 0)],
  image: ["image_url", (v) => String(v)],
  gallery: ["gallery", (v) => JSON.stringify(Array.isArray(v) ? v : [])],
};

export async function onRequestPatch(context) {
  const { env, params } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);

  const b = await readJson(context.request);
  const sets = [];
  const binds = [];
  for (const [key, val] of Object.entries(b)) {
    const map = FIELD_MAP[key];
    if (!map) continue;
    sets.push(`${map[0]} = ?`);
    binds.push(map[1](val));
  }
  if (!sets.length) return fail("No valid fields to update.");
  binds.push(params.id);

  try {
    await env.DB.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...binds).run();
    return ok({ id: params.id });
  } catch (err) {
    return fail("Failed to update product: " + err.message, 500);
  }
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);
  try {
    await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(params.id).run();
    return ok({ deleted: params.id });
  } catch (err) {
    return fail("Failed to delete product: " + err.message, 500);
  }
}
