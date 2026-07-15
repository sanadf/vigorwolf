// GET /product?slug=… — serves the static product page but server-injects
// Product structured data (JSON-LD) + Open Graph tags into <head> so Google can
// show product rich results (image, price, availability) and shared links show
// the product image/branding. The client script still renders the visible page.
//
// Note: /product.html 308-redirects to the clean /product URL on Pages, so this
// function (route /product) is what crawlers ultimately hit. Defensive: on a
// missing/unknown slug, D1 error, or anything else, it returns the untouched
// static page — the product route can never become an error page.
import { serializeProduct } from "./api/products/index.js";

const SITE = "https://vigorwolf.co";
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const abs = (u) => (!u ? "" : /^https?:\/\//.test(u) ? u : SITE + (u.startsWith("/") ? u : "/" + u));

export async function onRequestGet(context) {
  const { env, request, next } = context;
  const response = await next();

  try {
    const ct = response.headers.get("content-type") || "";
    if (!ct.includes("text/html") || !env.DB || typeof env.DB.prepare !== "function") return response;

    const slug = new URL(request.url).searchParams.get("slug");
    if (!slug) return response;

    const row = await env.DB.prepare("SELECT * FROM products WHERE slug = ? AND hidden = 0").bind(slug).first();
    if (!row) return response;
    const p = serializeProduct(row);

    const price = p.onSale && p.salePrice ? p.salePrice : p.price;
    const images = (p.images && p.images.length ? p.images : [p.image]).filter(Boolean).map(abs);
    const url = `${SITE}/product?slug=${encodeURIComponent(p.slug)}`;
    const title = `${p.name} — VIGORWOLF`;
    const desc = (p.description || `${p.name} — VIGORWOLF streetwear.`).slice(0, 300);

    const ld = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.name,
      image: images,
      description: desc,
      sku: p.slug,
      category: p.category,
      brand: { "@type": "Brand", name: "VIGORWOLF" },
      offers: {
        "@type": "Offer",
        url,
        priceCurrency: "JOD",
        price: Number(price).toFixed(2),
        availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@type": "Organization", name: "VIGORWOLF" },
      },
    };

    const head = `
  <link rel="canonical" href="${esc(url)}">
  <meta name="description" content="${esc(desc)}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="VIGORWOLF">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(images[0] || SITE + "/assets/media/hero.jpg")}">
  <meta property="product:price:amount" content="${esc(Number(price).toFixed(2))}">
  <meta property="product:price:currency" content="JOD">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${esc(images[0] || SITE + "/assets/media/hero.jpg")}">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>`;

    return new HTMLRewriter()
      .on("title", { element(el) { el.setInnerContent(title); } })
      .on("head", { element(el) { el.append(head, { html: true }); } })
      .transform(response);
  } catch (err) {
    console.error(JSON.stringify({
      at: "product-ssr", pathname: new URL(context.request.url).pathname,
      error: String(err && err.message || err),
    }));
    return response;
  }
}
