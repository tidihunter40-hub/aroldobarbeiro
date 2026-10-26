import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const zone = 'America/Bahia';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const validDay = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const minute = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '') ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN;
const response = (value, status = 200, headers = {}) => Response.json(value, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', ...headers }
});
const cookie = (token, age) => `aroldo_admin=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=${age}`;

async function rpc(name, data = {}) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) fail(503, 'Banco ainda não configurado.');
  const result = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(data), cache: 'no-store'
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) {
    if (result.status === 404 || payload.code === 'PGRST202') fail(503, 'Banco ainda não preparado.');
    const message = payload.message || 'Falha ao consultar a agenda.';
    if (/Horário indisponível|conflito|expirada|já cancelado/i.test(message)) fail(409, message);
    if (/não encontrada|não encontrado/i.test(message)) fail(404, message);
    if (result.status >= 500 && payload.code !== 'P0001') fail(503, 'Agenda temporariamente indisponível.');
    fail(400, message);
  }
  return payload;
}

function requireConfig() {
  if (!process.env.AROLDO_ADMIN_PASSWORD || process.env.AROLDO_ADMIN_PASSWORD.length < 12 ||
      !process.env.SUPABASE_SECRET_KEY) fail(503, 'Administração ainda não configurada.');
}
function sign(value) {
  const key = createHmac('sha256', process.env.SUPABASE_SECRET_KEY).update('aroldo-admin-session-v1').digest();
  return createHmac('sha256', key).update(value).digest('base64url');
}
function makeSession() {
  const data = Buffer.from(JSON.stringify({ exp: Date.now() + 12 * 60 * 60 * 1000,
    version: sign(`password:${process.env.AROLDO_ADMIN_PASSWORD}`) })).toString('base64url');
  return `${data}.${sign(data)}`;
}
function authenticated(request) {
  const session = /(?:^|;\s*)aroldo_admin=([^;]+)/.exec(request.headers.get('cookie') || '')?.[1];
  if (!session || !process.env.SUPABASE_SECRET_KEY || !process.env.AROLDO_ADMIN_PASSWORD) return false;
  const [data, signature] = session.split('.');
  if (!data || !signature) return false;
  const expected = Buffer.from(sign(data));
  const supplied = Buffer.from(signature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    return payload.exp > Date.now() && payload.version === sign(`password:${process.env.AROLDO_ADMIN_PASSWORD}`);
  }
  catch { return false; }
}
function checkPassword(value) {
  const expected = Buffer.from(sign(`login:${process.env.AROLDO_ADMIN_PASSWORD}`));
  const actual = Buffer.from(sign(`login:${String(value || '')}`));
  return timingSafeEqual(expected, actual);
}
async function body(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, 'Envie JSON.');
  const raw = await request.text();
  if (raw.length > 12000) fail(413, 'Dados muito grandes.');
  try { return JSON.parse(raw || '{}'); } catch { fail(400, 'JSON inválido.'); }
}
async function rateLimit(request, scope, max) {
  requireConfig();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const hash = createHash('sha256').update(`${scope}:${ip}:${sign('rate-limit')}`).digest('hex');
  if (!await rpc('aroldo_rate_limit', { p_scope: scope, p_client_hash: hash, p_max: max })) fail(429, 'Muitas solicitações. Tente mais tarde.');
}
function checkRange(day) {
  if (!validDay(day)) fail(400, 'Data inválida.');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const delta = (Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000;
  if (delta < 0 || delta > 60) fail(400, 'Escolha uma data nos próximos 60 dias.');
}
function validateSettings(input, known) {
  const { hours, services, daysOff } = input;
  const ttl = Number(input.pendingMinutes);
  if (!Array.isArray(hours) || hours.length !== 7 || !Array.isArray(services) ||
      services.length < known.services.length || services.length > 40 || !Array.isArray(daysOff) ||
      !Number.isInteger(ttl) || ttl < 5 || ttl > 1440) fail(400, 'Configuração inválida.');
  if (services.some(s => (s.id != null && !known.services.some(k => k.id === Number(s.id))) ||
      typeof s.name !== 'string' || s.name.trim().length < 2 || s.name.trim().length > 80 ||
      (s.priceCents != null && (!Number.isInteger(Number(s.priceCents)) || Number(s.priceCents) < 0 || Number(s.priceCents) > 10000000)) ||
      (s.photoUrl != null && (typeof s.photoUrl !== 'string' || !/^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/aroldo-services\/[a-f0-9-]+\.(?:jpg|png|webp)$/.test(s.photoUrl))) ||
      (s.enabled && (s.priceCents == null || !s.photoUrl)) ||
      !Number.isInteger(Number(s.duration)) || Number(s.duration) < 30 ||
      Number(s.duration) > 480 || Number(s.duration) % 30)) fail(400, 'Duração de serviço inválida.');
  const currentIds = services.filter(s => s.id != null).map(s => Number(s.id));
  if (new Set(currentIds).size !== known.services.length ||
      known.services.some(s => !currentIds.includes(s.id)) ||
      new Set(services.map(s => s.name.trim().toLocaleLowerCase('pt-BR'))).size !== services.length)
    fail(400, 'Serviços duplicados ou ausentes.');
  if (hours.some((h, i) => Number(h.weekday) !== i ||
      ((h.opens || h.closes) && !(Number.isFinite(minute(h.opens)) && Number.isFinite(minute(h.closes)) && minute(h.opens) < minute(h.closes))) ||
      ((h.breakStart || h.breakEnd) && !(Number.isFinite(minute(h.breakStart)) && Number.isFinite(minute(h.breakEnd)) &&
        minute(h.opens) <= minute(h.breakStart) && minute(h.breakStart) < minute(h.breakEnd) && minute(h.breakEnd) <= minute(h.closes)))))
    fail(400, 'Expediente ou intervalo inválido.');
  if (daysOff.some(day => !validDay(day))) fail(400, 'Dia sem atendimento inválido.');
  const origin = process.env.SUPABASE_URL?.replace(/\/$/, '');
  if (services.some(s => s.photoUrl && !s.photoUrl.startsWith(`${origin}/storage/v1/object/public/aroldo-services/`)))
    fail(400, 'Foto fora da biblioteca de serviços.');
  return { hours, services: services.map(s => ({ id: s.id ?? null, name: s.name.trim(), duration: Number(s.duration),
    enabled: Boolean(s.enabled), priceCents: s.priceCents == null ? null : Number(s.priceCents), photoUrl: s.photoUrl || null })),
    daysOff, pendingMinutes: ttl };
}

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      if (!['GET', 'HEAD'].includes(request.method)) {
        const origin = request.headers.get('origin');
        if (origin && new URL(origin).host !== url.host) fail(403, 'Origem não autorizada.');
      }
      if (path === '/api/public/config' && request.method === 'GET') {
        const settings = await rpc('aroldo_settings_read');
        return response({ services: settings.services.filter(x => x.enabled),
          configured: settings.hours.some(x => x.opens && x.closes) && settings.services.some(x => x.enabled),
          pendingMinutes: settings.pendingMinutes, timeZone: zone });
      }
      if (path === '/api/public/agenda' && request.method === 'GET') {
        const day = url.searchParams.get('day'); checkRange(day);
        return response({ slots: await rpc('aroldo_agenda', { p_day: day }) });
      }
      if (path === '/api/public/slots' && request.method === 'GET') {
        const day = url.searchParams.get('day'); checkRange(day);
        const serviceId = Number(url.searchParams.get('serviceId'));
        if (!Number.isInteger(serviceId)) fail(400, 'Serviço indisponível.');
        return response({ slots: await rpc('aroldo_slots', { p_day: day, p_service_id: serviceId }) });
      }
      if (path === '/api/public/appointments' && request.method === 'POST') {
        await rateLimit(request, 'public', 20);
        const input = await body(request);
        const day = String(input.day || ''); checkRange(day);
        const start = minute(input.time);
        const name = String(input.name || '').trim();
        const phone = String(input.phone || '').replace(/\D/g, '');
        const serviceId = Number(input.serviceId);
        if (!Number.isFinite(start) || start % 30 || name.length < 2 || name.length > 80 ||
            !/^\d{10,13}$/.test(phone) || !Number.isInteger(serviceId)) fail(400, 'Revise nome, telefone e horário.');
        return response(await rpc('aroldo_request', { p_service_id: serviceId, p_day: day,
          p_start: start, p_name: name, p_phone: phone }), 201);
      }
      if (path === '/api/admin/login' && request.method === 'POST') {
        requireConfig();
        await rateLimit(request, 'admin-login', 5);
        if (!checkPassword((await body(request)).password)) fail(401, 'Senha incorreta.');
        return response({ ok: true }, 200, { 'Set-Cookie': cookie(makeSession(), 43200) });
      }
      if (!path.startsWith('/api/admin/') || !authenticated(request)) fail(401, 'Entre no painel administrativo.');
      if (path === '/api/admin/logout' && request.method === 'POST') return response({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
      if (path === '/api/admin/settings' && request.method === 'GET') return response(await rpc('aroldo_settings_read'));
      if (path === '/api/admin/settings' && request.method === 'PUT') {
        const input = validateSettings(await body(request), await rpc('aroldo_settings_read'));
        return response(await rpc('aroldo_settings_update', { p_input: input }));
      }
      if (path === '/api/admin/service-photo' && request.method === 'POST') {
        const type = request.headers.get('content-type') || '';
        const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
        if (!extensions[type]) fail(415, 'Escolha uma foto JPG, PNG ou WebP.');
        if (Number(request.headers.get('content-length')) > 3145728) fail(413, 'Foto maior que 3 MB.');
        const bytes = Buffer.from(await request.arrayBuffer());
        if (!bytes.length || bytes.length > 3145728) fail(413, 'Foto vazia ou maior que 3 MB.');
        const valid = type === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff :
          type === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
          bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
        if (!valid) fail(400, 'Arquivo de imagem inválido.');
        const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
        const key = process.env.SUPABASE_SECRET_KEY;
        if (!base || !key) fail(503, 'Banco ainda não configurado.');
        const filename = `${randomUUID()}.${extensions[type]}`;
        const uploaded = await fetch(`${base}/storage/v1/object/aroldo-services/${filename}`, {
          method: 'POST', headers: { apikey: key, 'Content-Type': type, 'Cache-Control': 'max-age=31536000' }, body: bytes
        });
        if (!uploaded.ok) fail(503, 'Não foi possível salvar a foto. Confira a migração do banco.');
        return response({ photoUrl: `${base}/storage/v1/object/public/aroldo-services/${filename}` }, 201);
      }
      if (path === '/api/admin/appointments' && request.method === 'GET') {
        const from = url.searchParams.get('from'), to = url.searchParams.get('to');
        if (!validDay(from) || !validDay(to) || from > to) fail(400, 'Período inválido.');
        return response({ appointments: await rpc('aroldo_appointments_read', { p_from: from, p_to: to }) });
      }
      if (path === '/api/admin/blocks' && request.method === 'POST') {
        const input = await body(request);
        const day = String(input.day || ''); checkRange(day);
        const start = minute(input.time), duration = Number(input.duration);
        if (!Number.isFinite(start) || start % 30 || !Number.isInteger(duration) || duration < 30 || duration > 480 || duration % 30)
          fail(400, 'Hora ou duração inválida.');
        return response(await rpc('aroldo_block', { p_day: day, p_start: start, p_duration: duration }), 201);
      }
      const decision = /^\/api\/admin\/appointments\/(\d+)\/(confirm|cancel)$/.exec(path);
      if (decision && request.method === 'POST') return response(await rpc('aroldo_decide', { p_id: Number(decision[1]), p_action: decision[2] }));
      const unblock = /^\/api\/admin\/blocks\/(\d+)$/.exec(path);
      if (unblock && request.method === 'DELETE') return response(await rpc('aroldo_unblock', { p_id: Number(unblock[1]) }));
      fail(404, 'Rota não encontrada.');
    } catch (cause) {
      if (!cause.status) console.error(cause);
      return response({ error: cause.status ? cause.message : 'Erro interno.' }, cause.status || 500);
    }
  }
};
