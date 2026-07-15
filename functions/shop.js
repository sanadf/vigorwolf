// GET /shop — serves the static shop.html but server-renders the product list
// into it so crawlers (Googlebot) and no-JS visitors get real, indexable
// product content instead of an empty JS-dependent grid. The client script
// still enhances the page into interactive cards on load.
//
// This is defensive by design: if D1 is unavailable or anything throws, it
// returns the untouched static page (still HTTP 200 with title/description/H1/
// canonical/collection copy), so /shop can never become an error page.
import { serializeProduct } from "./api/products/index.js";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function cardHtml(p) {
  const href = `/product.html?slug=${encodeURIComponent(p.slug)}`;
  const price = p.onSale && p.salePrice ? p.salePrice : p.price;
  const img = p.image || "/assets/media/hero.jpg";
  // data-product marks this as server-rendered so the client keeps it if the
  // live fetch ever fails. The client replaces this markup on success.
  return `<article class="card reveal" data-product>
    <a href="${esc(href)}" aria-label="${esc(p.name)}">
      <img class="card__img" src="${esc(img)}" alt="${esc(p.name)}" loading="lazy" width="600" height="750">
    </a>
    <div class="card__body">
      <h3 class="card__name"><a href="${esc(href)}">${esc(p.name)}</a></h3>
      <p class="card__price">${esc(price)} JD</p>
      <a class="link-underline" href="${esc(href)}">Details</a>
    </div>
  </article>`;
}

export async function onRequestGet(context) {
  const { env, next } = context;
  // Always start from the real static asset.
  const response = await next();

  try {
    const ct = response.headers.get("content-type") || "";
    if (!ct.includes("text/html") || !env.DB || typeof env.DB.prepare !== "function") {
      return response;
    }

    const { results } = await env.DB.prepare(
      "SELECT * FROM products WHERE hidden = 0 ORDER BY featured DESC, created_at DESC"
    ).all();
    const products = (results || []).map(serializeProduct);
    if (!products.length) return response;

    const html = products.map(cardHtml).join("\n");

    return new HTMLRewriter()
      .on("[data-grid]", {
        element(el) {
          // Replace the "Loading…" placeholder with real product markup.
          el.setInnerContent(html, { html: true });
        },
      })
      .transform(response);
  } catch (err) {
    console.error(JSON.stringify({
      at: "shop-ssr", pathname: new URL(context.request.url).pathname,
      dbBound: !!(env.DB && typeof env.DB.prepare === "function"),
      error: String(err && err.message || err),
    }));
    // Never break the page — return the plain static asset.
    return response;
  }
}
