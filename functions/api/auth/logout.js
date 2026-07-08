// POST /api/auth/logout
import { ok } from "../_lib/http.js";
import { clearUserCookie } from "../_lib/auth.js";

export async function onRequestPost() {
  return ok({ loggedOut: true }, { "Set-Cookie": clearUserCookie() });
}
