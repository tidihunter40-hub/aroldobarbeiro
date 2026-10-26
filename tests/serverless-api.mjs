import assert from 'node:assert/strict';
import handler from '../api/index.js';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'server-only-test-key';
process.env.AROLDO_ADMIN_PASSWORD = 'a-strong-test-password';

const calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url, body: JSON.parse(options.body), key: options.headers.apikey });
  if (url.endsWith('/aroldo_rate_limit')) return Response.json(true);
  if (url.endsWith('/aroldo_settings_read')) return Response.json({
    services: [], hours: [], daysOff: [], pendingMinutes: 30, adminConfigured: true
  });
  throw Error(`Unexpected RPC: ${url}`);
};

const post = (path, password, cookie) => new Request(`https://example.vercel.app${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify({ password })
});

const wrong = await handler.fetch(post('/api/admin/login', 'wrong-password'));
assert.equal(wrong.status, 401);

const login = await handler.fetch(post('/api/admin/login', process.env.AROLDO_ADMIN_PASSWORD));
assert.equal(login.status, 200);
const cookie = login.headers.get('set-cookie').split(';')[0];
assert.match(login.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);

const settings = await handler.fetch(new Request('https://example.vercel.app/api/admin/settings', { headers: { Cookie: cookie } }));
assert.equal(settings.status, 200);

const tampered = await handler.fetch(new Request('https://example.vercel.app/api/admin/settings', { headers: { Cookie: cookie + 'x' } }));
assert.equal(tampered.status, 401);

process.env.AROLDO_ADMIN_PASSWORD = 'another-strong-password';
const oldSession = await handler.fetch(new Request('https://example.vercel.app/api/admin/settings', { headers: { Cookie: cookie } }));
assert.equal(oldSession.status, 401);

const invalidDate = await handler.fetch(new Request('https://example.vercel.app/api/public/slots?day=2026-13-01&serviceId=1'));
assert.equal(invalidDate.status, 400);
assert.ok(calls.every(call => call.key === process.env.SUPABASE_SECRET_KEY));
console.log('Serverless API: autenticação, sessão, troca de senha e validação OK');
