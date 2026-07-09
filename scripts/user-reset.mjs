#!/usr/bin/env node
/**
 * VIGORWOLF — reset a customer's password directly in D1.
 *
 * Generates a PBKDF2-SHA256 hash using the EXACT same scheme as
 * functions/api/_lib/auth.js (100000 iterations, SHA-256, 32 bytes) and writes
 * it to users.password_hash. Never touches orders/loyalty/products, never
 * deletes anything, never prints the hash.
 *
 * Usage:
 *   node scripts/user-reset.mjs <email> <newPassword> [--remote|--local]
 *
 * npm shortcuts:
 *   npm run user:reset:remote -- you@example.com "NewPassword"
 *   npm run user:reset:local  -- you@example.com "NewPassword"
 */
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const positional = args.filter((a) => !a.startsWith("--"));

const email = String(positional[0] || "").trim().toLowerCase();
const password = positional[1] || "";
const target = flags.includes("--local") ? "--local" : "--remote";

if (!email || !password) {
  console.error('❌ Usage: node scripts/user-reset.mjs you@example.com "NewPassword" [--remote|--local]');
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("❌ Invalid email:", email);
  process.exit(1);
}
if (password.length < 6) {
  console.error("❌ Password must be at least 6 characters.");
  process.exit(1);
}

const q = (s) => String(s).replace(/'/g, "''");

function d1(sql) {
  const run = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", "vigorwolf-db", target, "--json", "--command", sql],
    { encoding: "utf8" }
  );
  if (run.status !== 0) {
    console.error("\n❌ wrangler failed. Are you logged in? Try: npx wrangler login");
    console.error(run.stderr || run.stdout || "");
    process.exit(run.status || 1);
  }
  const out = run.stdout;
  const start = out.indexOf("[");
  if (start === -1) return [];
  return JSON.parse(out.slice(start))[0].results;
}

console.log(`\n🔎 Looking up ${email} (${target})...`);
const rows = d1(`SELECT id FROM users WHERE email = '${q(email)}'`);
if (!rows.length) {
  console.error(`❌ No user found with email ${email}. Not creating one — use register instead.`);
  process.exit(1);
}
const userId = rows[0].id;

// PBKDF2 — must match functions/api/_lib/auth.js (100000 iters, sha256, 32 bytes).
const iterations = 100000;
const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
const stored = `pbkdf2$${iterations}$${salt.toString("hex")}$${hash.toString("hex")}`;

d1(`UPDATE users SET password_hash = '${q(stored)}' WHERE id = ${userId}`);

console.log(`\n✅ Password reset for ${email} (target: ${target}).`);
console.log("   The new password is what you just entered — not printed here.\n");
