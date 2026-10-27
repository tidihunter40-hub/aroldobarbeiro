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
assert.deepEqual(navItems, [['/','Início'],['/agendamento','Agendamento'],['/cortes','Cortes'],['/protese-capilar','Prótese capilar'],['/galeria','Galeria'],['/servicos-precos','Serviços &amp; Preços'],['/contato','Contato']], 'Prótese capilar deve ter uma aba própria no menu público');
const bottomNav = html.match(/<nav class="app-bottom-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
assert.deepEqual([...bottomNav.matchAll(/<a href="(\/[^"]*)"/g)].map(match => match[1]), navItems.filter(([path]) => path !== '/protese-capilar').map(([path]) => path), 'Barra inferior deve preservar os seis atalhos existentes');
assert.doesNotMatch(mainNav, /Sobre/i, 'Menu público não deve incluir seções removidas');
assert.match(html, /id="servicos-precos"/, 'Vitrine de serviços e preços deve ter uma tela própria');
assert.deepEqual([...html.matchAll(/data-price-category="([^"]+)"/g)].map(match => match[1]), ['cabelo','barba','coloracao','combos'], 'Vitrine deve ter as quatro categorias');
assert.match(html, /<section class="hero hero-home" id="inicio"/, 'A fachada deve abrir a navegação pública');
assert.match(html, /id="agendar"/, 'A agenda deve permanecer disponível no fluxo público');
assert.deepEqual([...html.matchAll(/data-category-choice="([^"]+)"/g)].map(match => match[1]), ['masculinos','infantis','barbas'], 'Entrada do catálogo deve conter três categorias');
assert.doesNotMatch(html, /data-cut-filter=/, 'Cortes individuais não devem aparecer como filtro da tela inicial');
assert.deepEqual([...html.matchAll(/data-gallery-category="([^"]+)"/g)].map(match => match[1]), ['cortes','visagismo','proteses','barbas','desenhos','platinados','outros'], 'A Galeria deve apresentar categorias de fotografias reais');
assert.match(html, /<section class="site-protese" id="protese-capilar"/, 'Prótese capilar deve ter uma tela própria');
const gallerySection = html.split('<section class="site-gallery"')[1].split('<section class="site-contact"')[0];
assert.doesNotMatch(gallerySection, /protese-hero|protese-benefits|protese-process|protese-final/, 'Galeria não deve conter a página do serviço');
assert.match(gallerySection, /data-gallery-category="proteses"><img src="\.\/assets\/protese-instagram\.jpg"/, 'Capa de prótese na Galeria deve usar foto real');
assert.match(html, /Imagem ilustrativa\. As fotos reais dos atendimentos estão na Galeria\./, 'A imagem da página de serviço deve ser identificada');
assert.match(read('script.js'), /corte-kids-instagram\.jpg/, 'Cortes infantis devem permanecer entre os trabalhos');
assert.match(read('script.js'), /destaque-premiacoes-02\.jpg/, 'Outros trabalhos devem preservar os registros originais');

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
