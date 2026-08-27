# SipWise — going live for real

This is a real backend, not a demo. Everything runs on Cloudflare (one platform):
static storefront + serverless API (Pages Functions) + D1 database.

You do the account steps below. I never touch your keys — you paste them into
Cloudflare and the provider dashboards yourself.

---

## 0. What's in the box

```
public/          storefront (index.html) + admin console (admin.html → /admin)
functions/api/   the real API — auth, orders, payments, admin
db/              schema.sql, catalog.json, gen-seed.js (→ seed.sql: 173 bottles, 3 shops)
wrangler.toml    Cloudflare config (D1 binding)
package.json     handy npm scripts
```

## 1. One-time tools

```bash
npm install -g wrangler
wrangler login          # opens browser, log into your Cloudflare account
```

## 2. Create the database

```bash
wrangler d1 create sipwise
```

Copy the printed `database_id` into **wrangler.toml** (replace `REPLACE_WITH_YOUR_D1_ID`).

Load tables + the 173-bottle catalogue (remote/production DB):

```bash
npm run db:schema      # creates tables
npm run db:seed        # loads products, 3 Noida shops, inventory
```

## 3. Deploy the site

Two ways — pick one.

**A) Auto-deploy from GitHub (recommended — ends manual drag-uploads)**
1. Push this folder to a GitHub repo.
2. Cloudflare dashboard → **Pages → Create → Connect to Git** → pick the repo.
3. Build command: *(leave empty)*  ·  Build output directory: `public`
4. After first build: **Settings → Functions → D1 database bindings** → add
   `DB` → database `sipwise`.
5. Every `git push` to `main` now deploys automatically.

**B) Manual (one command, no GitHub)**
```bash
npm run deploy
```
Then add the D1 binding as in A.4.

## 4. Secrets (add in Cloudflare → Pages → your project → Settings → Variables & Secrets)

Or from the CLI, e.g. `wrangler pages secret put ADMIN_KEY --project-name sipwise`.

| Name | What | Required |
|---|---|---|
| `ADMIN_KEY` | any long random string — the password for `/admin` | yes |
| `OTP_PROVIDER` | `twilio` or `msg91` (leave unset = dev mode) | yes for real OTP |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | from Razorpay dashboard | yes for payments |
| `RAZORPAY_WEBHOOK_SECRET` | you set it when creating the webhook | recommended |

### OTP — pick one provider

**MSG91 (recommended for India — DLT-registered, cheaper SMS):**
`OTP_PROVIDER=msg91`, plus `MSG91_AUTHKEY` and `MSG91_TEMPLATE_ID`
(create an OTP template in the MSG91 panel, get it DLT-approved).

**Twilio Verify:**
`OTP_PROVIDER=twilio`, plus `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and
`TWILIO_VERIFY_SID` (Twilio Console → Verify → create a Service).
Note: SMS to Indian numbers still needs DLT sender registration.

### Razorpay — payments
1. Razorpay dashboard → **Settings → API Keys** → generate → paste both keys as secrets.
2. **Settings → Webhooks → Add** → URL `https://<your-domain>/api/pay/webhook`,
   secret = your `RAZORPAY_WEBHOOK_SECRET`, event `payment.captured`.
3. ⚠️ **Alcohol is a restricted category.** You must get your account approved for
   liquor and hold the retail licence / model-shop tie-ups before accepting real
   money. Until approved, keep Razorpay in **Test mode** — the flow works end to end
   with test cards.

## 5. Admin console

Go to `https://<your-domain>/admin`, enter your `ADMIN_KEY`. You can:
- see live orders, mark them **ready**, and verify the customer's **collect code**;
- add/edit shops (name, area, licence no.);
- edit per-shop price & stock for any of the 173 products;
- watch users / GMV / revenue on the dashboard.

---

## Run it locally first (no accounts needed)

```bash
cp .dev.vars.example .dev.vars     # OTP_PROVIDER=dev by default
npm run db:schema:local
npm run db:seed:local
npm run dev                        # http://127.0.0.1:8788
```
In dev mode the OTP is always **123456**. Payments show "not configured" (add
Razorpay test keys to `.dev.vars` to exercise checkout).

---

## How the money works
- Customer pays online: **item price (store's live rate) + 5% convenience fee (min ₹49)**.
- On payment success the server issues a 6-digit **collect code** and drops stock.
- Customer collects in person; the shop verifies age + the code in `/admin`.
- Shop commission is a settlement you run separately (not automated yet).

## Honest gaps before real selling
- **Prices are indicative** — set real per-shop prices in `/admin` before launch.
- **Licence & compliance** — real model-shop agreements, retail licence, and
  Razorpay liquor approval are yours to secure; the software assumes they exist.
- **Photos** are free stock (Unsplash) — fine to launch, license/own them later.
