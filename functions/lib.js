// Shared helpers for SipWise Pages Functions

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  });
}

export function bad(msg, status = 400) {
  return json({ ok: false, error: msg }, status);
}

export function now() {
  return Math.floor(Date.now() / 1000);
}

export function hex(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

// phone -> E.164 India default (+91). Accepts 10-digit or already-prefixed.
export function normPhone(raw) {
  const d = String(raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d;
  const only = d.replace(/\D/g, '');
  if (only.length === 10) return '+91' + only;
  if (only.length === 12 && only.startsWith('91')) return '+' + only;
  return null;
}

export function getCookie(request, name) {
  const c = request.headers.get('Cookie') || '';
  const m = c.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

export function sessionCookie(token, maxAge = 60 * 60 * 24 * 30) {
  // Secure, HttpOnly, SameSite=Lax
  return `sw_session=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
export function clearCookie() {
  return `sw_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

// Returns { id, phone, name } or null
export async function currentUser(env, request) {
  const token = getCookie(request, 'sw_session');
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.phone, u.name, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`
  ).bind(token).first();
  if (!row) return null;
  if (row.expires_at < now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }
  return { id: row.id, phone: row.phone, name: row.name };
}

// ---------- OTP providers ----------
// env.OTP_PROVIDER = 'twilio' | 'msg91' | 'dev'

export async function otpSend(env, phone) {
  const p = (env.OTP_PROVIDER || 'dev').toLowerCase();
  if (p === 'twilio') {
    const sid = env.TWILIO_ACCOUNT_SID, tok = env.TWILIO_AUTH_TOKEN, svc = env.TWILIO_VERIFY_SID;
    const r = await fetch(`https://verify.twilio.com/v2/Services/${svc}/Verifications`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${sid}:${tok}`),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, Channel: 'sms' }),
    });
    if (!r.ok) return { ok: false, error: 'otp_send_failed', detail: await r.text() };
    return { ok: true };
  }
  if (p === 'msg91') {
    const r = await fetch(`https://control.msg91.com/api/v5/otp?otp_length=6&mobile=${encodeURIComponent(phone.replace('+', ''))}&template_id=${env.MSG91_TEMPLATE_ID}`, {
      method: 'POST',
      headers: { authkey: env.MSG91_AUTHKEY, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const j = await r.json().catch(() => ({}));
    if (j.type === 'success') return { ok: true };
    return { ok: false, error: 'otp_send_failed', detail: j };
  }
  // dev: no SMS sent, fixed code 123456
  return { ok: true, dev: true };
}

export async function otpCheck(env, phone, code) {
  const p = (env.OTP_PROVIDER || 'dev').toLowerCase();
  if (p === 'twilio') {
    const sid = env.TWILIO_ACCOUNT_SID, tok = env.TWILIO_AUTH_TOKEN, svc = env.TWILIO_VERIFY_SID;
    const r = await fetch(`https://verify.twilio.com/v2/Services/${svc}/VerificationCheck`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${sid}:${tok}`),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, Code: code }),
    });
    const j = await r.json().catch(() => ({}));
    return j.status === 'approved';
  }
  if (p === 'msg91') {
    const r = await fetch(`https://control.msg91.com/api/v5/otp/verify?otp=${encodeURIComponent(code)}&mobile=${encodeURIComponent(phone.replace('+', ''))}`, {
      headers: { authkey: env.MSG91_AUTHKEY },
    });
    const j = await r.json().catch(() => ({}));
    return j.type === 'success';
  }
  // dev
  return code === '123456';
}

// Create/find user, open session, return {token, user}
export async function openSession(env, phone) {
  let u = await env.DB.prepare('SELECT id, phone, name FROM users WHERE phone = ?').bind(phone).first();
  if (!u) {
    const r = await env.DB.prepare('INSERT INTO users (phone, name, created_at) VALUES (?,?,?)')
      .bind(phone, null, now()).run();
    u = { id: r.meta.last_row_id, phone, name: null };
  }
  const token = hex(32);
  const exp = now() + 60 * 60 * 24 * 30;
  await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?,?,?,?)')
    .bind(token, u.id, exp, now()).run();
  return { token, user: u };
}
