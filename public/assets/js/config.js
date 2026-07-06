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
