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

  // Delivery: Jordan only. Governorate list + fees are for DISPLAY at checkout;
  // the server recomputes the real fee and validates the governorate in
  // functions/api/_lib/shipping.js (edit BOTH if you change the rates).
  country: "Jordan",
  governorates: [
    { value: "Amman",        label: "Amman (عمّان)",          fee: 2 },
    { value: "Zarqa",        label: "Zarqa (الزرقاء)",         fee: 3 },
    { value: "Irbid",        label: "Irbid (إربد)",            fee: 3 },
    { value: "Balqa (Salt)", label: "Balqa / Salt (البلقاء)",  fee: 3 },
    { value: "Madaba",       label: "Madaba (مادبا)",          fee: 3 },
    { value: "Jerash",       label: "Jerash (جرش)",            fee: 3 },
    { value: "Ajloun",       label: "Ajloun (عجلون)",          fee: 3 },
    { value: "Mafraq",       label: "Mafraq (المفرق)",         fee: 3 },
    { value: "Karak",        label: "Karak (الكرك)",           fee: 3 },
    { value: "Tafileh",      label: "Tafileh (الطفيلة)",       fee: 3 },
    { value: "Ma'an",        label: "Ma'an (معان)",            fee: 3 },
    { value: "Aqaba",        label: "Aqaba (العقبة)",          fee: 3 },
  ],

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
