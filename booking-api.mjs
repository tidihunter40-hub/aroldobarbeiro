import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const TIME_ZONE = 'America/Bahia';
const SERVICE_NAMES = ['Corte masculino', 'Barba', 'Corte infantil', 'Platinado', 'Desondulação capilar', 'Freestyle', 'Visagismo', 'Prótese capilar'];
const DAY_MS = 86400000;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const minute = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '') ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN;
const time = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const digest = value => createHash('sha256').update(value).digest('hex');
const error = (status, message) => Object.assign(new Error(message), { status });

export function openBookingDb(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, duration INTEGER NOT NULL DEFAULT 30, enabled INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS hours (weekday INTEGER PRIMARY KEY CHECK(weekday BETWEEN 0 AND 6), opens TEXT, closes TEXT, break_start TEXT, break_end TEXT);
    CREATE TABLE IF NOT EXISTS days_off (day TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY, day TEXT NOT NULL, starts INTEGER NOT NULL, ends INTEGER NOT NULL, service_id INTEGER, client_name TEXT, phone TEXT, status TEXT NOT NULL CHECK(status IN ('pending','confirmed','cancelled','blocked')), expires_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY(service_id) REFERENCES services(id));
    CREATE INDEX IF NOT EXISTS appointments_day ON appointments(day,status,starts,ends);
    CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
  `);
  const columns = db.prepare('PRAGMA table_info(services)').all().map(column => column.name);
  if (!columns.includes('price_cents')) db.exec('ALTER TABLE services ADD COLUMN price_cents INTEGER');
  if (!columns.includes('photo_url')) db.exec('ALTER TABLE services ADD COLUMN photo_url TEXT');
  const insert = db.prepare('INSERT OR IGNORE INTO services(name) VALUES (?)');
  for (const name of SERVICE_NAMES) insert.run(name);
  for (let day = 0; day < 7; day++) db.prepare('INSERT OR IGNORE INTO hours(weekday) VALUES (?)').run(day);
  db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES ('pending_minutes','30')").run();
  return db;
}

export function setAdminPassword(db, password) {
  if (typeof password !== 'string' || password.length < 12) throw error(400, 'A senha deve ter ao menos 12 caracteres.');
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  db.prepare('INSERT INTO admin(id,salt,password_hash) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET salt=excluded.salt,password_hash=excluded.password_hash').run(salt, hash);
  db.prepare('DELETE FROM sessions').run();
}

export function createBookingApi(db) {
  const readSettings = () => ({
    services: db.prepare('SELECT id,name,duration,enabled,price_cents AS priceCents,photo_url AS photoUrl FROM services ORDER BY id').all().map(s => ({ ...s, enabled: Boolean(s.enabled) })),
    hours: db.prepare('SELECT weekday,opens,closes,break_start AS breakStart,break_end AS breakEnd FROM hours ORDER BY weekday').all(),
    daysOff: db.prepare('SELECT day FROM days_off ORDER BY day').all().map(row => row.day),
    pendingMinutes: Number(db.prepare("SELECT value FROM settings WHERE key='pending_minutes'").get().value),
    adminConfigured: Boolean(db.prepare('SELECT id FROM admin WHERE id=1').get())
  });
  const active = (day, now = Date.now()) => db.prepare("SELECT id,starts,ends,status,expires_at AS expiresAt FROM appointments WHERE day=? AND (status IN ('confirmed','blocked') OR (status='pending' AND expires_at>?))").all(day, now);
  const dayWindow = day => {
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    const hours = db.prepare('SELECT * FROM hours WHERE weekday=?').get(weekday);
    if (!hours?.opens || !hours?.closes || db.prepare('SELECT day FROM days_off WHERE day=?').get(day)) return null;
    return { opens: minute(hours.opens), closes: minute(hours.closes), breakStart: minute(hours.break_start), breakEnd: minute(hours.break_end) };
  };
  const available = (day, start, duration, now = Date.now()) => {
    const window = dayWindow(day);
    if (!window || start < window.opens || start + duration > window.closes || start % 30) return false;
    if (Number.isFinite(window.breakStart) && start < window.breakEnd && start + duration > window.breakStart) return false;
    if (day === today()) {
      const local = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(now));
      if (start <= minute(local)) return false;
    }
    return !active(day, now).some(item => item.starts < start + duration && item.ends > start);
  };
  const validateRange = day => {
    if (!validDate(day)) throw error(400, 'Data inválida.');
    const delta = (Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today()}T12:00:00Z`)) / DAY_MS;
    if (delta < 0 || delta > 60) throw error(400, 'Escolha uma data nos próximos 60 dias.');
  };
  const transaction = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (cause) { db.exec('ROLLBACK'); throw cause; }
  };
  return {
    settings: readSettings,
    publicConfig() { const s = readSettings(); return { services: s.services.filter(x => x.enabled), configured: s.hours.some(x => x.opens && x.closes) && s.services.some(x => x.enabled), pendingMinutes: s.pendingMinutes, timeZone: TIME_ZONE }; },
    slots(day, serviceId) {
      validateRange(day);
      const service = db.prepare('SELECT * FROM services WHERE id=? AND enabled=1').get(Number(serviceId));
      if (!service) throw error(400, 'Serviço indisponível.');
      const window = dayWindow(day);
      if (!window) return [];
      const occupied = active(day);
      const slots = [];
      for (let start = Math.ceil(window.opens / 30) * 30; start + service.duration <= window.closes; start += 30) {
        if (Number.isFinite(window.breakStart) && start < window.breakEnd && start + service.duration > window.breakStart) continue;
        if (day === today() && !available(day, start, service.duration) && !occupied.some(x => x.starts < start + service.duration && x.ends > start)) continue;
        const conflict = occupied.find(x => x.starts < start + service.duration && x.ends > start);
        slots.push({ time: time(start), status: conflict ? conflict.status : 'available' });
      }
      return slots;
    },
    agenda(day) {
      validateRange(day);
      const window = dayWindow(day);
      if (!window) return [];
      const occupied = active(day);
      const entries = [];
      for (let start = Math.ceil(window.opens / 30) * 30; start + 30 <= window.closes; start += 30) {
        if (day === today() && start <= minute(new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()))) continue;
        const conflict = occupied.find(x => x.starts < start + 30 && x.ends > start);
        const breakTime = Number.isFinite(window.breakStart) && start < window.breakEnd && start + 30 > window.breakStart;
        entries.push({ time: time(start), status: breakTime ? 'blocked' : conflict?.status || 'available' });
      }
      return entries;
    },
    request(input) {
      const day = String(input.day || ''); validateRange(day);
      const start = minute(input.time);
      const name = String(input.name || '').trim();
      const phone = String(input.phone || '').replace(/\D/g, '');
      if (!Number.isFinite(start) || start % 30 || name.length < 2 || name.length > 80 || !/^\d{10,13}$/.test(phone)) throw error(400, 'Revise nome, telefone e horário.');
      const service = db.prepare('SELECT * FROM services WHERE id=? AND enabled=1').get(Number(input.serviceId));
      if (!service) throw error(400, 'Serviço indisponível.');
      return transaction(() => {
        const now = Date.now();
        if (!available(day, start, service.duration, now)) throw error(409, 'Horário indisponível. Atualize a agenda.');
        const ttl = Number(db.prepare("SELECT value FROM settings WHERE key='pending_minutes'").get().value);
        const result = db.prepare("INSERT INTO appointments(day,starts,ends,service_id,client_name,phone,status,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?,'pending',?,?,?)")
          .run(day, start, start + service.duration, service.id, name, phone, now + ttl * 60000, now, now);
        return { id: Number(result.lastInsertRowid), day, time: time(start), service: service.name, expiresAt: new Date(now + ttl * 60000).toISOString(), status: 'pending' };
      });
    },
    login(password) {
      const admin = db.prepare('SELECT * FROM admin WHERE id=1').get();
      if (!admin) throw error(503, 'Acesso administrativo ainda não configurado.');
      const supplied = scryptSync(String(password || ''), admin.salt, 64);
      if (!timingSafeEqual(supplied, Buffer.from(admin.password_hash, 'hex'))) throw error(401, 'Senha incorreta.');
      const token = randomBytes(32).toString('base64url');
      db.prepare('INSERT INTO sessions(token_hash,expires_at) VALUES (?,?)').run(digest(token), Date.now() + 12 * 60 * 60 * 1000);
      return token;
    },
    authenticated(token) { return Boolean(token && db.prepare('SELECT token_hash FROM sessions WHERE token_hash=? AND expires_at>?').get(digest(token), Date.now())); },
    logout(token) { if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token)); },
    appointments(from, to) {
      if (!validDate(from) || !validDate(to) || from > to) throw error(400, 'Período inválido.');
      return db.prepare(`SELECT a.id,a.day,a.starts,a.ends,a.client_name AS name,a.phone,a.status,a.expires_at AS expiresAt,s.name AS service
        FROM appointments a LEFT JOIN services s ON s.id=a.service_id WHERE a.day BETWEEN ? AND ? ORDER BY a.day,a.starts`).all(from, to)
        .map(row => ({ ...row, time: time(row.starts), endTime: time(row.ends), status: row.status === 'pending' && row.expiresAt <= Date.now() ? 'expired' : row.status }));
    },
    decide(id, action) {
      if (!['confirm', 'cancel'].includes(action)) throw error(400, 'Ação inválida.');
      return transaction(() => {
        const row = db.prepare('SELECT * FROM appointments WHERE id=?').get(Number(id));
        if (!row || row.status === 'blocked') throw error(404, 'Solicitação não encontrada.');
        if (action === 'confirm') {
          if (row.status !== 'pending' || row.expires_at <= Date.now()) throw error(409, 'Solicitação expirada ou já decidida.');
          if (active(row.day).some(x => x.id !== row.id && x.starts < row.ends && x.ends > row.starts)) throw error(409, 'Horário em conflito.');
        } else if (!['pending', 'confirmed'].includes(row.status)) throw error(409, 'Agendamento já cancelado.');
        db.prepare('UPDATE appointments SET status=?,expires_at=NULL,updated_at=? WHERE id=?').run(action === 'confirm' ? 'confirmed' : 'cancelled', Date.now(), row.id);
        return { ok: true };
      });
    },
    block(day, at, duration = 30) {
      validateRange(day);
      const start = minute(at);
      if (!Number.isFinite(start) || start % 30 || !Number.isInteger(duration) || duration < 30 || duration > 480 || duration % 30) throw error(400, 'Hora ou duração inválida.');
      return transaction(() => {
        if (!available(day, start, duration)) throw error(409, 'Horário indisponível.');
        const now = Date.now();
        const result = db.prepare("INSERT INTO appointments(day,starts,ends,status,created_at,updated_at) VALUES (?,?,?,'blocked',?,?)").run(day, start, start + duration, now, now);
        return { id: Number(result.lastInsertRowid) };
      });
    },
    unblock(id) {
      const result = db.prepare("UPDATE appointments SET status='cancelled',updated_at=? WHERE id=? AND status='blocked'").run(Date.now(), Number(id));
      if (!result.changes) throw error(404, 'Bloqueio não encontrado.');
      return { ok: true };
    },
    updateSettings(input) {
      const hours = input.hours;
      const services = input.services;
      const daysOff = input.daysOff;
      const ttl = Number(input.pendingMinutes);
      if (!Array.isArray(hours) || hours.length !== 7 || !Array.isArray(services) || !Array.isArray(daysOff) || !Number.isInteger(ttl) || ttl < 5 || ttl > 1440) throw error(400, 'Configuração inválida.');
      const known = readSettings().services;
      if (services.length < known.length || services.length > 40 || services.some(s =>
        (s.id != null && !known.some(k => k.id === Number(s.id))) ||
        !Number.isInteger(Number(s.duration)) || Number(s.duration) < 30 || Number(s.duration) > 480 || Number(s.duration) % 30 ||
        (s.name != null && (typeof s.name !== 'string' || s.name.trim().length < 2 || s.name.trim().length > 80)) ||
        (s.priceCents != null && (!Number.isInteger(Number(s.priceCents)) || Number(s.priceCents) < 0 || Number(s.priceCents) > 10000000)) ||
        (s.enabled && ('photoUrl' in s || 'priceCents' in s) && (s.priceCents == null || !s.photoUrl)))) throw error(400, 'Serviço inválido.');
      const ids = services.filter(s => s.id != null).map(s => Number(s.id));
      if (new Set(ids).size !== known.length || known.some(s => !ids.includes(s.id))) throw error(400, 'Serviços duplicados ou ausentes.');
      if (hours.some((h, i) => Number(h.weekday) !== i || ((h.opens || h.closes) && !(Number.isFinite(minute(h.opens)) && Number.isFinite(minute(h.closes)) && minute(h.opens) < minute(h.closes))) || ((h.breakStart || h.breakEnd) && !(Number.isFinite(minute(h.breakStart)) && Number.isFinite(minute(h.breakEnd)) && minute(h.opens) <= minute(h.breakStart) && minute(h.breakStart) < minute(h.breakEnd) && minute(h.breakEnd) <= minute(h.closes))))) throw error(400, 'Expediente ou intervalo inválido.');
      if (daysOff.some(day => !validDate(day))) throw error(400, 'Dia sem atendimento inválido.');
      return transaction(() => {
        const updateHours = db.prepare('UPDATE hours SET opens=?,closes=?,break_start=?,break_end=? WHERE weekday=?');
        hours.forEach(h => updateHours.run(h.opens || null, h.closes || null, h.breakStart || null, h.breakEnd || null, Number(h.weekday)));
        const updateService = db.prepare('UPDATE services SET name=?,duration=?,enabled=?,price_cents=?,photo_url=? WHERE id=?');
        const insertService = db.prepare('INSERT INTO services(name,duration,enabled,price_cents,photo_url) VALUES (?,?,?,?,?)');
        services.forEach(s => {
          const old = known.find(item => item.id === Number(s.id));
          const values = [s.name?.trim() || old?.name, Number(s.duration), s.enabled ? 1 : 0,
            s.priceCents === undefined ? old?.priceCents ?? null : s.priceCents,
            s.photoUrl === undefined ? old?.photoUrl ?? null : s.photoUrl];
          if (s.id == null) insertService.run(...values);
          else updateService.run(...values, Number(s.id));
        });
        db.prepare('DELETE FROM days_off').run();
        const insertDay = db.prepare('INSERT INTO days_off(day) VALUES (?)');
        [...new Set(daysOff)].forEach(day => insertDay.run(day));
        db.prepare("UPDATE settings SET value=? WHERE key='pending_minutes'").run(String(ttl));
        return readSettings();
      });
    }
  };
}
