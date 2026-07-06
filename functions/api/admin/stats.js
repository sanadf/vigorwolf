// GET /api/admin/stats -> dashboard overview numbers + latest orders
import { json, fail } from "../_lib/http.js";
import { requireAdmin } from "../_lib/auth.js";

export async function onRequestGet(context) {
  const { env } = context;
  if (!(await requireAdmin(context))) return fail("Unauthorized", 401);

  try {
    const one = async (sql) => (await env.DB.prepare(sql).first())?.n ?? 0;
    const sum = async (sql) => (await env.DB.prepare(sql).first())?.s ?? 0;

    const totalSales = await sum("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE status != 'Cancelled'");
    const totalOrders = await one("SELECT COUNT(*) AS n FROM orders");
    const totalProducts = await one("SELECT COUNT(*) AS n FROM products");
    const lowStock = await one("SELECT COUNT(*) AS n FROM products WHERE status = 'low_stock'");
    const soldOut = await one("SELECT COUNT(*) AS n FROM products WHERE status = 'sold_out'");
    const comingSoon = await one("SELECT COUNT(*) AS n FROM products WHERE status = 'coming_soon'");
    const signups = await one("SELECT COUNT(*) AS n FROM email_signups");
    const pending = await one("SELECT COUNT(*) AS n FROM orders WHERE status = 'Pending'");
    const pointsIssued = await sum("SELECT COALESCE(SUM(points),0) AS s FROM loyalty_transactions WHERE points > 0");
    const pointsRedeemed = Math.abs(await sum("SELECT COALESCE(SUM(points),0) AS s FROM loyalty_transactions WHERE points < 0"));
    const activeCoupons = await one("SELECT COUNT(*) AS n FROM coupons WHERE active = 1");

    const latest = await env.DB.prepare(
      "SELECT order_number, customer_name, total, status, created_at FROM orders ORDER BY id DESC LIMIT 6"
    ).all();

    return json({
      ok: true,
      stats: { totalSales, totalOrders, totalProducts, lowStock, soldOut, comingSoon, signups, pending,
               pointsIssued, pointsRedeemed, activeCoupons },
      latestOrders: (latest.results || []).map((o) => ({
        orderNumber: o.order_number, customerName: o.customer_name,
        total: o.total, status: o.status, createdAt: o.created_at,
      })),
    });
  } catch (err) {
    return fail("Failed to load stats: " + err.message, 500);
  }
}
