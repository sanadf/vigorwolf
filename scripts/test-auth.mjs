#!/usr/bin/env node
/**
 * VIGORWOLF — auth integration tests (run against a running dev server).
 *   1) npm run dev         (in another terminal)
 *   2) node scripts/test-auth.mjs [baseUrl]
 *
 * Uses two independent cookie jars to prove an account created on "device A"
 * can log in from a fresh "device B" (the exact bug we fixed).
 */
const BASE = process.argv[2] || "http://localhost:8788";
let pass = 0, fail = 0;
const ok = (n) => { console.log(`  ✅ ${n}`); pass++; };
const no = (n, d) => { console.log(`  ❌ ${n} — ${d}`); fail++; };

// Minimal cookie jar per "device".
function device() {
  const jar = {};
  return {
    async req(path, opts = {}) {
      const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
      const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
      if (cookie) headers.Cookie = cookie;
      const res = await fetch(BASE + path, { ...opts, headers });
      const sc = res.headers.get("set-cookie");
      if (sc) sc.split(/,(?=[^ ]+=)/).forEach((c) => { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
      let body = {}; try { body = await res.json(); } catch {}
      return { status: res.status, body };
    },
  };
}

const email = `test_${Date.now()}@pack.com`;
const password = "Relentless#2026";

(async () => {
  console.log(`\nAuth tests against ${BASE}\n`);
  const laptop = device();
  const phone = device();

  // 1) signup creates user
  let r = await laptop.req("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Test One", email, password }) });
  r.status === 200 && r.body.ok ? ok("signup creates user") : no("signup creates user", JSON.stringify(r.body));

  // 2) duplicate signup fails (same email, even different case)
  r = await laptop.req("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Dupe", email: email.toUpperCase(), password: "another123" }) });
  r.status === 409 && !r.body.ok ? ok("duplicate signup rejected") : no("duplicate signup rejected", JSON.stringify(r.body));

  // 3) session works right after signup (laptop is logged in)
  r = await laptop.req("/api/auth/me");
  r.status === 200 && r.body.user && r.body.user.email === email ? ok("session active after signup") : no("session active after signup", JSON.stringify(r.body));

  // 4) login works from a FRESH device (phone jar — the original bug)
  r = await phone.req("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  const phoneLoggedIn = r.status === 200 && r.body.ok;
  phoneLoggedIn ? ok("login works from a fresh device") : no("login works from a fresh device", JSON.stringify(r.body));
  r = await phone.req("/api/auth/me");
  r.body.user && r.body.user.email === email ? ok("fresh device session valid") : no("fresh device session valid", JSON.stringify(r.body));

  // 5) wrong password fails
  const p2 = device();
  r = await p2.req("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password: "WRONGpass1" }) });
  r.status === 401 && !r.body.ok ? ok("wrong password rejected") : no("wrong password rejected", JSON.stringify(r.body));

  // 6) email case-insensitive login (UPPER + spaces still logs in)
  const p3 = device();
  r = await p3.req("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "  " + email.toUpperCase() + "  ", password }) });
  r.status === 200 && r.body.ok ? ok("case/space-insensitive email login") : no("case/space-insensitive email login", JSON.stringify(r.body));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
