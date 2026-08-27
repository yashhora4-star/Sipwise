// Generates db/seed.sql from catalog.json
// Run: node db/gen-seed.js
const fs = require('fs');
const path = require('path');
const CAT = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog.json'), 'utf8'));

const esc = s => (s == null ? '' : String(s).replace(/'/g, "''"));

// map "Whisky · 750 ml" -> type + volume
function parseC(c) {
  const parts = (c || '').split('·');
  const type = (parts[0] || '').trim().toLowerCase();
  const vol = parseInt((parts[1] || '').replace(/[^0-9]/g, ''), 10) || 750;
  // normalise type to a coarse category
  let t = 'other';
  const s = type;
  if (s.includes('whisky') || s.includes('whiskey') || s.includes('scotch') || s.includes('bourbon')) t = 'whisky';
  else if (s.includes('wine') || s.includes('port') || s.includes('rosé') || s.includes('rose')) t = 'wine';
  else if (s.includes('gin')) t = 'gin';
  else if (s.includes('rum')) t = 'rum';
  else if (s.includes('vodka')) t = 'vodka';
  else if (s.includes('beer') || s.includes('lager') || s.includes('ale') || s.includes('stout')) t = 'beer';
  else if (s.includes('champagne') || s.includes('sparkl') || s.includes('prosecco') || s.includes('cava')) t = 'sparkling';
  else if (s.includes('tequila') || s.includes('mezcal')) t = 'tequila';
  else if (s.includes('brandy') || s.includes('cognac')) t = 'brandy';
  else if (s.includes('liqueur') || s.includes('vermouth') || s.includes('aperitif')) t = 'liqueur';
  return { t, vol, label: type };
}
function abvFor(t) {
  return ({ whisky: '40–43%', wine: '12–14%', gin: '40–47%', rum: '40–43%', vodka: '40%', beer: '4–8%', sparkling: '11–12%', tequila: '38–40%', brandy: '36–40%', liqueur: '15–25%' }[t]) || '—';
}
function serveFor(t) {
  return ({ whisky: 'Neat / rocks', wine: 'Chilled 14°C', gin: 'With tonic', rum: 'Rocks / cola', vodka: 'Chilled shot', beer: 'Cold 4°C', sparkling: 'Flute, cold', tequila: 'Shot / margarita', brandy: 'Warm snifter', liqueur: 'Digestif' }[t]) || 'Chilled';
}

let sql = '-- Generated seed. Run after schema.sql\nBEGIN TRANSACTION;\n';

// products
CAT.forEach(b => {
  const p = parseC(b.c);
  sql += `INSERT INTO products (name,type,volume_ml,abv,serve,base_price,moods,occasions,why,image,active) VALUES ('${esc(b.n)}','${p.t}',${p.vol},'${esc(abvFor(p.t))}','${esc(serveFor(p.t))}',${b.base|0},'${esc(JSON.stringify(b.moods || []))}','${esc(JSON.stringify(b.occ || []))}','${esc(b.why)}','',1);\n`;
});

// shops (Noida sample — real ones replaced via admin later)
const shops = [
  ['Atta Market Wines', 'Sector 18, Atta Market, Noida', 'Sector 18', 28.5708, 77.3260, 'UP-NDA-0001'],
  ['Sector 62 Liquor Mart', 'Near Fortis Hospital, Sector 62, Noida', 'Sector 62', 28.6272, 77.3720, 'UP-NDA-0002'],
  ['The Cellar, Sector 104', 'Noida Expressway, Sector 104', 'Sector 104', 28.5460, 77.3640, 'UP-NDA-0003'],
];
shops.forEach(s => {
  sql += `INSERT INTO shops (name,address,area,lat,lng,license_no,active) VALUES ('${esc(s[0])}','${esc(s[1])}','${esc(s[2])}',${s[3]},${s[4]},'${esc(s[5])}',1);\n`;
});

// inventory: each shop stocks every product, price = base (+/- small spread), stock random-ish but deterministic
for (let shopId = 1; shopId <= shops.length; shopId++) {
  CAT.forEach((b, i) => {
    const spread = [(0), (20), (-15)][shopId - 1] || 0;
    const price = Math.max(50, (b.base | 0) + spread);
    const stock = ((i * 7 + shopId * 3) % 25) + 3; // 3..27 deterministic
    sql += `INSERT INTO inventory (shop_id,product_id,price,stock) VALUES (${shopId},${i + 1},${price},${stock});\n`;
  });
}

sql += 'COMMIT;\n';
fs.writeFileSync(path.join(__dirname, 'seed.sql'), sql);
console.log('Wrote seed.sql —', CAT.length, 'products,', shops.length, 'shops,', CAT.length * shops.length, 'inventory rows');
