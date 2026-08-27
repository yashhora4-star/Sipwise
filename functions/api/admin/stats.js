import { json } from '../../lib.js';

// GET /api/admin/stats -> dashboard numbers
export async function onRequestGet({ env }) {
  const q = s => env.DB.prepare(s).first();
  const users = await q('SELECT COUNT(*) c FROM users');
  const orders = await q('SELECT COUNT(*) c FROM orders');
  const paid = await q("SELECT COUNT(*) c, COALESCE(SUM(total),0) g, COALESCE(SUM(convenience_fee),0) f FROM orders WHERE status IN ('paid','ready','collected')");
  const products = await q('SELECT COUNT(*) c FROM products WHERE active=1');
  const shops = await q('SELECT COUNT(*) c FROM shops WHERE active=1');
  return json({
    ok: true,
    stats: {
      users: users.c, orders: orders.c, paid_orders: paid.c,
      gmv: paid.g, revenue: paid.f, products: products.c, shops: shops.c,
    },
  });
}
