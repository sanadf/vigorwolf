// GET /api/products            -> all visible products
// GET /api/products?slug=xxx    -> single product by slug (with related)
import { json, fail, parseJsonField } from "../_lib/http.js";

// Per-size stock helpers. The four apparel sizes each have their own column;
// any other size (e.g. "OS") falls back to the legacy total `stock`.
export const SIZE_COLUMN = { S: "stock_s", M: "stock_m", L: "stock_l", XL: "stock_xl" };
export function stockForSize(row, size) {
  const col = SIZE_COLUMN[String(size || "").toUpperCase()];
  if (col) return Math.max(0, row[col] ?? 0);
  return Math.max(0, row.stock ?? 0); // non-standard size -> legacy stock
}

export function serializeProduct(row) {
  const gallery = parseJsonField(row.gallery, []);
  const image1 = row.image_1 || row.image_url || gallery[0] || "";
  const image2 = row.image_2 || gallery[1] || "";
  const offered = parseJsonField(row.sizes, []);
  const sizeStock = {
    S: Math.max(0, row.stock_s ?? 0), M: Math.max(0, row.stock_m ?? 0),
    L: Math.max(0, row.stock_l ?? 0), XL: Math.max(0, row.stock_xl ?? 0),
  };
  const sizeTotal = sizeStock.S + sizeStock.M + sizeStock.L + sizeStock.XL;
  // A size is available if it's offered AND has stock (>0). Non-S/M/L/XL sizes
  // use the legacy total stock.
  const availableSizes = offered.filter((s) => stockForSize(row, s) > 0);
  const totalStock = sizeTotal > 0 ? sizeTotal : Math.max(0, row.stock ?? 0);

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
    sizes: offered,
    availableSizes,
    sizeStock,
    stock: totalStock,
    inStock: totalStock > 0,
    status: row.status,
    dropName: row.drop_name,
    featured: !!row.featured,
    hidden: !!row.hidden,
    image: image1,
    image2,
    images: [image1, image2].filter(Boolean),
    gallery,
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
    // Structured, secret-free log so product-load failures are diagnosable in
    // Cloudflare logs (e.g. from a Googlebot fetch) without leaking data.
    console.error(JSON.stringify({
      at: "api/products",
      pathname: url.pathname,
      slug: slug || null,
      userAgent: request.headers.get("user-agent") || "",
      dbBound: !!(env.DB && typeof env.DB.prepare === "function"),
      status: 500,
      error: String(err && err.message || err),
    }));
    return fail("Failed to load products: " + err.message, 500);
  }
}
