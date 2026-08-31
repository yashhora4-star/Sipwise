import { json, bad, currentUser, normPhone, now } from '../../lib.js';

function mask(phone) {
  const d = String(phone || '').replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return phone || '';
  return '+91 ' + d.slice(0, 2) + '•••••' + d.slice(-3);
}
const label = u => u.name || mask(u.phone);

async function friendIds(env, uid) {
  const acc = await env.DB.prepare(
    `SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS other_id
       FROM friends
      WHERE (requester_id = ? OR addressee_id = ?) AND status = 'accepted'`
  ).bind(uid, uid, uid).all();
  return (acc.results || []).map(r => r.other_id);
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const seg = (Array.isArray(params.route) ? params.route[0] : params.route) || '';
  const u = await currentUser(env, request);
  if (!u) return bad('Please sign in first', 401);
  const method = request.method;
  let body = {};
  if (method === 'POST') { try { body = await request.json(); } catch (_) {} }

  // GET /api/circle/friends
  if (seg === 'friends' && method === 'GET') {
    const fids = await friendIds(env, u.id);
    const friends = [];
    for (const id of fids) {
      const p = await env.DB.prepare('SELECT id,name,phone FROM users WHERE id=?').bind(id).first();
      if (p) friends.push({ id: p.id, name: p.name, label: label(p) });
    }
    const pend = await env.DB.prepare(
      `SELECT f.id, us.name, us.phone FROM friends f JOIN users us ON us.id=f.requester_id
        WHERE f.addressee_id=? AND f.status='pending' ORDER BY f.id DESC`
    ).bind(u.id).all();
    const pending = (pend.results || []).map(r => ({ id: r.id, label: label(r) }));
    return json({ ok: true, me: { id: u.id, name: u.name, label: label(u) }, friends, pending });
  }

  // GET /api/circle/feed
  if (seg === 'feed' && method === 'GET') {
    const ids = [u.id, ...(await friendIds(env, u.id))];
    const ph = ids.map(() => '?').join(',');
    const rs = await env.DB.prepare(
      `SELECT a.name, a.note, a.created_at, a.user_id, us.name AS uname, us.phone AS uphone
         FROM activity a JOIN users us ON us.id=a.user_id
        WHERE a.user_id IN (${ph}) ORDER BY a.id DESC LIMIT 50`
    ).bind(...ids).all();
    const items = (rs.results || []).map(r => ({
      who: r.uname || mask(r.uphone), mine: r.user_id === u.id,
      product: r.name, note: r.note || '', at: r.created_at,
    }));
    return json({ ok: true, items });
  }

  // POST /api/circle/add { phone }
  if (seg === 'add' && method === 'POST') {
    const phone = normPhone(body.phone);
    if (!phone) return bad('Enter a valid 10-digit number');
    if (phone === u.phone) return bad("That's your own number");
    const target = await env.DB.prepare('SELECT id FROM users WHERE phone=?').bind(phone).first();
    if (!target) return bad("They're not on Surahi yet — invite them to join.");
    const ex = await env.DB.prepare(
      `SELECT id, status, requester_id FROM friends
        WHERE (requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?)`
    ).bind(u.id, target.id, target.id, u.id).first();
    if (ex) {
      if (ex.status === 'accepted') return json({ ok: true, state: 'already_friends' });
      if (ex.requester_id === target.id) {
        await env.DB.prepare("UPDATE friends SET status='accepted' WHERE id=?").bind(ex.id).run();
        return json({ ok: true, state: 'accepted' });
      }
      return json({ ok: true, state: 'already_requested' });
    }
    await env.DB.prepare('INSERT INTO friends (requester_id,addressee_id,status,created_at) VALUES (?,?,?,?)')
      .bind(u.id, target.id, 'pending', now()).run();
    return json({ ok: true, state: 'requested' });
  }

  // POST /api/circle/respond { id, accept }
  if (seg === 'respond' && method === 'POST') {
    const id = parseInt(body.id, 10);
    const row = await env.DB.prepare("SELECT id FROM friends WHERE id=? AND addressee_id=? AND status='pending'")
      .bind(id, u.id).first();
    if (!row) return bad('Request not found', 404);
    if (body.accept) await env.DB.prepare("UPDATE friends SET status='accepted' WHERE id=?").bind(id).run();
    else await env.DB.prepare('DELETE FROM friends WHERE id=?').bind(id).run();
    return json({ ok: true });
  }

  // POST /api/circle/pour { product_id, note }
  if (seg === 'pour' && method === 'POST') {
    const p = await env.DB.prepare('SELECT id,name FROM products WHERE id=?').bind(parseInt(body.product_id, 10)).first();
    if (!p) return bad('Pick a bottle');
    const note = String(body.note || '').trim().slice(0, 140);
    await env.DB.prepare('INSERT INTO activity (user_id,product_id,name,note,created_at) VALUES (?,?,?,?,?)')
      .bind(u.id, p.id, p.name, note, now()).run();
    return json({ ok: true });
  }

  return bad('Not found', 404);
}
