import { json, bad, currentUser } from '../../lib.js';

// Set display name after first login
export async function onRequestPost({ request, env }) {
  const u = await currentUser(env, request);
  if (!u) return bad('Not signed in', 401);
  let body = {};
  try { body = await request.json(); } catch (_) {}
  const name = String(body.name || '').trim().slice(0, 60);
  if (!name) return bad('Name required');
  await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, u.id).run();
  return json({ ok: true, user: { ...u, name } });
}
