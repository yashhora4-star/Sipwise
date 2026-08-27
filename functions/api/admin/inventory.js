import { json, bad } from '../../lib.js';

// GET  /api/admin/inventory?shop_id=1        -> inventory for a shop
// POST /api/admin/inventory {shop_id, product_id, price, stock}  -> upsert
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const shopId = parseInt(url.searchParams.get('shop_id'), 10);
  if (!shopId) return bad('shop_id required');
  const rs = await env.DB.prepare(
    `SELECT i.product_id, p.name, p.type, i.price, i.stock
       FROM inventory i JOIN products p ON p.id=i.product_id
      WHERE i.shop_id = ? ORDER BY p.name`
  ).bind(shopId).all();
  return json({ ok: true, items: rs.results || [] });
}

export async function onRequestPost({ request, env }) {
  let b = {};
  try { b = await request.json(); } catch (_) {}
  const shopId = parseInt(b.shop_id, 10), pid = parseInt(b.product_id, 10);
  if (!shopId || !pid) return bad('shop_id and product_id required');
  const price = Math.max(0, parseInt(b.price, 10) || 0);
  const stock = Math.max(0, parseInt(b.stock, 10) || 0);
  await env.DB.prepare(
    `INSERT INTO inventory (shop_id,product_id,price,stock) VALUES (?,?,?,?)
     ON CONFLICT(shop_id,product_id) DO UPDATE SET price=excluded.price, stock=excluded.stock`
  ).bind(shopId, pid, price, stock).run();
  return json({ ok: true });
}
