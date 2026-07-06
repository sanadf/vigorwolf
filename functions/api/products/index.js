// GET /api/products            -> all visible products
// GET /api/products?slug=xxx    -> single product by slug (with related)
import { json, fail, parseJsonField } from "../_lib/http.js";

export function serializeProduct(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: row.price,
    salePrice: row.sale_price,
    onSale: row.sale_price != null && row.sale_price > 0 && row.sale_price < row.price,
    category: row.category,
    description: row.description,
    material: row.material,
    fit: row.fit,
    care: row.care,
    gsm: row.gsm,
    modelInfo: row.model_info,
    colors: parseJsonField(row.colors, []),
    sizes: parseJsonField(row.sizes, []),
    stock: row.stock,
    status: row.status,
    dropName: row.drop_name,
    featured: !!row.featured,
    hidden: !!row.hidden,
    image: row.image_url,
    gallery: parseJsonField(row.gallery, []),
    createdAt: row.created_at,
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  try {
    if (slug) {
      const row = await env.DB.prepare(
        "SELECT * FROM products WHERE slug = ? AND hidden = 0"
      ).bind(slug).first();
      if (!row) return fail("Product not found", 404);

      const product = serializeProduct(row);
      const related = await env.DB.prepare(
        "SELECT * FROM products WHERE category = ? AND slug != ? AND hidden = 0 LIMIT 4"
      ).bind(product.category, slug).all();

      return json({
        ok: true,
        product,
        related: (related.results || []).map(serializeProduct),
      });
    }

    const { results } = await env.DB.prepare(
      "SELECT * FROM products WHERE hidden = 0 ORDER BY featured DESC, created_at DESC"
    ).all();
    return json({ ok: true, products: (results || []).map(serializeProduct) });
  } catch (err) {
    return fail("Failed to load products: " + err.message, 500);
  }
}
