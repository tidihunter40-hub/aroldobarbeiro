import assert from 'node:assert/strict';
import handler from '../api/index.js';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'server-only-test-key';
process.env.AROLDO_ADMIN_PASSWORD = 'a-strong-test-password';

const calls = [];
const baseSettings = { services: [{ id: 1, name: 'Corte masculino', duration: 30, enabled: false, priceCents: null, photoUrl: null }],
  hours: Array.from({ length: 7 }, (_, weekday) => ({ weekday, opens: null, closes: null, breakStart: null, breakEnd: null })),
  daysOff: [], specialHours: [], slotMinutes: 30, pendingMinutes: 30, adminConfigured: true };
globalThis.fetch = async (url, options) => {
  calls.push({ url, body: url.includes('/storage/') ? null : JSON.parse(options.body), key: options.headers.apikey });
  if (url.endsWith('/aroldo_rate_limit')) return Response.json(true);
  if (url.endsWith('/aroldo_agenda')) return Response.json([{ time: '09:00', status: 'available' }]);
  if (url.includes('/storage/v1/object/aroldo-services/')) return Response.json({ Key: 'uploaded' }, { status: 200 });
  if (url.endsWith('/aroldo_settings_read')) return Response.json(baseSettings);
  if (url.endsWith('/aroldo_settings_update')) return Response.json(options.body ? JSON.parse(options.body).p_input : {});
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

const putSettings = value => handler.fetch(new Request('https://example.vercel.app/api/admin/settings', {
  method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(value)
}));
const missingPhoto = await putSettings({ ...baseSettings, services: [{ ...baseSettings.services[0], enabled: true, priceCents: 3000 }] });
assert.equal(missingPhoto.status, 400);
const validCatalog = await putSettings({ ...baseSettings, services: [baseSettings.services[0], {
  id: null, name: 'Novo serviço', duration: 60, enabled: true, priceCents: 4500,
  photoUrl: 'https://example.supabase.co/storage/v1/object/public/aroldo-services/abcdef12-3456-4567-8901-abcdef123456.jpg'
}] });
assert.equal(validCatalog.status, 200);
const priceToConfirm = await putSettings({ ...baseSettings, services: [baseSettings.services[0], {
  id: null, name: 'Barba', duration: 30, enabled: true, priceCents: null,
  photoUrl: 'https://example.supabase.co/storage/v1/object/public/aroldo-services/abcdef12-3456-4567-8901-abcdef123456.jpg'
}] });
assert.equal(priceToConfirm.status, 200);
const aiDraft = await putSettings({ ...baseSettings, services: [baseSettings.services[0], {
  id: null, name: 'Degradê Baixo', duration: 30, enabled: false, priceCents: 3500,
  photoUrl: './assets/cortes-ia/01_degrade_baixo.jpg', description: 'Imagem ilustrativa gerada por IA'
}], specialHours: [{ day: '2026-11-02', opens: '09:00', closes: '16:00', breakStart: '12:00', breakEnd: '13:00' }], slotMinutes: 15 });
assert.equal(aiDraft.status, 200);
const duplicateSpecial = await putSettings({ ...baseSettings, specialHours: [
  { day: '2026-11-02', opens: '09:00', closes: '16:00' },
  { day: '2026-11-02', opens: '10:00', closes: '17:00' }
] });
assert.equal(duplicateSpecial.status, 400);

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const agenda = await handler.fetch(new Request(`https://example.vercel.app/api/public/agenda?day=${today}`));
assert.equal(agenda.status, 200);
assert.equal((await agenda.json()).slots[0].time, '09:00');
const unauthorizedPhoto = await handler.fetch(new Request('https://example.vercel.app/api/admin/service-photo', {
  method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: Buffer.from([0xff, 0xd8, 0xff, 0x00])
}));
assert.equal(unauthorizedPhoto.status, 401);
const photo = await handler.fetch(new Request('https://example.vercel.app/api/admin/service-photo', {
  method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'image/jpeg' }, body: Buffer.from([0xff, 0xd8, 0xff, 0x00])
}));
assert.equal(photo.status, 201);
assert.match((await photo.json()).photoUrl, /^https:\/\/example\.supabase\.co\/storage\/v1\/object\/public\/aroldo-services\//);

const tampered = await handler.fetch(new Request('https://example.vercel.app/api/admin/settings', { headers: { Cookie: cookie + 'x' } }));
assert.equal(tampered.status, 401);

process.env.AROLDO_ADMIN_PASSWORD = 'another-strong-password';
const oldSession = await handler.fetch(new Request('https://example.vercel.app/api/admin/settings', { headers: { Cookie: cookie } }));
assert.equal(oldSession.status, 401);

const invalidDate = await handler.fetch(new Request('https://example.vercel.app/api/public/slots?day=2026-13-01&serviceId=1'));
assert.equal(invalidDate.status, 400);
assert.ok(calls.every(call => call.key === process.env.SUPABASE_SECRET_KEY));
console.log('Serverless API: autenticação, sessão, troca de senha e validação OK');
