import { json, bad } from '../../lib.js';

const ALLOWED = ['created', 'paid', 'ready', 'collected', 'cancelled'];

// POST /api/admin/order-status { order_id, status, code? }
// If moving to 'collected', require matching collect code (shop counter verify).
export async function onRequestPost({ request, env }) {
  let b = {};
  try { b = await request.json(); } catch (_) {}
  const id = parseInt(b.order_id, 10);
  const status = String(b.status || '');
  if (!ALLOWED.includes(status)) return bad('Bad status');
  const o = await env.DB.prepare('SELECT id,collect_code,status FROM orders WHERE id = ?').bind(id).first();
  if (!o) return bad('Order not found', 404);
  if (status === 'collected' && String(b.code || '') !== String(o.collect_code || '')) {
    return bad('Collect code does not match', 400);
  }
  await env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, id).run();
  return json({ ok: true });
}
