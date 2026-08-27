import { json } from '../../lib.js';

// GET /api/admin/orders?status=  -> all orders with items
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  let sql = `SELECT o.*, s.name AS shop, u.phone AS user_phone
               FROM orders o JOIN shops s ON s.id=o.shop_id JOIN users u ON u.id=o.user_id`;
  const binds = [];
  if (status) { sql += ' WHERE o.status = ?'; binds.push(status); }
  sql += ' ORDER BY o.id DESC LIMIT 200';
  const rs = await env.DB.prepare(sql).bind(...binds).all();
  const orders = [];
  for (const o of (rs.results || [])) {
    const items = await env.DB.prepare('SELECT name,qty,price FROM order_items WHERE order_id = ?').bind(o.id).all();
    orders.push({ ...o, items: items.results || [] });
  }
  return json({ ok: true, orders });
}
