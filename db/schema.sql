-- SipWise D1 schema
-- Run: wrangler d1 execute sipwise --file=db/schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  phone      TEXT UNIQUE NOT NULL,          -- E.164, e.g. +919876543210
  name       TEXT,
  created_at INTEGER NOT NULL               -- unix seconds
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,              -- random 32-byte hex
  user_id    INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS products (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,                 -- whisky/wine/gin/...
  volume_ml  INTEGER,
  abv        TEXT,
  serve      TEXT,
  base_price INTEGER NOT NULL,              -- ₹ indicative
  moods      TEXT,                          -- json array
  occasions  TEXT,                          -- json array
  why        TEXT,
  image      TEXT,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS shops (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  address    TEXT,
  area       TEXT,
  lat        REAL,
  lng        REAL,
  license_no TEXT,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS inventory (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id    INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  price      INTEGER NOT NULL,              -- shop's price (may differ from base)
  stock      INTEGER NOT NULL DEFAULT 0,
  UNIQUE(shop_id, product_id),
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL,
  shop_id          INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'created', -- created|paid|ready|collected|cancelled
  subtotal         INTEGER NOT NULL,
  convenience_fee  INTEGER NOT NULL,
  total            INTEGER NOT NULL,
  collect_code     TEXT,                    -- shown to user, verified at shop
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  created_at       INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  name       TEXT NOT NULL,
  qty        INTEGER NOT NULL,
  price      INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_shop ON inventory(shop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
