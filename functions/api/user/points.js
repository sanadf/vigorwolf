// GET /api/user/points?email=...  -> loyalty balance for a customer account
import { json, fail, isEmail } from "../_lib/http.js";
import { getBalance, pointsToJd } from "../_lib/loyalty.js";

export async function onRequestGet(context) {
  const { env, request } = context;
  const email = new URL(request.url).searchParams.get("email");
  if (!isEmail(email)) return fail("Valid email required.", 400);
  try {
    const { balance } = await getBalance(env, email);
    return json({ ok: true, balance, jdValue: pointsToJd(balance) });
  } catch (err) {
    return fail("Could not load points: " + err.message, 500);
  }
}
