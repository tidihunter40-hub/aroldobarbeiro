import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve('dist/index.html'), 'utf8');
const client = readFileSync(resolve('dist/booking-experience.js'), 'utf8');
const sw = readFileSync(resolve('dist/sw.js'), 'utf8');
assert.match(html, /id="booking-slots"/);
assert.match(html, /id="booking-phone"/);
assert.match(html, /SOLICITAR AGENDAMENTO/);
assert.match(html, /id="booking-services"/);
assert.match(html, /id="booking-summary"/);
assert.match(client, /\/api\/public\/appointments/);
assert.match(client, /\/api\/public\/agenda/);
assert.match(client, /\/api\/public\/slots/);
assert.match(sw, /includes\('\/api\/'\)/);
console.log('Booking smoke: interface linked to API and API outside offline cache');
