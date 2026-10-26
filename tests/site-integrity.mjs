import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve('dist');
const read = name => readFileSync(resolve(dist, name), 'utf8');
const html = read('index.html');
const script = read('script.js');
const manifest = JSON.parse(read('manifest.webmanifest'));
const sw = read('sw.js');

const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
const anchors = [...html.matchAll(/\bhref="#([^"]+)"/g)].map(match => match[1]);
for (const anchor of anchors) assert.ok(ids.has(anchor), `Âncora sem destino: #${anchor}`);

const localFiles = new Set([
  ...[...html.matchAll(/\b(?:src|href)="\.\/([^"]+)"/g)].map(match => match[1]),
  ...[...script.matchAll(/['"]([\w-]+\.(?:jpg|png|svg))['"]/g)].map(match => `assets/${match[1]}`),
  ...manifest.icons.map(icon => icon.src.replace(/^\.\//, ''))
]);
for (const file of localFiles) assert.ok(existsSync(resolve(dist, file)), `Recurso ausente: ${file}`);

const precache = new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map(match => match[1]));
for (const file of localFiles) {
  if (file.startsWith('assets/')) assert.ok(precache.has(file), `Recurso da página fora do cache offline: ${file}`);
}

const services = [...html.matchAll(/data-service="([^"]+)"/g)].map(match => match[1]);
const bookingClient = read('booking-experience.js');
assert.match(bookingClient, /\/api\/public\/config/, 'Serviços devem vir da API');
assert.match(bookingClient, /\/api\/public\/agenda/, 'Agenda deve aparecer antes da escolha do serviço');
for (const service of services) assert.ok(readFileSync(resolve('booking-api.mjs'), 'utf8').includes(service), `Serviço sem cadastro na API: ${service}`);

const assetBytes = [...precache]
  .filter(file => file.startsWith('assets/'))
  .reduce((total, file) => total + statSync(resolve(dist, file)).size, 0);
console.log(`Integridade OK: ${anchors.length} âncoras, ${localFiles.size} recursos locais, ${services.length} serviços; precache de imagens/ícones ${(assetBytes / 1048576).toFixed(2)} MiB`);
