/* ==========================================================================
   VIGORWOLF — front-end config
   Edit brand-wide settings here. (Server/admin secrets live in wrangler.toml
   and the Cloudflare dashboard, NOT in this file.)
   ========================================================================== */
window.VW_CONFIG = {
  brand: "VIGORWOLF",
  tagline: "Culture. Tribe. Lifestyle.",
  currency: "JD",            // shown after the price, e.g. "27.99 JD"

  // The admin area lives at /admin (kept low-key in the UI).
  adminPath: "/admin/",

  // Shipping fees (JD). Amman is cheaper; everywhere else pays "other".
  // These are for DISPLAY at checkout — the server recomputes the real fee in
  // functions/api/_lib/shipping.js (edit both if you change the rates).
  shipping: { amman: 2, other: 3 },

  // Optional Shopify integration. If enabled, the main "Shop the Drop" / "Shop Now"
  // buttons point to your Shopify store instead of the built-in shop.
  // See SHOPIFY.md for the full launch guide.
  shopify: { enabled: false, url: "https://shop.vigorwolf.co" },

  // Fallback countdown date if the API/D1 is unreachable (ISO 8601).
  // The live value normally comes from the current Drop in the database.
  fallbackDropDate: "2026-07-11T20:00:00",

  // Social placeholders — replace with your real links.
  social: {
    instagram: "https://instagram.com/vigorwolf",
    tiktok: "https://tiktok.com/@vigorwolf",
    email: "vigorwolf1@gmail.com",
  },

  categories: ["New Drop", "T-Shirts", "Hoodies", "Shirts", "Jackets", "Pants", "Accessories", "Sold Out"],
  sizes: ["S", "M", "L", "XL"],
  colors: ["Black", "White", "Grey", "Red"],
  orderStatuses: ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"],
  productStatuses: [
    { value: "active",      label: "Active" },
    { value: "new_drop",    label: "New Drop" },
    { value: "low_stock",   label: "Low Stock" },
    { value: "coming_soon", label: "Coming Soon" },
    { value: "sold_out",    label: "Sold Out" },
  ],
};
