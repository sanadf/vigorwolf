// POST /api/admin/logout
import { ok } from "../_lib/http.js";
import { clearCookie } from "../_lib/auth.js";

export async function onRequestPost() {
  return ok({ loggedOut: true }, { "Set-Cookie": clearCookie() });
}
