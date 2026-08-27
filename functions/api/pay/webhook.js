import { json } from '../../lib.js';

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST /api/pay/webhook  (Razorpay -> server; backup to client verify)
// Set webhook secret in Razorpay dashboard = env.RAZORPAY_WEBHOOK_SECRET
export async function onRequestPost({ request, env }) {
  const raw = await request.text();
  const sig = request.headers.get('X-Razorpay-Signature') || '';
  const expected = await hmacHex(env.RAZORPAY_WEBHOOK_SECRET || '', raw);
  if (expected !== sig) return json({ ok: false }, 400);

  let evt = {};
  try { evt = JSON.parse(raw); } catch (_) { return json({ ok: false }, 400); }

  if (evt.event === 'payment.captured' || evt.event === 'order.paid') {
    const p = evt.payload?.payment?.entity || {};
    const rpOrderId = p.order_id;
    if (rpOrderId) {
      const order = await env.DB.prepare("SELECT id,status FROM orders WHERE razorpay_order_id = ?").bind(rpOrderId).first();
      if (order && order.status !== 'paid') {
        const a = new Uint32Array(1); crypto.getRandomValues(a);
        const collect = String(a[0] % 1000000).padStart(6, '0');
        await env.DB.prepare("UPDATE orders SET status='paid', razorpay_payment_id=?, collect_code=? WHERE id=?")
          .bind(p.id, collect, order.id).run();
      }
    }
  }
  return json({ ok: true });
}
