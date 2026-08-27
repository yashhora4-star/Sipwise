import { json, bad, currentUser } from '../../lib.js';

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function code6() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, '0');
}

// POST /api/pay/verify { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }
export async function onRequestPost({ request, env }) {
  const u = await currentUser(env, request);
  if (!u) return bad('Please sign in first', 401);
  let b = {};
  try { b = await request.json(); } catch (_) {}
  const order = await env.DB.prepare(
    'SELECT id,shop_id,total,status,razorpay_order_id FROM orders WHERE id = ? AND user_id = ?'
  ).bind(parseInt(b.order_id, 10), u.id).first();
  if (!order) return bad('Order not found', 404);
  if (order.status === 'paid') {
    const ex = await env.DB.prepare('SELECT collect_code FROM orders WHERE id = ?').bind(order.id).first();
    return json({ ok: true, collect_code: ex.collect_code, already: true });
  }
  if (order.razorpay_order_id !== b.razorpay_order_id) return bad('Order mismatch');

  const expected = await hmacHex(env.RAZORPAY_KEY_SECRET, `${b.razorpay_order_id}|${b.razorpay_payment_id}`);
  if (expected !== b.razorpay_signature) return bad('Payment signature invalid', 400);

  const collect = code6();
  await env.DB.prepare(
    "UPDATE orders SET status='paid', razorpay_payment_id=?, collect_code=? WHERE id=?"
  ).bind(b.razorpay_payment_id, collect, order.id).run();

  // decrement stock
  const items = await env.DB.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').bind(order.id).all();
  for (const it of (items.results || [])) {
    await env.DB.prepare('UPDATE inventory SET stock = MAX(0, stock - ?) WHERE shop_id = ? AND product_id = ?')
      .bind(it.qty, order.shop_id, it.product_id).run();
  }

  return json({ ok: true, collect_code: collect });
}
