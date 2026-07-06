// Shipping fee rules. Edit the rates here (server-side source of truth).
// Amman = 2 JD, anywhere else = 3 JD.
export const SHIPPING_AMMAN = 2;
export const SHIPPING_OTHER = 3;

// Returns the shipping fee (JD) for a given city string.
// Matches "amman" case-insensitively, and the Arabic spelling عمان.
export function shippingFor(city) {
  const c = String(city || "").trim().toLowerCase();
  if (!c) return SHIPPING_OTHER;
  if (c.includes("amman") || c.includes("عمان")) return SHIPPING_AMMAN;
  return SHIPPING_OTHER;
}
