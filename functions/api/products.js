import { json } from '../lib.js';

// GET /api/products?type=&q=&sort=&limit=
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const type = (url.searchParams.get('type') || '').toLowerCase();
  const q = (url.searchParams.get('q') || '').trim();
  const sort = url.searchParams.get('sort') || 'featured';
  const limit = Math.min(500, parseInt(url.searchParams.get('limit') || '500', 10));

  let where = 'WHERE active = 1';
  const binds = [];
  if (type && type !== 'all') { where += ' AND type = ?'; binds.push(type); }
  if (q) { where += ' AND (name LIKE ? OR why LIKE ? OR type LIKE ?)'; binds.push(`%${q}%`, `%${q}%`, `%${q}%`); }

  let order = 'id ASC';
  if (sort === 'price_low') order = 'base_price ASC';
  else if (sort === 'price_high') order = 'base_price DESC';
  else if (sort === 'name') order = 'name ASC';

  const rs = await env.DB.prepare(
    `SELECT id,name,type,volume_ml,abv,serve,base_price,moods,occasions,why,image
       FROM products ${where} ORDER BY ${order} LIMIT ?`
  ).bind(...binds, limit).all();

  const items = (rs.results || []).map(p => ({
    ...p,
    moods: safeParse(p.moods),
    occasions: safeParse(p.occasions),
  }));
  return json({ ok: true, count: items.length, items });
}

function safeParse(s) { try { return JSON.parse(s || '[]'); } catch { return []; } }
