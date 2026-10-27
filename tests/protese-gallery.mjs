import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { createServer } from '../app-server.mjs';
import { openBookingDb, setAdminPassword, createBookingApi } from '../booking-api.mjs';

const root = resolve('.');
const dir = mkdtempSync(join(root, '.test-gallery-'));
const dbPath = join(dir, 'gallery.sqlite');
let server;
try {
  const db = openBookingDb(dbPath);
  setAdminPassword(db, 'senha-local-de-teste-123');
  const api = createBookingApi(db);
  const settings = api.settings();
  const assessment = settings.services.find(item => item.name === 'Avaliação de Prótese Capilar');
  assert.ok(assessment);
  assessment.enabled = true;
  settings.hours[1] = { weekday: 1, opens: '08:00', closes: '12:00', breakStart: null, breakEnd: null };
  api.updateSettings(settings);
  assert.ok(api.publicConfig().services.some(item => item.name === assessment.name));
  db.close();

  server = createServer(dbPath);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const get = path => fetch(origin + path).then(async response => ({ status: response.status, data: await response.json() }));
  const initial = await get('/api/public/gallery');
  assert.equal(initial.status, 200);
  assert.deepEqual(initial.data.transformations, []);
  const unauthorized = await get('/api/admin/gallery');
  assert.equal(unauthorized.status, 401);
  const login = await fetch(origin + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'senha-local-de-teste-123' }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const payload = { intro: 'Uma nova versão de você começa aqui.', description: 'Avaliação personalizada.', transformations: [{ caption: 'Resultado autorizado', before: './assets/service-11111111-1111-4111-8111-111111111111.jpg', after: './assets/service-22222222-2222-4222-8222-222222222222.jpg' }], covers: { barbas: './assets/service-33333333-3333-4333-8333-333333333333.jpg' }, works: { outros: [{ caption: 'Trabalho cadastrado', src: './assets/service-44444444-4444-4444-8444-444444444444.jpg' }] } };
  const persistedPayload = { ...payload, works: { cortes: [], visagismo: [], proteses: [], barbas: [], outros: payload.works.outros } };
  const put = value => fetch(origin + '/api/admin/gallery', { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(value) });
  assert.equal((await put({ ...payload, transformations: [{ ...payload.transformations[0], after: './assets/concept-protese.jpg' }] })).status, 400, 'Imagem ilustrativa não pode constar como resultado');
  assert.equal((await put(payload)).status, 200);
  assert.deepEqual((await get('/api/public/gallery')).data, persistedPayload);
  await new Promise(resolve => server.close(resolve)); server = null;
  server = createServer(dbPath);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const persisted = await fetch(`http://127.0.0.1:${server.address().port}/api/public/gallery`).then(response => response.json());
  assert.deepEqual(persisted, persistedPayload);
  console.log('Galeria: capas, trabalhos, autorização, validação e persistência local OK');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (dir.startsWith(root + sep)) rmSync(dir, { recursive: true, force: true });
}
