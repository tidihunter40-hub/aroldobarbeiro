import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, resolve, sep } from 'node:path';
import { createBookingApi, openBookingDb } from './booking-api.mjs';

const root = resolve('dist');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const send = (response, status, value, headers = {}) => response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }).end(JSON.stringify(value));
const body = async request => {
  let raw = '';
  for await (const chunk of request) { raw += chunk; if (raw.length > 12000) throw Object.assign(new Error('Dados muito grandes.'), { status: 413 }); }
  try { return JSON.parse(raw || '{}'); } catch { throw Object.assign(new Error('JSON inválido.'), { status: 400 }); }
};
const token = request => /(?:^|;\s*)aroldo_admin=([^;]+)/.exec(request.headers.cookie || '')?.[1];
const secure = request => request.socket.encrypted || request.headers['x-forwarded-proto'] === 'https';
const cookie = (request, value, maxAge) => `aroldo_admin=${value}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${maxAge}${secure(request) ? '; Secure' : ''}`;
const failedLogins = new Map();
const publicRequests = new Map();

export function createServer(dbPath = process.env.AROLDO_DB_PATH || resolve('data', 'bookings.sqlite')) {
  const db = openBookingDb(dbPath);
  const api = createBookingApi(db);
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const path = url.pathname;
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('X-Frame-Options', 'DENY');
      response.setHeader('Referrer-Policy', 'no-referrer');
      if (path.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(request.method)) {
          const origin = request.headers.origin;
          if (origin && new URL(origin).host !== request.headers.host) return send(response, 403, { error: 'Origem não autorizada.' });
          if (path !== '/api/admin/service-photo' && !String(request.headers['content-type'] || '').startsWith('application/json')) return send(response, 415, { error: 'Envie JSON.' });
        }
        if (path === '/api/public/config' && request.method === 'GET') return send(response, 200, api.publicConfig());
        if (path === '/api/public/agenda' && request.method === 'GET') return send(response, 200, { slots: api.agenda(url.searchParams.get('day')) });
        if (path === '/api/public/slots' && request.method === 'GET') return send(response, 200, { slots: api.slots(url.searchParams.get('day'), url.searchParams.get('serviceId')) });
        if (path === '/api/public/appointments' && request.method === 'POST') {
          const key = request.socket.remoteAddress || 'unknown';
          let record = publicRequests.get(key);
          if (!record || record.until <= Date.now()) record = { count: 0, until: Date.now() + 15 * 60 * 1000 };
          if (++record.count > 20) return send(response, 429, { error: 'Muitas solicitações. Tente mais tarde.' });
          publicRequests.set(key, record);
          return send(response, 201, api.request(await body(request)));
        }
        if (path === '/api/admin/login' && request.method === 'POST') {
          const key = request.socket.remoteAddress || 'unknown';
          let record = failedLogins.get(key) || { count: 0, until: 0 };
          if (record.until <= Date.now()) record = { count: 0, until: 0 };
          if (record.count >= 5 && record.until > Date.now()) return send(response, 429, { error: 'Tente novamente em 15 minutos.' });
          try {
            const session = api.login((await body(request)).password);
            failedLogins.delete(key);
            return send(response, 200, { ok: true }, { 'Set-Cookie': cookie(request, session, 43200) });
          } catch (cause) {
            if (cause.status === 401) {
              record.count += 1; record.until = Date.now() + 15 * 60 * 1000;
              failedLogins.set(key, record);
            }
            throw cause;
          }
        }
        const session = token(request);
        if (!path.startsWith('/api/admin/') || !api.authenticated(session)) return send(response, 401, { error: 'Entre no painel administrativo.' });
        if (path === '/api/admin/logout' && request.method === 'POST') { api.logout(session); return send(response, 200, { ok: true }, { 'Set-Cookie': cookie(request, '', 0) }); }
        if (path === '/api/admin/settings' && request.method === 'GET') return send(response, 200, api.settings());
        if (path === '/api/admin/settings' && request.method === 'PUT') return send(response, 200, api.updateSettings(await body(request)));
        if (path === '/api/admin/service-photo' && request.method === 'POST') {
          const type = request.headers['content-type'];
          const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
          if (!ext) return send(response, 415, { error: 'Escolha uma foto JPG, PNG ou WebP.' });
          const chunks = []; let size = 0;
          for await (const chunk of request) {
            size += chunk.length;
            if (size > 3145728) return send(response, 413, { error: 'Foto maior que 3 MB.' });
            chunks.push(chunk);
          }
          const bytes = Buffer.concat(chunks);
          const valid = type === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff :
            type === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
            bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
          if (!valid) return send(response, 400, { error: 'Arquivo de imagem inválido.' });
          const filename = `service-${randomUUID()}.${ext}`;
          await writeFile(resolve(root, 'assets', filename), bytes);
          return send(response, 201, { photoUrl: `./assets/${filename}` });
        }
        if (path === '/api/admin/appointments' && request.method === 'GET') return send(response, 200, { appointments: api.appointments(url.searchParams.get('from'), url.searchParams.get('to')) });
        if (path === '/api/admin/blocks' && request.method === 'POST') { const input = await body(request); return send(response, 201, api.block(input.day, input.time, Number(input.duration))); }
        const action = /^\/api\/admin\/appointments\/(\d+)\/(confirm|cancel)$/.exec(path);
        if (action && request.method === 'POST') return send(response, 200, api.decide(action[1], action[2]));
        const unblock = /^\/api\/admin\/blocks\/(\d+)$/.exec(path);
        if (unblock && request.method === 'DELETE') return send(response, 200, api.unblock(unblock[1]));
        return send(response, 404, { error: 'Rota não encontrada.' });
      }
      const screenPath = ['/agendamento', '/cortes', '/galeria', '/contato'].includes(path) ? '/index.html' : path;
      const file = resolve(root, '.' + decodeURIComponent(screenPath.replace(/\/$/, '/index.html')));
      if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
      const content = await readFile(file);
      response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': file.endsWith('admin.html') || file.endsWith('admin.js') ? 'no-store' : file.endsWith('.html') || file.endsWith('.js') ? 'no-cache' : 'public, max-age=3600' }).end(content);
    } catch (cause) {
      const status = cause.status || (cause.code === 'ENOENT' ? 404 : 500);
      if (status === 500) console.error(cause);
      send(response, status, { error: status === 500 ? 'Erro interno.' : cause.message });
    }
  });
  server.on('close', () => db.close());
  return server;
}
