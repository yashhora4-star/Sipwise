import { json, bad, normPhone, otpCheck, openSession, sessionCookie } from '../../lib.js';

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch (_) {}
  const phone = normPhone(body.phone);
  const code = String(body.code || '').replace(/\D/g, '');
  if (!phone) return bad('Invalid number');
  if (code.length < 4) return bad('Enter the code');
  const ok = await otpCheck(env, phone, code);
  if (!ok) return bad('Wrong or expired code', 401);
  const { token, user } = await openSession(env, phone);
  return json(
    { ok: true, user: { id: user.id, phone: user.phone, name: user.name } },
    200,
    { 'Set-Cookie': sessionCookie(token) }
  );
}
