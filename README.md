# VIGORWOLF — Streetwear Store (Cloudflare Full-Stack)

Premium dark streetwear / gymwear storefront with a **real backend** — built to deploy on
**Cloudflare Pages + Functions + D1** so you only ever pay for a domain. Hosting stays free.

- **Frontend:** static HTML / CSS / vanilla JS (no build step) in `public/`
- **Backend API:** Cloudflare Pages Functions in `functions/api/`
- **Database:** Cloudflare **D1** (SQLite) — orders, products, drops, signups, contact, admin
- **Auth:** real backend admin login (PBKDF2-hashed password + signed session cookie)
- **Email:** optional Resend or Web3Forms notifications (configure by API key)
- **Cart:** browser `localStorage` (pre-checkout only) — everything else persists in D1
- **Loyalty:** server-side points (100 pts per 10 JD spent · 100 pts = 1 JD off) tied to the customer's email
- **Coupons:** percentage or fixed discounts, min-order / expiry / usage limits, managed in admin

`Culture. Tribe. Lifestyle.` · Built for the Relentless.

> **Upgrading an existing database** (created before loyalty/coupons existed)? Run
> `npm run db:upgrade:local` (local) or `npm run db:upgrade:remote` (production) once —
> migration `0003` adds the new tables/columns without touching your data. A fresh
> `npm run db:remote` already includes everything.

---

