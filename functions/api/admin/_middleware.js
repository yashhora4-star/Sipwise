// Guards every /api/admin/* route with a bearer key.
// Set ADMIN_KEY as a secret in Cloudflare.
export async function onRequest({ request, env, next }) {
  const auth = request.headers.get('Authorization') || '';
  const key = auth.replace(/^Bearer\s+/i, '');
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  }
  return next();
}
