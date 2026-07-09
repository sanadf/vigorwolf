#!/usr/bin/env node
/**
 * VIGORWOLF — safe, read-only debug lookup for a single customer in D1.
 * Prints only metadata (lengths/flags) — NEVER the actual password hash.
 *
 * Usage:
 *   node scripts/user-debug.mjs <email> [--remote|--local]
 *
 * npm shortcuts:
 *   npm run user:debug:remote -- you@example.com
 *   npm run user:debug:local  -- you@example.com
 */
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const positional = args.filter((a) => !a.startsWith("--"));

const email = String(positional[0] || "").trim().toLowerCase();
const target = flags.includes("--local") ? "--local" : "--remote";

if (!email) {
  console.error("❌ Usage: node scripts/user-debug.mjs you@example.com [--remote|--local]");
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

const rows = d1(
  `SELECT id, email, password_hash, password, created_at FROM users WHERE email = '${q(email)}'`
);

if (!rows.length) {
  console.log(`\n❌ No user found with email ${email} (${target}).\n`);
  process.exit(0);
}

const u = rows[0];
const hasHash = !!(u.password_hash && u.password_hash.length);
const hasLegacy = !!(u.password && u.password.length);

let orderCount = "n/a";
try {
  const orders = d1(`SELECT COUNT(*) AS n FROM orders WHERE email = '${q(email)}' OR user_email = '${q(email)}'`);
  orderCount = orders[0]?.n ?? "n/a";
} catch {
  // orders table/columns may differ; not fatal for a debug script.
}

console.log(`\nUser debug — ${target}`);
console.log("----------------------------------------");
console.log("id:                 ", u.id);
console.log("email:              ", u.email);
console.log("has password_hash:  ", hasHash ? "yes" : "no");
console.log("password_hash len:  ", hasHash ? u.password_hash.length : 0);
console.log("has legacy password:", hasLegacy ? "yes" : "no");
console.log("legacy password len:", hasLegacy ? u.password.length : 0);
console.log("created_at:         ", u.created_at);
console.log("order count:        ", orderCount);
console.log("");
