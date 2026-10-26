import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve('dist');
const read = name => readFileSync(resolve(dist, name), 'utf8');
const html = read('index.html');
const script = read('script.js');
const manifest = JSON.parse(read('manifest.webmanifest'));
const sw = read('sw.js');

const mainNav = html.match(/<nav class="nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
const navItems = [...mainNav.matchAll(/<a href="(\/[^"]*)"[^>]*>([^<]+)<\/a>/g)].map(match => [match[1], match[2].trim()]);
assert.deepEqual(navItems, [['/','Início'],['/agendamento','Agendamento'],['/cortes','Cortes'],['/galeria','Galeria'],['/contato','Contato']], 'Menu público deve ter somente os cinco destinos aprovados');
const bottomNav = html.match(/<nav class="app-bottom-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
assert.deepEqual([...bottomNav.matchAll(/<a href="(\/[^"]*)"/g)].map(match => match[1]), navItems.map(([path]) => path), 'Barra inferior deve refletir as cinco telas');
assert.doesNotMatch(mainNav, /Sobre|Serviços/i, 'Menu público não deve incluir seções removidas');
assert.match(html, /<section class="hero hero-home" id="inicio"/, 'A fachada deve abrir a navegação pública');
assert.match(html, /id="agendar"/, 'A agenda deve permanecer disponível no fluxo público');
assert.deepEqual([...html.matchAll(/data-category-choice="([^"]+)"/g)].map(match => match[1]), ['masculinos','infantis','barbas'], 'Entrada do catálogo deve conter três categorias');
assert.doesNotMatch(html, /data-cut-filter=/, 'Cortes individuais não devem aparecer como filtro da tela inicial');
assert.deepEqual([...html.matchAll(/data-gallery-filter="([^"]+)"/g)].map(match => match[1]), ['cortes','visagismo','proteses','barbas','outros'], 'A galeria deve ter os cinco filtros internos');

const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
const anchors = [...html.matchAll(/\bhref="#([^"]+)"/g)].map(match => match[1]);
for (const anchor of anchors) assert.ok(ids.has(anchor), `Âncora sem destino: #${anchor}`);

const localFiles = new Set([
  ...[...html.matchAll(/\b(?:src|href)="\.\/([^"]+)"/g)].map(match => match[1].split('?')[0]),
  ...[...script.matchAll(/['"]([\w-]+\.(?:jpg|png|svg))['"]/g)].map(match => `assets/${match[1]}`),
  ...[...read('script.js').matchAll(/['"]\.\/assets\/([^'"]+\.(?:jpg|png|svg))['"]/g)].map(match => `assets/${match[1]}`),
  ...manifest.icons.map(icon => icon.src.replace(/^\.\//, ''))
]);
for (const file of localFiles) assert.ok(existsSync(resolve(dist, file)), `Recurso ausente: ${file}`);

const precache = new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map(match => match[1]));
for (const file of localFiles) {
  if (file.startsWith('assets/')) assert.ok(precache.has(file), `Recurso da página fora do cache offline: ${file}`);
}

const cuts = JSON.parse(read('cortes-catalogo.json'));
assert.equal(cuts.length, 28, 'O catálogo deve conter os 28 estilos fornecidos');
assert.deepEqual(
  Object.fromEntries([...new Set(cuts.map(cut => cut.categoria))].map(category => [category, cuts.filter(cut => cut.categoria === category).length])),
  { masculinos: 18, infantis: 5, barbas: 5 },
  'O catálogo deve manter as quantidades por categoria'
);
for (const cut of cuts) {
  const image = cut.imagem.replace(/^\.\//, '');
  assert.ok(existsSync(resolve(dist, image)), `Foto ausente para ${cut.nome}: ${image}`);
  assert.ok(precache.has(image), `Foto do catálogo fora do cache offline: ${image}`);
}

const services = [...html.matchAll(/data-service="([^"]+)"/g)].map(match => match[1]);
const bookingClient = read('booking-experience.js');
assert.match(bookingClient, /\/api\/public\/config/, 'Serviços devem vir da API');
assert.match(bookingClient, /\/api\/public\/agenda/, 'Agenda deve aparecer antes da escolha do serviço');
assert.match(bookingClient, /\/api\/public\/appointments/, 'Solicitações devem continuar integradas à API existente');
assert.match(read('script.js'), /body\.classList\.toggle\('menu-open', opening\)/, 'Menu mobile deve bloquear a rolagem do fundo');
for (const service of services) assert.ok(readFileSync(resolve('booking-api.mjs'), 'utf8').includes(service), `Serviço sem cadastro na API: ${service}`);

const assetBytes = [...precache]
  .filter(file => file.startsWith('assets/'))
  .reduce((total, file) => total + statSync(resolve(dist, file)).size, 0);
console.log(`Integridade OK: ${anchors.length} âncoras, ${localFiles.size} recursos locais, ${services.length} serviços; precache de imagens/ícones ${(assetBytes / 1048576).toFixed(2)} MiB`);
