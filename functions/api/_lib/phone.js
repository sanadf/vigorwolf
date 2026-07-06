// Phone normalization + validation to E.164 (e.g. +962791234567).
// Accepts numbers from any country. Strong fallback without external libraries.
//
// Rules:
//  - strip spaces, dashes, dots, parentheses
//  - "00" international prefix -> "+"
//  - a local Jordan mobile "07XXXXXXXX" (10 digits) -> "+9627XXXXXXXX"
//  - must end up as E.164: "+" then 8–15 digits, first digit 1–9

const E164 = /^\+[1-9]\d{7,14}$/;

export function normalizePhone(raw, defaultCountry = "JO") {
  let s = String(raw || "").trim();
  if (!s) return "";
  s = s.replace(/[\s()\-.]/g, "");          // remove separators
  if (s.startsWith("00")) s = "+" + s.slice(2);
  // Local Jordan mobile: 07XXXXXXXX -> +9627XXXXXXXX
  if (defaultCountry === "JO" && /^07\d{8}$/.test(s)) s = "+962" + s.slice(1);
  // Bare digits with a leading country code but no "+": accept if plausible length.
  if (!s.startsWith("+") && /^\d{8,15}$/.test(s)) s = "+" + s;
  return s;
}

export function isValidPhone(e164) {
  return E164.test(String(e164 || ""));
}
