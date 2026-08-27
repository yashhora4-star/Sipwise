# SipWise

India liquor marketplace — **recommend & collect**. Discover a bottle by mood /
occasion / budget, pay online, collect from a licensed store near you. No delivery.

Full, real stack (no mock data):

- **Storefront** — `public/index.html`: 173-bottle shelf from the API, natural-language
  search, occasions, Circles, cart, real OTP sign-in, Razorpay checkout, collect code.
- **API** — Cloudflare Pages Functions in `functions/api/`:
  - `auth/*` — OTP sign-in (Twilio Verify / MSG91 / dev), signed session cookies
  - `products`, `shops`, `orders` — catalogue + ordering from D1
  - `pay/*` — Razorpay order create, signature verify, webhook
  - `admin/*` — bearer-key-protected ops (orders, shops, inventory, stats)
- **Database** — Cloudflare D1 (SQLite). Schema + seed in `db/`.
- **Admin console** — `/admin`.

**Setup and going live: see [SETUP.md](./SETUP.md).**

Quick local run:
```bash
cp .dev.vars.example .dev.vars
npm install
npm run db:schema:local && npm run db:seed:local
npm run dev     # OTP code in dev mode is 123456
```
