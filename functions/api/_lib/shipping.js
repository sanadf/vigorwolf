// Jordan-only delivery. The governorate list + fees are the SERVER-SIDE source
// of truth — the browser cannot change the fee. Amman = 2 JD, everywhere else
// in Jordan = 3 JD. Non-Jordan / unknown values are rejected.

export const COUNTRY = "Jordan";

// Canonical governorate value -> fee (JD). `value` is what gets stored on the order.
export const GOVERNORATES = [
  { value: "Amman",       label: "Amman (عمّان)",        fee: 2 },
  { value: "Zarqa",       label: "Zarqa (الزرقاء)",       fee: 3 },
  { value: "Irbid",       label: "Irbid (إربد)",          fee: 3 },
  { value: "Balqa (Salt)",label: "Balqa / Salt (البلقاء)",fee: 3 },
  { value: "Madaba",      label: "Madaba (مادبا)",        fee: 3 },
  { value: "Jerash",      label: "Jerash (جرش)",          fee: 3 },
  { value: "Ajloun",      label: "Ajloun (عجلون)",        fee: 3 },
  { value: "Mafraq",      label: "Mafraq (المفرق)",       fee: 3 },
  { value: "Karak",       label: "Karak (الكرك)",         fee: 3 },
  { value: "Tafileh",     label: "Tafileh (الطفيلة)",     fee: 3 },
  { value: "Ma'an",       label: "Ma'an (معان)",          fee: 3 },
  { value: "Aqaba",       label: "Aqaba (العقبة)",        fee: 3 },
];

const DEFAULT_FEE = 3; // any other approved Jordan location

// Returns { valid, fee, value }. valid=false means "outside Jordan / not allowed".
export function resolveShipping(governorate) {
  const g = String(governorate || "").trim().toLowerCase();
  if (!g) return { valid: false, fee: 0, value: "" };
  const match = GOVERNORATES.find((x) => x.value.toLowerCase() === g);
  if (!match) return { valid: false, fee: 0, value: "" };
  return { valid: true, fee: match.fee ?? DEFAULT_FEE, value: match.value };
}
