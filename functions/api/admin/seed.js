import { json } from '../../lib.js';
import CATALOG from '../../../db/catalog.json';

// One-time seeder. Visit /api/admin/seed with the admin bearer key.
// Creates tables (idempotent) and loads the catalogue if products is empty.
// Add ?force=1 to wipe products/shops/inventory/orders and reload.
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT UNIQUE NOT NULL, name TEXT, created_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, volume_ml INTEGER, abv TEXT, serve TEXT, base_price INTEGER NOT NULL, moods TEXT, occasions TEXT, why TEXT, image TEXT, active INTEGER NOT NULL DEFAULT 1)",
  "CREATE TABLE IF NOT EXISTS shops (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, address TEXT, area TEXT, lat REAL, lng REAL, license_no TEXT, active INTEGER NOT NULL DEFAULT 1)",
  "CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, shop_id INTEGER NOT NULL, product_id INTEGER NOT NULL, price INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0, UNIQUE(shop_id, product_id))",
  "CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, shop_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'created', subtotal INTEGER NOT NULL, convenience_fee INTEGER NOT NULL, total INTEGER NOT NULL, collect_code TEXT, razorpay_order_id TEXT, razorpay_payment_id TEXT, created_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, name TEXT NOT NULL, qty INTEGER NOT NULL, price INTEGER NOT NULL)"
];

const SHOPS = [
  ["Atta Market Wines", "Sector 18, Atta Market, Noida", "Sector 18", 28.5708, 77.3260, "UP-NDA-0001"],
  ["Sector 62 Liquor Mart", "Near Fortis Hospital, Sector 62, Noida", "Sector 62", 28.6272, 77.3720, "UP-NDA-0002"],
  ["The Cellar, Sector 104", "Noida Expressway, Sector 104", "Sector 104", 28.5460, 77.3640, "UP-NDA-0003"]
];

const ABV = { whisky: "40-43%", wine: "12-14%", gin: "40-47%", rum: "40-43%", vodka: "40%", beer: "4-8%", sparkling: "11-12%", tequila: "38-40%", brandy: "36-40%", liqueur: "15-25%" };
const SERVE = { whisky: "Neat / rocks", wine: "Chilled", gin: "With tonic", rum: "Rocks / cola", vodka: "Chilled shot", beer: "Cold", sparkling: "Flute, cold", tequila: "Shot / margarita", brandy: "Warm snifter", liqueur: "Digestif" };

function typeOf(c) {
  const s = (c || "").toLowerCase();
  if (/whisky|whiskey|scotch|bourbon/.test(s)) return "whisky";
  if (/wine|port|ros/.test(s)) return "wine";
  if (/gin/.test(s)) return "gin";
  if (/rum/.test(s)) return "rum";
  if (/vodka/.test(s)) return "vodka";
  if (/beer|lager|ale|stout/.test(s)) return "beer";
  if (/champagne|sparkl|prosecco|cava/.test(s)) return "sparkling";
  if (/tequila|mezcal/.test(s)) return "tequila";
  if (/brandy|cognac/.test(s)) return "brandy";
  if (/liqueur|vermouth|aperitif/.test(s)) return "liqueur";
  return "other";
}
function volOf(c) { return parseInt(((c || "").split("·")[1] || "").replace(/[^0-9]/g, ""), 10) || 750; }

async function chunk(env, stmts) { for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50)); }

export async function onRequest({ request, env }) {
  for (const s of SCHEMA) await env.DB.prepare(s).run();
  const url = new URL(request.url);
  const force = url.searchParams.get('force') === '1';
  const c = await env.DB.prepare('SELECT COUNT(*) c FROM products').first();
  if (c.c > 0 && !force) return json({ ok: true, skipped: true, products: c.c, note: 'already seeded' });
  if (force) {
    await env.DB.prepare('DELETE FROM order_items').run();
    await env.DB.prepare('DELETE FROM orders').run();
    await env.DB.prepare('DELETE FROM inventory').run();
    await env.DB.prepare('DELETE FROM products').run();
    await env.DB.prepare('DELETE FROM shops').run();
  }

  const PRODUCTS = CATALOG.map(b => {
    const t = typeOf(b.c);
    return { name: b.n, type: t, volume_ml: volOf(b.c), abv: ABV[t] || "-", serve: SERVE[t] || "Chilled", base_price: b.base | 0, moods: b.moods || [], occasions: b.occ || [], why: b.why || "" };
  });

  const ps = env.DB.prepare('INSERT INTO products (name,type,volume_ml,abv,serve,base_price,moods,occasions,why,image,active) VALUES (?,?,?,?,?,?,?,?,?,?,1)');
  await chunk(env, PRODUCTS.map(p => ps.bind(p.name, p.type, p.volume_ml, p.abv, p.serve, p.base_price, JSON.stringify(p.moods), JSON.stringify(p.occasions), p.why, '')));

  const ss = env.DB.prepare('INSERT INTO shops (name,address,area,lat,lng,license_no,active) VALUES (?,?,?,?,?,?,1)');
  await chunk(env, SHOPS.map(s => ss.bind(s[0], s[1], s[2], s[3], s[4], s[5])));

  const prows = await env.DB.prepare('SELECT id FROM products ORDER BY id').all();
  const srows = await env.DB.prepare('SELECT id FROM shops ORDER BY id').all();
  const pid = (prows.results || []).map(r => r.id);
  const sid = (srows.results || []).map(r => r.id);

  const is = env.DB.prepare('INSERT INTO inventory (shop_id,product_id,price,stock) VALUES (?,?,?,?)');
  const inv = [];
  sid.forEach((shopId, si) => {
    PRODUCTS.forEach((p, i) => {
      const spread = [0, 20, -15][si] || 0;
      const price = Math.max(50, p.base_price + spread);
      const stock = ((i * 7 + (si + 1) * 3) % 25) + 3;
      inv.push(is.bind(shopId, pid[i], price, stock));
    });
  });
  await chunk(env, inv);

  return json({ ok: true, products: pid.length, shops: sid.length, inventory: inv.length });
}
