/* ==========================================================================
   VIGORWOLF — shared UI (header, footer, toasts, reveal, countdown, cards)
   ========================================================================== */
(function () {
  const cfg = window.VW_CONFIG;
  const { Cart, User, Wishlist, money } = window.VW;

  /* --------------------------------------------------------------- icons */
  const I = {
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M6 6 5 3H2"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-8-4.6-8-10a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.4-8 10-8 10z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 3c.3 2.2 1.6 3.7 3.8 3.9v2.5c-1.3.1-2.5-.3-3.8-1v5.6c0 3.4-2.6 5.6-5.7 5.2-2.7-.3-4.5-2.6-4.2-5.3.3-2.4 2.4-4.1 4.9-3.9v2.6c-.4-.1-.8-.1-1.2 0-1 .2-1.7 1.1-1.5 2.2.1 1 1 1.7 2 1.6 1.1-.1 1.7-1 1.7-2.1V3H16z"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 7h12l1 13H5z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
  };
  window.VW.icons = I;

  /* --------------------------------------------------------------- header */
  const path = location.pathname.replace(/index\.html$/, "").replace(/\/$/, "") || "/";
  const active = (href) => {
    const h = href.replace(/index\.html$/, "").replace(/\/$/, "") || "/";
    return path === h ? ' aria-current="page"' : "";
  };
  const links = [
    ["/", "Home"], ["/shop.html", "Shop"], ["/drop.html", "Drop"],
    ["/about.html", "About"], ["/contact.html", "Contact"],
  ];

  function renderHeader() {
    const host = document.getElementById("site-header");
    if (!host) return;
    const acct = User.isLoggedIn() ? "/profile.html" : "/login.html";
    host.className = "site-header";
    host.innerHTML = `
      <div class="container nav">
        <a class="nav__logo" href="/" aria-label="VIGORWOLF home">
          <img src="/assets/media/logo-white.png" alt="VIGORWOLF wolf logo">
          <b>VIGOR<span>WOLF</span></b>
        </a>
        <nav class="nav__links" aria-label="Primary">
          ${links.map(([h, t]) => `<a href="${h}"${active(h)}>${t}</a>`).join("")}
        </nav>
        <div class="nav__right">
          <a class="nav__icon" href="/wishlist.html" aria-label="Wishlist">${I.heart}</a>
          <a class="nav__icon" href="/cart.html" aria-label="Cart">
            ${I.cart}<span class="cart-count" data-cart-count>0</span>
          </a>
          <a class="nav__icon" href="${acct}" aria-label="Account">${I.user}</a>
          <button class="nav__toggle" aria-label="Menu" aria-expanded="false">${I.menu}</button>
        </div>
      </div>`;

    // The mobile menu must live on <body>, NOT inside the header: the header's
    // backdrop-filter creates a containing block that would trap a position:fixed
    // child. Mounting on body lets it cover the full viewport correctly.
    document.getElementById("mobile-menu")?.remove();
    const menu = document.createElement("div");
    menu.className = "mobile-menu";
    menu.id = "mobile-menu";
    menu.innerHTML = `
      ${links.map(([h, t]) => `<a href="${h}">${t}</a>`).join("")}
      <a href="/cart.html">Cart</a>
      <a href="/wishlist.html">Wishlist</a>
      <a href="${acct}">${User.isLoggedIn() ? "Profile" : "Login"}</a>
      <span class="eyebrow" style="margin-top:22px">${cfg.tagline}</span>`;
    document.body.appendChild(menu);

    const toggle = host.querySelector(".nav__toggle");
    const setMenu = (open) => {
      menu.setAttribute("data-open", open ? "1" : "0");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.innerHTML = open ? I.close : I.menu;
      document.body.style.overflow = open ? "hidden" : "";
    };
    toggle.addEventListener("click", () => setMenu(menu.getAttribute("data-open") !== "1"));
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
    updateCartCount();
  }

  /* --------------------------------------------------------------- footer */
  function renderFooter() {
    const host = document.getElementById("site-footer");
    if (!host) return;
    host.className = "site-footer";
    host.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <b><img src="/assets/media/logo-white.png" alt="">VIGOR<span>WOLF</span></b>
            <p>For the disciplined. ${cfg.tagline}</p>
            <div class="flex gap-16 mt-16">
              <a class="nav__icon" href="${cfg.social.instagram}" target="_blank" rel="noopener" aria-label="Instagram">${I.ig}</a>
              <a class="nav__icon" href="${cfg.social.tiktok}" target="_blank" rel="noopener" aria-label="TikTok">${I.tiktok}</a>
              <a class="nav__icon" href="mailto:${cfg.social.email}" aria-label="Email">${I.mail}</a>
            </div>
          </div>
          <div class="footer-col">
            <h4>Navigate</h4>
            <a href="/">Home</a><a href="/shop.html">Shop</a><a href="/drop.html">Drop</a>
            <a href="/about.html">About</a><a href="/contact.html">Contact</a><a href="/cart.html">Cart</a>
          </div>
          <div class="footer-col">
            <h4>Account</h4>
            <a href="/login.html">Login</a><a href="/register.html">Register</a>
            <a href="/orders.html">My Orders</a><a href="/wishlist.html">Wishlist</a>
          </div>
          <div class="footer-col">
            <h4>The Pack Moves First</h4>
            <p class="text-muted" style="font-size:.85rem;margin-bottom:12px">Sign up for drop access &amp; early notifications.</p>
            <form class="signup-form" data-signup data-source="footer">
              <input class="input" type="email" name="email" placeholder="your@email.com" required aria-label="Email">
              <button class="btn btn--sm" type="submit">Join</button>
            </form>
            <p class="signup-msg" data-signup-msg></p>
          </div>
        </div>
        <div class="footer-bottom">
          <p>© ${new Date().getFullYear()} VIGORWOLF. All rights reserved.</p>
          <p>Built for the Relentless · <a class="admin-dot" href="${cfg.adminPath}">·admin</a></p>
        </div>
      </div>`;
    bindSignupForms();
  }

  /* --------------------------------------------------------------- cart count */
  function updateCartCount() {
    const n = Cart.count();
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = n;
      el.setAttribute("data-show", n > 0 ? "1" : "0");
    });
  }
  document.addEventListener("vw:cart-changed", updateCartCount);
  window.VW.updateCartCount = updateCartCount;

  /* --------------------------------------------------------------- toast */
  function toast(message, type = "") {
    let wrap = document.querySelector(".toast-wrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; document.body.appendChild(wrap); }
    const t = document.createElement("div");
    t.className = "toast" + (type === "ok" ? " toast--ok" : "");
    t.innerHTML = `<span>${message}</span>`;
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(() => t.remove(), 300); }, 3200);
  }
  window.VW.toast = toast;

  /* --------------------------------------------------------------- reveal */
  function initReveal() {
    const els = document.querySelectorAll("[data-reveal]");
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
  }
  window.VW.initReveal = initReveal;

  /* --------------------------------------------------------------- clock */
  function initClock() {
    const els = document.querySelectorAll("[data-clock]");
    if (!els.length) return;
    const tick = () => {
      const t = new Date().toLocaleTimeString("en-GB", { hour12: false });
      els.forEach((el) => (el.textContent = t));
    };
    tick(); setInterval(tick, 1000);
  }

  /* --------------------------------------------------------------- countdown */
  function startCountdown(el, iso) {
    if (!el) return;
    const target = new Date(iso).getTime();
    const cells = { d: "Days", h: "Hours", m: "Mins", s: "Secs" };
    el.innerHTML = Object.entries(cells).map(([k, label]) =>
      `<div class="countdown__cell"><b data-cd="${k}">00</b><span>${label}</span></div>`).join("");
    const pad = (n) => String(Math.max(0, n)).padStart(2, "0");
    const upd = () => {
      let diff = Math.floor((target - Date.now()) / 1000);
      if (diff < 0) diff = 0;
      const d = Math.floor(diff / 86400), h = Math.floor((diff % 86400) / 3600),
            m = Math.floor((diff % 3600) / 60), s = diff % 60;
      const set = (k, v) => { const c = el.querySelector(`[data-cd="${k}"]`); if (c) c.textContent = pad(v); };
      set("d", d); set("h", h); set("m", m); set("s", s);
    };
    upd(); setInterval(upd, 1000);
  }
  window.VW.startCountdown = startCountdown;

  /* --------------------------------------------------------------- badges */
  function badgeFor(p) {
    const out = [];
    if (p.status === "sold_out") out.push('<span class="badge badge--sold">Sold Out</span>');
    else if (p.status === "coming_soon") out.push('<span class="badge badge--soon">Coming Soon</span>');
    else if (p.status === "low_stock") out.push('<span class="badge badge--low">Low Stock</span>');
    else if (p.status === "new_drop") out.push('<span class="badge badge--red">New Drop</span>');
    if (p.featured) out.push('<span class="badge badge--feat">Featured</span>');
    if (p.onSale) out.push('<span class="badge badge--red">Sale</span>');
    return out.join("");
  }
  window.VW.badgeFor = badgeFor;

  function priceHTML(p) {
    if (p.onSale) return `<span class="price"><span class="was">${money(p.price)}</span><span class="now">${money(p.salePrice)}</span></span>`;
    return `<span class="price">${money(p.price)}</span>`;
  }
  window.VW.priceHTML = priceHTML;

  /* --------------------------------------------------------------- product card */
  function productCard(p) {
    // Sold out when inventory is empty (unless it's a coming-soon teaser).
    const soldOut = p.status === "sold_out" || (p.inStock === false && p.status !== "coming_soon");
    const buyable = p.status !== "coming_soon" && !soldOut;
    const soldVeil = soldOut ? '<div class="card__soldout-veil">Sold Out</div>' : "";
    const cta = buyable
      ? `<button class="btn btn--sm btn--block" data-quickadd="${p.slug}">Add to Cart</button>`
      : `<a class="btn btn--sm btn--ghost btn--block" href="/product.html?slug=${p.slug}">View</a>`;
    const img1 = p.image || "/assets/media/logo-white.png";
    const img2 = p.image2 || "";
    const hover = img2
      ? `<img class="card__img2" src="${img2}" alt="" loading="lazy">`
      : "";
    return `
      <article class="card${img2 ? " has-hover" : ""}" data-reveal>
        <div class="card__media">
          <div class="card__badges">${badgeFor(p)}</div>
          ${soldVeil}
          <a href="/product.html?slug=${p.slug}" aria-label="${p.name}">
            <img class="card__img1" src="${img1}" alt="${p.name}" loading="lazy">
            ${hover}
          </a>
          <div class="card__quickadd">${cta}</div>
        </div>
        <div class="card__body">
          <span class="card__cat">${p.category}${p.gsm ? " · " + p.gsm : ""}</span>
          <h3 class="card__name"><a href="/product.html?slug=${p.slug}">${p.name}</a></h3>
          <span class="card__meta">${(p.colors || []).join(", ")} · ${(p.availableSizes && p.availableSizes.length ? p.availableSizes : p.sizes || []).join(" ")}</span>
          <div class="card__foot">
            ${priceHTML(p)}
            <a class="link-underline" href="/product.html?slug=${p.slug}">Details</a>
          </div>
        </div>
      </article>`;
  }
  window.VW.productCard = productCard;

  // Quick-add needs product data; pages register a lookup so the card button works.
  let productIndex = {};
  window.VW.setProductIndex = (list) => { list.forEach((p) => (productIndex[p.slug] = p)); };
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-quickadd]");
    if (!btn) return;
    const p = productIndex[btn.getAttribute("data-quickadd")];
    if (!p) return;
    // Pick the first IN-STOCK size so the customer never quick-adds an OOS size.
    const size = (p.availableSizes && p.availableSizes[0]) || (p.sizes && p.sizes[0]) || "OS";
    if (p.inStock === false) { toast("Sold out"); return; }
    Cart.add({
      productId: p.id, slug: p.slug, name: p.name,
      price: p.onSale ? p.salePrice : p.price, image: p.image,
      size, color: (p.colors && p.colors[0]) || "Black", qty: 1,
    });
    toast(`Added — ${p.name} (${size})`, "ok");
  });

  /* --------------------------------------------------------------- signup forms */
  function bindSignupForms() {
    document.querySelectorAll("form[data-signup]").forEach((form) => {
      if (form.dataset.bound) return; form.dataset.bound = "1";
      const msg = form.parentElement.querySelector("[data-signup-msg]") ||
                  form.nextElementSibling;
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = form.email.value.trim();
        const source = form.getAttribute("data-source") || "site";
        const btn = form.querySelector("button");
        btn.setAttribute("data-loading", "1"); btn.disabled = true;
        try {
          const res = await window.API.signup(email, source);
          if (msg) { msg.textContent = res.message; msg.setAttribute("data-type", res.duplicate ? "dupe" : "ok"); }
          if (!res.duplicate) form.reset();
        } catch (err) {
          if (msg) { msg.textContent = err.message; msg.setAttribute("data-type", "err"); }
        } finally { btn.removeAttribute("data-loading"); btn.disabled = false; }
      });
    });
  }
  window.VW.bindSignupForms = bindSignupForms;

  /* --------------------------------------------------------------- shopify hook */
  // When VW_CONFIG.shopify.enabled is true, all internal shop links are
  // redirected to your Shopify store (opens in a new tab). This lets you launch
  // selling through Shopify while keeping this site as the brand front-end,
  // WITHOUT deleting the built-in store. Flip it off to use the built-in shop.
  // See SHOPIFY.md.
  function applyShopify() {
    const sh = cfg.shopify;
    if (!sh || !sh.enabled || !sh.url) return;
    const shopHrefs = ["/shop.html", "/drop.html", "/cart.html"];
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href").split("?")[0];
      if (shopHrefs.includes(href) || a.hasAttribute("data-shop-cta")) {
        a.setAttribute("href", sh.url);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
      }
    });
  }
  window.VW.applyShopify = applyShopify;

  /* --------------------------------------------------------------- boot */
  // Re-render the header whenever auth state changes (login/logout/reconcile).
  document.addEventListener("vw:auth", () => { renderHeader(); applyShopify(); });

  function boot() {
    renderHeader(); renderFooter(); initReveal(); initClock(); bindSignupForms(); applyShopify();
    // Validate the cached session against the server (source of truth). If the
    // cookie is gone/expired, this clears the stale cache and updates the header.
    if (window.VW && window.VW.User) window.VW.User.me().catch(() => {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
