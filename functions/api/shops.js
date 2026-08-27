import { json } from '../lib.js';

// GET /api/shops  -> active shops
// GET /api/shops?product_id=12 -> shops that stock a product, with price/stock
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const pid = url.searchParams.get('product_id');
  if (pid) {
    const rs = await env.DB.prepare(
      `SELECT s.id,s.name,s.address,s.area,i.price,i.stock
         FROM inventory i JOIN shops s ON s.id = i.shop_id
        WHERE i.product_id = ? AND s.active = 1 AND i.stock > 0
        ORDER BY i.price ASC`
    ).bind(pid).all();
    return json({ ok: true, items: rs.results || [] });
  }
  const rs = await env.DB.prepare(
    'SELECT id,name,address,area,lat,lng FROM shops WHERE active = 1 ORDER BY name'
  ).all();
  return json({ ok: true, items: rs.results || [] });
}
