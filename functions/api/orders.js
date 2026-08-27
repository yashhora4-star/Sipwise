import { json, bad, currentUser, now } from '../lib.js';

const FEE_PCT = 0.05;    // 5% consumer convenience fee
const FEE_MIN = 49;      // ₹49 minimum

// POST /api/orders  { shop_id, items:[{product_id, qty}] }  -> creates order (status 'created')
export async function onRequestPost({ request, env }) {
  const u = await currentUser(env, request);
  if (!u) return bad('Please sign in first', 401);
  let body = {};
  try { body = await request.json(); } catch (_) {}
  const shopId = parseInt(body.shop_id, 10);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!shopId || !items.length) return bad('Empty order');

  const shop = await env.DB.prepare('SELECT id,name FROM shops WHERE id = ? AND active = 1').bind(shopId).first();
  if (!shop) return bad('Shop unavailable');

  // price each line from live inventory
  let subtotal = 0;
  const lines = [];
  for (const it of items) {
    const pid = parseInt(it.product_id, 10);
    const qty = Math.max(1, Math.min(24, parseInt(it.qty, 10) || 1));
    const inv = await env.DB.prepare(
      `SELECT i.price, i.stock, p.name
         FROM inventory i JOIN products p ON p.id = i.product_id
        WHERE i.shop_id = ? AND i.product_id = ?`
    ).bind(shopId, pid).first();
    if (!inv) return bad(`Item ${pid} not stocked here`);
    if (inv.stock < qty) return bad(`Only ${inv.stock} left of ${inv.name}`);
    subtotal += inv.price * qty;
    lines.push({ product_id: pid, name: inv.name, qty, price: inv.price });
  }

  const fee = Math.max(FEE_MIN, Math.round(subtotal * FEE_PCT));
  const total = subtotal + fee;

  const r = await env.DB.prepare(
    `INSERT INTO orders (user_id,shop_id,status,subtotal,convenience_fee,total,created_at)
     VALUES (?,?,?,?,?,?,?)`
  ).bind(u.id, shopId, 'created', subtotal, fee, total, now()).run();
  const orderId = r.meta.last_row_id;

  for (const l of lines) {
    await env.DB.prepare(
      'INSERT INTO order_items (order_id,product_id,name,qty,price) VALUES (?,?,?,?,?)'
    ).bind(orderId, l.product_id, l.name, l.qty, l.price).run();
  }

  return json({ ok: true, order: { id: orderId, shop: shop.name, subtotal, fee, total, status: 'created', items: lines } });
}

// GET /api/orders -> current user's orders
export async function onRequestGet({ request, env }) {
  const u = await currentUser(env, request);
  if (!u) return bad('Please sign in first', 401);
  const rs = await env.DB.prepare(
    `SELECT o.id,o.status,o.subtotal,o.convenience_fee,o.total,o.collect_code,o.created_at,s.name AS shop
       FROM orders o JOIN shops s ON s.id = o.shop_id
      WHERE o.user_id = ? ORDER BY o.id DESC LIMIT 50`
  ).bind(u.id).all();
  const orders = [];
  for (const o of (rs.results || [])) {
    const items = await env.DB.prepare('SELECT name,qty,price FROM order_items WHERE order_id = ?').bind(o.id).all();
    orders.push({ ...o, items: items.results || [] });
  }
  return json({ ok: true, orders });
}
