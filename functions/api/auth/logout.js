import { json, getCookie, clearCookie } from '../../lib.js';

export async function onRequestPost({ request, env }) {
  const token = getCookie(request, 'sw_session');
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
}
