#!/usr/bin/env node
/**
 * VIGORWOLF — password reset tests (run against the LOCAL dev server).
 *   1) npm run dev        (another terminal)
 *   2) node scripts/test-reset.mjs [baseUrl]
 *
 * Uses wrangler (--local) to inspect/insert reset tokens, since the raw token is
 * only ever emailed (D1 stores its hash). Verifies: no email enumeration, happy
 * path reset + auto-login, token cleared after use, expired + invalid rejected.
 */
import { execSync } from "node:child_process";
import crypto from "node:crypto";

const BASE = process.argv[2] || "http://localhost:8788";
let pass = 0, fail = 0;
const ok = (n) => { console.log(`  ✅ ${n}`); pass++; };
const no = (n, d) => { console.log(`  ❌ ${n} — ${d}`); fail++; };
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

function d1(sql) {
  const out = execSync(
    `npx wrangler d1 execute vigorwolf-db --local --json --command ${JSON.stringify(sql)}`,
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  );
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
}
async function api(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  let j = {}; try { j = await res.json(); } catch {}
  return { status: res.status, body: j };
}
const esc = (s) => String(s).replace(/'/g, "''");

(async () => {
  console.log(`\nPassword-reset tests against ${BASE}\n`);
  const email = `reset_${Date.now()}@pack.com`;
  const password = "OldPass#123";

  // setup: a real account
  let r = await api("/api/auth/register", { name: "Reset Test", email, password });
  r.status === 200 ? ok("setup: account created") : no("setup", JSON.stringify(r.body));

  // 1) no enumeration: same generic message for known + unknown email
  const known = (await api("/api/auth/forgot", { email })).body.message;
  const unknown = (await api("/api/auth/forgot", { email: `nobody_${Date.now()}@x.com` })).body.message;
  known && known === unknown ? ok("no email enumeration (identical response)") : no("no email enumeration", `${known} vs ${unknown}`);

  const uid = d1(`SELECT id FROM users WHERE email='${esc(email)}'`)[0].id;

  // 2) happy path: insert a valid token, reset, auto-login, token cleared
  const raw = crypto.randomBytes(32).toString("hex");
  const future = new Date(Date.now() + 30 * 60000).toISOString();
  d1(`DELETE FROM password_resets WHERE user_id=${uid}`);
  d1(`INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (${uid}, '${sha256(raw)}', '${future}')`);
  r = await api("/api/auth/reset", { token: raw, password: "NewPass#456" });
  const setCookie = r.status === 200; // reset also signs in
  setCookie && r.body.ok ? ok("valid token resets password") : no("valid token resets password", JSON.stringify(r.body));

  const cleared = d1(`SELECT COUNT(*) AS n FROM password_resets WHERE user_id=${uid}`)[0].n;
  cleared === 0 ? ok("reset tokens cleared after use") : no("tokens cleared", `count=${cleared}`);

  r = await api("/api/auth/login", { email, password: "NewPass#456" });
  r.status === 200 ? ok("login works with the NEW password") : no("login with new password", JSON.stringify(r.body));
  r = await api("/api/auth/login", { email, password });
  r.status === 401 ? ok("old password no longer works") : no("old password rejected", JSON.stringify(r.body));

  // 3) expired token is rejected
  const raw2 = crypto.randomBytes(32).toString("hex");
  const past = new Date(Date.now() - 60000).toISOString();
  d1(`INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (${uid}, '${sha256(raw2)}', '${past}')`);
  r = await api("/api/auth/reset", { token: raw2, password: "Whatever#1" });
  r.status === 400 ? ok("expired token rejected") : no("expired token rejected", JSON.stringify(r.body));

  // 4) invalid/unknown token is rejected
  r = await api("/api/auth/reset", { token: crypto.randomBytes(32).toString("hex"), password: "Whatever#1" });
  r.status === 400 ? ok("invalid token rejected") : no("invalid token rejected", JSON.stringify(r.body));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
