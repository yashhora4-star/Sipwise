import { json, bad, currentUser } from '../../lib.js';

// POST /api/pay/create-order { order_id } -> Razorpay order for checkout
export async function onRequestPost({ request, env }) {
  const u = await currentUser(env, request);
  if (!u) return bad('Please sign in first', 401);
  let body = {};
  try { body = await request.json(); } catch (_) {}
  const orderId = parseInt(body.order_id, 10);
  const order = await env.DB.prepare(
    'SELECT id,total,status FROM orders WHERE id = ? AND user_id = ?'
  ).bind(orderId, u.id).first();
  if (!order) return bad('Order not found', 404);
  if (order.status !== 'created') return bad('Order already processed');

  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return bad('Payments not configured. Add RAZORPAY keys.', 503);
  }

  const r = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      amount: order.total * 100,       // paise
      currency: 'INR',
      receipt: `sw_${order.id}`,
      notes: { order_id: String(order.id), user_id: String(u.id) },
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) return bad('Could not start payment', 502);

  await env.DB.prepare('UPDATE orders SET razorpay_order_id = ? WHERE id = ?').bind(j.id, order.id).run();

  return json({
    ok: true,
    key_id: env.RAZORPAY_KEY_ID,
    rp_order_id: j.id,
    amount: j.amount,
    currency: j.currency,
    order_id: order.id,
  });
}
