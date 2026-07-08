// Password hashing (PBKDF2-SHA256) + signed session cookies (HMAC-SHA256).
// Runs on the Cloudflare Workers runtime using the Web Crypto API.
import { parseCookies } from "./http.js";

const enc = new TextEncoder();
const COOKIE = "vw_admin";          // admin session cookie
const COOKIE_USER = "vw_user";      // customer session cookie
const SESSION_TTL = 60 * 60 * 8;         // admin: 8 hours
export const TTL_USER = 60 * 60 * 24 * 30; // customer: 30 days

const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex) =>
  new Uint8Array(hex.match(/.{1,2}/g).map((h) => parseInt(h, 16)));

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlToStr = (s) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return atob(s);
};

// ---- Password hashing -------------------------------------------------------
export async function hashPassword(password, iterations = 100000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, iterations);
  return `pbkdf2$${iterations}$${toHex(salt)}$${toHex(hash)}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, iterStr, saltHex, hashHex] = String(stored).split("$");
    if (scheme !== "pbkdf2") return false;
    const hash = await pbkdf2(password, fromHex(saltHex), parseInt(iterStr, 10));
    return timingSafeEqual(toHex(hash), hashHex);
  } catch {
    return false;
  }
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256
  );
  return bits;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---- Session tokens ---------------------------------------------------------
function sessionSecret(env) {
  // Set a strong SESSION_SECRET in the dashboard for production.
  return env.SESSION_SECRET || "vigorwolf-dev-secret-change-me";
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return crypto.subtle.sign("HMAC", key, enc.encode(data));
}

export async function createSession(env, payload, ttl = SESSION_TTL) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttl };
  const data = b64url(enc.encode(JSON.stringify(body)));
  const sig = b64url(await hmac(sessionSecret(env), data));
  return `${data}.${sig}`;
}

// Verify a signed cookie by name. Returns the payload or null.
async function readSessionFrom(env, request, cookieName) {
  const token = parseCookies(request)[cookieName];
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  const expected = b64url(await hmac(sessionSecret(env), data));
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(b64urlToStr(data));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

const cookie = (name, token, ttl) =>
  `${name}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ttl}`;

// ---- Admin session (backward-compatible signatures) ----
export const readSession = (env, request) => readSessionFrom(env, request, COOKIE);
export const sessionCookie = (token) => cookie(COOKIE, token, SESSION_TTL);
export const clearCookie = () => cookie(COOKIE, "", 0);
export async function requireAdmin(context) {
  return readSessionFrom(context.env, context.request, COOKIE);
}

// ---- Customer session ----
export const readUserSession = (env, request) => readSessionFrom(env, request, COOKIE_USER);
export const userSessionCookie = (token) => cookie(COOKIE_USER, token, TTL_USER);
export const clearUserCookie = () => cookie(COOKIE_USER, "", 0);
export async function requireUser(context) {
  return readSessionFrom(context.env, context.request, COOKIE_USER);
}
