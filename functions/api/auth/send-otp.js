import { json, bad, normPhone, otpSend } from '../../lib.js';

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch (_) {}
  const phone = normPhone(body.phone);
  if (!phone) return bad('Enter a valid 10-digit mobile number');
  const r = await otpSend(env, phone);
  if (!r.ok) return bad('Could not send code. Try again.', 502);
  return json({ ok: true, dev: !!r.dev });
}
