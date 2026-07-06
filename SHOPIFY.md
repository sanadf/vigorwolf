# VIGORWOLF — Launch Structure (Custom Site + Shopify)

This guide answers, in plain language, how to launch your brand website and sell
clothing — using **one domain**, free hosting, and Shopify only where it helps.

---

## First, the words you're confused about (30-second version)

| Thing | What it actually is | Your VIGORWOLF setup |
|-------|--------------------|----------------------|
| **GitHub** | Online storage for your website's code (a backup + source). | Your repo holds this project. |
| **Hosting** | The service that puts your website online 24/7. | **Cloudflare Pages** (free). |
| **Domain** | Your address, e.g. `vigorwolf.co`. You buy it once per year. | Buy **one** domain. |
| **Subdomain** | A free "room" inside your domain, e.g. `shop.vigorwolf.co`. **Not a second domain — no extra cost.** | Use for Shopify. |
| **Shopify** | A paid tool that handles products, card checkout, payments, inventory, orders. | Optional — for card payments. |

**Key point:** `vigorwolf.co` and `shop.vigorwolf.co` are the **same one domain**. A
subdomain (`shop.`) is created for free in your DNS settings. **You only ever buy one domain.**

---

## Is my project a normal website or a Shopify theme?

**It is a normal custom-coded website** (static HTML/CSS/JS) with a small Cloudflare
backend (Functions + D1 database). 

It is **NOT** a Shopify Liquid theme. A Shopify theme has folders named
`layout/`, `sections/`, `templates/`, `snippets/`, `assets/`, `config/`. Your repo has
`public/`, `functions/`, `migrations/` instead.

➡️ **Therefore: do NOT use Shopify's "GitHub theme" connection.** That feature is only for
repos that are actual Shopify themes. Yours isn't, and it should stay that way.

---

## You already have TWO ways to sell — pick one (important!)

Your site was built with a **complete built-in store**: cart, checkout, Cash-on-Delivery
orders, a D1 database, an admin dashboard, loyalty points, and coupons. So you have a
choice. Don't run both checkouts at once — it confuses customers.

### Option A — Launch now with your built-in store (simplest, $0 beyond the domain)
- Sells via **Cash on Delivery**. Orders land in your **Admin → Orders**.
- Shipping (Amman 2 JD / other 3 JD), loyalty, and coupons already work.
- **No Shopify, no monthly fee.** Great for a first drop in Jordan.
- ✅ Do nothing extra — just deploy (see README) and connect your domain.

### Option B — Use Shopify for products, card payments & inventory
- Best when you want **online card payments** and automated inventory.
- Your custom site stays as the **brand front-end**; the **"Shop the Drop"** buttons send
  people to your Shopify store at `shop.vigorwolf.co`.
- Shopify has a **monthly cost** (their Basic plan) on top of your domain.
- ✅ This is the "external Shopify links" method you asked for — set up below.

> You can **launch with Option A today and switch to Option B later** without rebuilding —
> it's a single config toggle.

---

## Option B setup — external Shopify links (what you asked for)

### Step 1 — Create your Shopify store
1. Sign up at [shopify.com](https://www.shopify.com), add your products, set prices/inventory.
2. Turn on a payment provider in Shopify (cards / Apple Pay / etc.).
3. Your store gets a temporary address like `vigorwolf.myshopify.com`.

### Step 2 — Point the "Shop" buttons at Shopify (one edit)
Open **`public/assets/js/config.js`** and change the `shopify` block:

```js
shopify: { enabled: true, url: "https://shop.vigorwolf.co" },
```

- Set `enabled: true`.
- Set `url` to your Shopify store (use `https://vigorwolf.myshopify.com` until your
  subdomain is connected, then switch to `https://shop.vigorwolf.co`).

That's it. When enabled, every **Shop / Drop / Cart** button on your site automatically
opens your Shopify store in a new tab. (This is handled in `public/assets/js/ui.js` →
`applyShopify()`. You don't need to touch it.)

### Step 3 — Link a specific product (optional)
To send a button to one Shopify product, use a normal link anywhere in your HTML:

```html
<a class="btn btn--lg" href="https://shop.vigorwolf.co/products/redline-tee" target="_blank" rel="noopener">Shop the Drop</a>
```

Or mark any custom button so the toggle controls it too:

```html
<a class="btn" href="/shop.html" data-shop-cta>Shop Now</a>
```

---

## Where the "Shop Now" buttons already are

You don't need to add them — they exist on:
- **Home hero:** "Shop the Drop" (`public/index.html`)
- **Navbar:** "Shop" (built in `public/assets/js/ui.js`)
- **Drop page & product cards**

With `shopify.enabled: true`, all of these point to Shopify automatically.

---

## Connect ONE domain later (custom site + Shopify subdomain)

Goal:
- `vigorwolf.co` → your custom website (Cloudflare Pages)
- `shop.vigorwolf.co` → your Shopify store

You buy **one** domain. `shop.` is a free subdomain. Steps:

1. **Buy the domain** (Cloudflare Registrar, Namecheap, or GoDaddy) — once a year.
2. **Add it to Cloudflare** and use Cloudflare's nameservers (see README → Connect your domain).
3. **Main site:** Cloudflare Pages → your project → **Custom domains** → add `vigorwolf.co`
   (and `www`). Cloudflare wires the DNS automatically.
4. **Shopify subdomain:** in **Shopify → Settings → Domains → Connect existing domain**,
   enter `shop.vigorwolf.co`. Shopify shows you a **CNAME** target
   (usually `shops.myshopify.com`).
5. In **Cloudflare → DNS**, add a record:
   - Type: **CNAME** · Name: **shop** · Target: **shops.myshopify.com** · Proxy: **DNS only (grey cloud)**.
6. Back in Shopify, click **Verify connection**. SSL turns on automatically.

Done: one domain, two addresses, zero extra domain cost.

---

## Which hosting is easiest for THIS project?

**Cloudflare Pages** — and you're already set up for it.

Why not Netlify or Vercel? Your site has a **backend** (Cloudflare Functions + the D1
database that powers orders, admin, loyalty, coupons). That backend runs **only on
Cloudflare**. Netlify/Vercel would host the pages but **not** your API/database, so admin,
orders, loyalty and coupons would break. Stick with **Cloudflare Pages** (free tier is plenty).

> If you go **full Option B** (Shopify does all selling) and stop using the built-in store,
> then any static host works — but there's no reason to move; Cloudflare is free and already done.

---

## TL;DR launch checklist

- [ ] Deploy the custom site to **Cloudflare Pages** + connect **D1** (README §2).
- [ ] Buy **one** domain, connect `vigorwolf.co` to Pages (README §3).
- [ ] **Launching COD now?** You're done — orders go to Admin → Orders.
- [ ] **Want card payments?** Create Shopify, set `shopify.enabled: true` + `url` in
      `config.js`, and add the `shop.vigorwolf.co` CNAME to Shopify.
- [ ] Never use Shopify's GitHub-theme connect — this repo is not a Liquid theme.