## Table of contents
1. [Project structure](#project-structure)
2. [Run it locally](#1-run-it-locally)
3. [Deploy to Cloudflare Pages](#2-deploy-to-cloudflare-pages)
4. [Connect your domain](#3-connect-your-domain)
5. [Turn on order emails](#4-turn-on-order-emails-optional)
6. [Where to change things](#where-to-change-things) (admin login, products, colors, logo, drop date)
7. [Buy a domain + keep hosting free](#buy-a-domain--keep-hosting-free)

---

## Project structure

```
vigorwolf/
├── public/                       # ← the website (this is what Cloudflare serves)
│   ├── index.html                # Home
│   ├── shop.html                 # Shop (search, filters, sort)
│   ├── product.html              # Product details (?slug=...)
│   ├── drop.html                 # Drop / launch page + countdown
│   ├── cart.html                 # Cart (localStorage)
│   ├── checkout.html             # Checkout → creates order in D1
│   ├── order-confirmation.html   # Order confirmation (?order=...)
│   ├── login.html / register.html/ profile.html / orders.html / wishlist.html
│   ├── about.html / contact.html
│   ├── 404.html
│   ├── admin/                    # Admin area (reached at /admin)
│   │   ├── index.html            # Admin login
│   │   ├── dashboard.html        # Overview cards + latest orders
│   │   ├── products.html         # Add / edit / delete / hide / flag products
│   │   ├── orders.html           # View / search / filter / change status
│   │   ├── drops.html            # Create / edit drops
│   │   └── signups.html          # Email signups + CSV export
│   └── assets/
│       ├── css/styles.css        # ← all styling + brand colors
│       ├── js/config.js          # ← brand config (currency, socials, fallback drop date)
│       ├── js/{api,store,ui,admin}.js
│       └── media/                # logo + product images
├── functions/                    # ← the backend API (Cloudflare Pages Functions)
│   └── api/
│       ├── _lib/                 # shared: http, auth (PBKDF2 + sessions), email
│       ├── products/  drops/  orders/  signups.js  contact.js
│       └── admin/                # login, logout, me, stats, orders, products, drops, signups
├── migrations/
│   ├── 0001_init.sql             # ← tables + seed (3 products, Drop One, admin user)
│   └── 0002_reset.sql            # drops all tables (for a clean reseed)
├── wrangler.toml                 # ← D1 binding + non-secret vars
├── package.json                  # npm scripts
└── .dev.vars.example             # copy to .dev.vars for local secrets
```

---

## 1) Run it locally

**Requirements:** [Node.js](https://nodejs.org) 18+.

```bash
# 1. install dev tooling (Wrangler, the Cloudflare CLI)
npm install

# 2. create + seed the LOCAL database (tables, sample products, Drop One, admin)
npm run db:local

# 3. start the dev server (frontend + API + local D1)
npm run dev
```

Open the URL Wrangler prints (usually **http://localhost:8788**).

- Storefront: `http://localhost:8788/`
- Admin: `http://localhost:8788/admin`  → `admin@vigorwolf.com` / `VigorWolfAdmin123`

> Need a clean database again? `npm run db:reset:local` wipes and reseeds the local D1.

> **Local email testing (optional):** copy `.dev.vars.example` to `.dev.vars` and fill in a key.

### 2) Build / export
There is **no build step** — the site is already static in `public/`. The backend runs as
Cloudflare Functions. You deploy the folder as-is (next section).

---

## 2) Deploy to Cloudflare Pages

You can deploy from the **dashboard (Git)** — recommended — or the **CLI**.

### A. Create the D1 database (once)

```bash
npx wrangler login
npx wrangler d1 create vigorwolf-db
```

Copy the `database_id` it prints into **`wrangler.toml`** (replace `PASTE_YOUR_D1_DATABASE_ID_HERE`).

Then create the tables + seed on the **remote** (production) database:

```bash
npm run db:remote
```

### B. Deploy the site — Option 1: GitHub (recommended)

1. Push this folder to a GitHub repo.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
3. Build settings:
   - **Framework preset:** `None`
   - **Build command:** *(leave empty)*
   - **Build output directory:** `public`
4. **Save and Deploy.**
5. After the first deploy, bind the database:
   **Settings → Functions → D1 database bindings → Add** →
   Variable name `DB`, Database `vigorwolf-db`. **Redeploy.**
6. Add variables/secrets: **Settings → Variables and Secrets** (see step 4 below), then redeploy.

### B. Deploy the site — Option 2: CLI (no GitHub needed)

```bash
npx wrangler pages deploy public
```

Follow the prompt to create a project (e.g. `vigorwolf`). Then add the D1 binding + secrets in the
dashboard as above and run `npx wrangler pages deploy public` again.

Your site goes live at `https://vigorwolf.pages.dev` (free).

---

## 3) Connect your domain

1. Add your domain to Cloudflare: **dashboard → Add a site** (or register it with Cloudflare Registrar).
   If bought elsewhere, point the domain's nameservers to the two Cloudflare gives you.
2. **Workers & Pages → your Pages project → Custom domains → Set up a custom domain.**
3. Enter `yourdomain.com` (and/or `www.yourdomain.com`). Cloudflare adds the DNS records
   automatically when the domain is on your Cloudflare account.
4. Wait for SSL to go active (usually minutes). Done — HTTPS is automatic and free.

You now pay **only the yearly domain fee**. Pages hosting + Functions + D1 stay on the free tier.

---

## 4) Turn on order emails (optional)

Orders **always** save to D1 and show in **Admin → Orders**. To also get an email at
`vigorwolf1@gmail.com` on each order/contact/signup, add one provider's key.

In **Pages → Settings → Variables and Secrets** add:

**Option A — Web3Forms (simplest, free):**
1. Get a free access key at <https://web3forms.com> (enter your email, copy the key).
2. Set variable `EMAIL_PROVIDER` = `web3forms`
3. Set secret `WEB3FORMS_KEY` = *your key*

**Option B — Resend (free tier, needs a domain to send from your address):**
1. Create a key at <https://resend.com>.
2. Set `EMAIL_PROVIDER` = `resend`, secret `RESEND_API_KEY` = *your key*,
   variable `RESEND_FROM` = `VIGORWOLF <orders@yourdomain.com>`.

Also set the secret **`SESSION_SECRET`** to a long random string (used to sign admin sessions).
Redeploy after adding variables. To notify a different address, change `NOTIFY_EMAIL` in `wrangler.toml`.

---

## Where to change things

| # | What | Where |
|---|------|-------|
| 5 | **Admin email / password** | Update the seeded row in `migrations/0001_init.sql` (the password is a PBKDF2 hash — see below), or change it live in D1. |
| 6 | **Products** | Easiest: **Admin → Products** (add/edit/delete, price, sizes, colors, stock, status, image URL, etc.). Or edit the seed in `migrations/0001_init.sql`. |
| 7 | **Brand colors** | `public/assets/css/styles.css` → the `:root { --bg / --surface / --red / ... }` block at the top. |
| 8 | **Logo** | Replace `public/assets/media/logo-white.png` (white, transparent — used on the dark UI) and `logo-red.png` (favicon). Keep the same filenames, or update the references in `public/assets/js/ui.js` + `admin.js`. |
| 9 | **Launch / drop date + countdown** | **Admin → Drops** (edit the current drop's *Countdown Date*). Fallback lives in `public/assets/js/config.js` → `fallbackDropDate`. |

### Changing the admin password (hash)

The DB stores a PBKDF2 hash, never plaintext. To generate a new one for a new password:

```bash
node -e 'const c=require("crypto");const pw="YOUR_NEW_PASSWORD";const s=c.randomBytes(16);const h=c.pbkdf2Sync(pw,s,100000,32,"sha256");console.log("pbkdf2$100000$"+s.toString("hex")+"$"+h.toString("hex"))'
```

Paste the output into the `admin_users` INSERT in `migrations/0001_init.sql`, or update the live row:

```bash
npx wrangler d1 execute vigorwolf-db --remote \
  --command "UPDATE admin_users SET email='you@brand.com', password='PASTE_HASH_HERE' WHERE id=1"
```

### Replacing product images later
Drop new images into `public/assets/media/`, then in **Admin → Products** set the product's
**Image URL** to `/assets/media/your-file.jpg` (and optional gallery URLs). Keep images web-sized
(≈1200px wide, JPG) for fast loading. Later you can serve uploads from Cloudflare **R2** — the
schema already stores plain image URLs, so R2 is a drop-in upgrade with no code changes to the store.

---

## Loyalty points & coupons

**Loyalty (logged-in customers only):**
- Earn **100 points for every 10 JD** of an order's subtotal (before discounts).
- **100 points = 1 JD** off a future order.
- Points are stored **server-side in D1**, keyed by the account email — they survive
  browser/device changes. Guests can order but earn/redeem nothing.
- Shown on the **profile page**, during **checkout** (choose how many to redeem, capped at
  balance and at the order total), and on the **order confirmation** page.
- Admin: **Loyalty** page shows every customer's balance + the full transaction ledger, and
  lets you **manually add/remove points** with a note. Dashboard shows total points issued/redeemed.

**Coupons (managed in Admin → Coupons):**
- Percentage or fixed-JD discounts, with optional **minimum order**, **max uses**, and **expiry**.
- Customers enter the code at checkout. Discount order is **coupon first, then loyalty points**.
- Expired / inactive / over-limit / below-minimum coupons are rejected server-side.
- A sample coupon **`PACK10`** (10% off, min order 20 JD) is seeded for you.
- Every order records its subtotal, coupon code + discount, points redeemed + discount,
  points earned, and final total — visible in **Admin → Orders**.

To change the loyalty rate, edit `POINTS_PER_JD_SPENT` / `POINTS_PER_JD_VALUE` in
`functions/api/_lib/loyalty.js`.

---

## Buy a domain + keep hosting free

1. **Buy a domain** from Cloudflare Registrar (at cost), Namecheap, or GoDaddy — you pay this yearly.
2. **Deploy** this project to **Cloudflare Pages** (section 2) — free.
3. **Connect the domain** to the Pages project (section 3) — free, automatic HTTPS.
4. **Pay only the domain** each year. Cloudflare Pages, Functions, and D1 run on generous free tiers
   that comfortably cover a launching brand.
5. No servers to keep online, no monthly hosting bill.

---

## Admin credentials (default — change before launch!)
```
URL:      /admin
Email:    admin@vigorwolf.com
Password: VigorWolfAdmin123
```

## API reference (all under `/api`)
`GET products` · `GET products?slug=` · `GET drops?current=1` · `POST signups` · `POST contact`
· `POST orders/create` · `GET orders?number=` · `GET orders?email=`
· `GET user/points?email=` · `POST coupons/validate`
· `POST admin/login` · `POST admin/logout` · `GET admin/me` · `GET admin/stats`
· `GET admin/orders` · `PATCH admin/orders/:id/status`
· `GET|POST admin/products` · `PATCH|DELETE admin/products/:id`
· `GET|POST admin/drops` · `PATCH admin/drops/:id` · `GET admin/signups` (`?format=csv`)
· `GET|POST admin/coupons` · `PATCH|DELETE admin/coupons/:id`
· `GET admin/loyalty-transactions` · `GET admin/users` · `PATCH admin/users/:id/points`

Admin routes require a valid session cookie; unauthenticated requests get `401`.
