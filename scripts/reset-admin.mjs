#!/usr/bin/env node
/**
 * VIGORWOLF — create/reset the admin user in D1 (no plaintext stored).
 *
 * Generates a PBKDF2-SHA256 hash that matches the Worker's verifier
 * (functions/api/_lib/auth.js) and upserts a single admin row.
 *
 * Usage:
 *   node scripts/reset-admin.mjs <email> <password> [--remote|--local]
 *   ADMIN_EMAIL=you@brand.com ADMIN_PASSWORD=Secret123 node scripts/reset-admin.mjs --remote
 *
 * npm shortcuts:
 *   npm run admin:reset:remote -- you@brand.com "YourStrongPass"
 *   npm run admin:reset:local  -- you@brand.com "YourStrongPass"
 *
 * By default this REPLACES all admins with the one you provide (so you end up
 * with exactly one working admin). Pass --keep-others to only upsert.
 */
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const positional = args.filter((a) => !a.startsWith("--"));

const email = (positional[0] || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = positional[1] || process.env.ADMIN_PASSWORD || "";
const target = flags.includes("--local") ? "--local" : "--remote";
const keepOthers = flags.includes("--keep-others");

if (!email || !password) {
  console.error("❌ Provide email and password.\n" +
    '   node scripts/reset-admin.mjs you@brand.com "YourStrongPass" --remote');
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("❌ Invalid email:", email); process.exit(1);
}
if (password.length < 6) {
  console.error("❌ Password must be at least 6 characters."); process.exit(1);
}

// PBKDF2 — must match functions/api/_lib/auth.js (100000 iters, sha256, 32 bytes).
const iterations = 100000;
const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
const stored = `pbkdf2$${iterations}$${salt.toString("hex")}$${hash.toString("hex")}`;

const q = (s) => String(s).replace(/'/g, "''"); // escape single quotes for SQL
const sql =
  (keepOthers ? "" : "DELETE FROM admin_users; ") +
  `INSERT INTO admin_users (email, password) VALUES ('${q(email)}', '${q(stored)}') ` +
  `ON CONFLICT(email) DO UPDATE SET password = excluded.password;`;

console.log(`\n🔐 Setting admin: ${email}  (target: ${target})`);
const run = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", "vigorwolf-db", target, "--command", sql],
  { stdio: "inherit" }
);

if (run.status !== 0) {
  console.error("\n❌ wrangler failed. Are you logged in? Try: npx wrangler login");
  console.error("   You can also run this SQL manually in the Cloudflare D1 console:\n");
  console.error("   " + sql + "\n");
  process.exit(run.status || 1);
}
console.log(`\n✅ Admin ready. Log in at /admin with:\n   Email:    ${email}\n   Password: (the one you just set)\n`);
