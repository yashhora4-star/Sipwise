import { json, currentUser } from '../../lib.js';

export async function onRequestGet({ request, env }) {
  const u = await currentUser(env, request);
  return json({ ok: true, user: u });
}
