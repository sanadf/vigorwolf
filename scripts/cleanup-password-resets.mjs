#!/usr/bin/env node
/**
 * VIGORWOLF — delete stale password_resets rows.
 *
 * The app already deletes a user's reset tokens the moment they're used or
 * superseded by a newer request (see functions/api/auth/forgot.js and
 * reset.js). This script is a hygiene sweep for the rows that are neither:
 * requests a customer abandoned (never clicked the link, never asked again).
 * Safe to run anytime — only touches password_resets, never users/orders/loyalty.
 *
 * Usage:
 *   node scripts/cleanup-password-resets.mjs [--remote|--local]
 *
 * npm shortcuts:
 *   npm run cleanup:resets:remote
 *   npm run cleanup:resets:local
 */
import { spawnSync } from "node:child_process";

const target = process.argv.includes("--local") ? "--local" : "--remote";
const sql = "DELETE FROM password_resets WHERE datetime(created_at) < datetime('now', '-24 hours');";

console.log(`\n🧹 Cleaning up expired password_resets rows older than 24h (${target})...`);
const run = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", "vigorwolf-db", target, "--command", sql],
  { stdio: "inherit" }
);

if (run.status !== 0) {
  console.error("\n❌ wrangler failed. Are you logged in? Try: npx wrangler login");
  process.exit(run.status || 1);
}
console.log("\n✅ Done.\n");
