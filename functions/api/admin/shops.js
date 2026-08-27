import { json, bad } from '../../lib.js';

// GET  /api/admin/shops           -> all shops
// POST /api/admin/shops {id?, name, address, area, lat, lng, license_no, active}
export async function onRequestGet({ env }) {
  const rs = await env.DB.prepare('SELECT * FROM shops ORDER BY id').all();
  return json({ ok: true, shops: rs.results || [] });
}

export async function onRequestPost({ request, env }) {
  let b = {};
  try { b = await request.json(); } catch (_) {}
  if (!b.name) return bad('Name required');
  const active = b.active === false ? 0 : 1;
  if (b.id) {
    await env.DB.prepare(
      'UPDATE shops SET name=?,address=?,area=?,lat=?,lng=?,license_no=?,active=? WHERE id=?'
    ).bind(b.name, b.address || '', b.area || '', b.lat || null, b.lng || null, b.license_no || '', active, b.id).run();
    return json({ ok: true, id: b.id });
  }
  const r = await env.DB.prepare(
    'INSERT INTO shops (name,address,area,lat,lng,license_no,active) VALUES (?,?,?,?,?,?,?)'
  ).bind(b.name, b.address || '', b.area || '', b.lat || null, b.lng || null, b.license_no || '', active).run();
  return json({ ok: true, id: r.meta.last_row_id });
}
