import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { createServer } from '../app-server.mjs';
import { createBookingApi, openBookingDb } from '../booking-api.mjs';

const playwrightPath = process.env.PLAYWRIGHT_PATH;
if (!playwrightPath) throw new Error('Defina PLAYWRIGHT_PATH com o caminho do módulo playwright/index.mjs.');
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
const tempDir = mkdtempSync(join(process.cwd(), '.test-booking-'));
const dbPath = join(tempDir, 'bookings.sqlite');
const db = openBookingDb(dbPath);
const api = createBookingApi(db);
const settings = api.settings();
settings.services[0] = { ...settings.services[0], enabled: true, duration: 30, priceCents: null, photoUrl: './assets/corte-perfil-instagram.jpg' };
settings.services.push({ id: null, name: 'Mullet', enabled: true, duration: 30, priceCents: 3000, photoUrl: './assets/cortes/masculinos/mullet.webp' });
settings.hours = settings.hours.map(hours => ({ ...hours, opens: '08:00', closes: '17:00', breakStart: '12:00', breakEnd: '14:00' }));
api.updateSettings(settings);
db.close();
const testDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 3 * 86400000));
const server = createServer(dbPath);
await new Promise(resolveReady => server.listen(0, '127.0.0.1', resolveReady));
const origin = process.env.SITE_URL || `http://127.0.0.1:${server.address().port}`;
const widths = [320, 360, 390, 430, 768, 1024, 1366];
const chooseDay = (page, value) => page.locator('#booking-day').evaluate((input, selected) => {
  input.value = selected;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}, value);

try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.locator('.hero-photo').evaluate(image => image.decode());
    await page.evaluate(() => document.fonts.ready);
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      hero: document.querySelector('#inicio').getBoundingClientRect().height,
      photo: document.querySelector('.hero-picture').getBoundingClientRect().height
    }));
    assert.ok(dimensions.scrollWidth <= dimensions.innerWidth + 1, `${width}px: rolagem horizontal (${dimensions.scrollWidth}px)`);
    assert.equal(await page.locator('main > section:not([hidden])').count(), 1, `${width}px: deve haver uma tela ativa`);
    if (width <= 1000) {
      assert.equal(await page.locator('.app-bottom-nav a:visible').count(), 6, `${width}px: seis atalhos visíveis`);
      assert.equal(await page.locator('.hero-feature:visible').count(), width <= 700 ? 3 : 0);
      assert.equal(await page.locator('.app-bottom-nav a[aria-current="page"]').count(), 1, `${width}px: apenas o início selecionado`);
      if (width <= 700) {
        const actionAboveNav = await page.evaluate(() => document.querySelector('.hero-actions .button-gold').getBoundingClientRect().bottom <= document.querySelector('.app-bottom-nav').getBoundingClientRect().top);
        assert.ok(actionAboveNav, `${width}px: botão de agendar deve ficar acima da barra fixa`);
      }
    }
    assert.deepEqual(errors, [], `${width}px: erros de JavaScript`);
    if (width === 390 || width === 320 || width === 430 || width === 1024 || width === 1366) await page.screenshot({ path: resolve(`preview-${width}.png`), fullPage: true });
    await page.goto(`${origin}/cortes`, { waitUntil: 'domcontentloaded' });
    await page.locator('.cut-category-card img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    const categoryBoxes = await page.locator('.cut-category-card').evaluateAll(cards => cards.map(card => ({ x: card.getBoundingClientRect().x, y: card.getBoundingClientRect().y, width: card.getBoundingClientRect().width, height: card.getBoundingClientRect().height })));
    assert.equal(categoryBoxes.length, 3);
    assert.equal(await page.locator('.cut-card').count(), 0, `${width}px: só as categorias devem aparecer inicialmente`);
    if (width < 700) assert.ok(categoryBoxes[0].y < categoryBoxes[1].y && categoryBoxes[1].y < categoryBoxes[2].y, `${width}px: categorias em coluna`);
    else assert.ok(categoryBoxes.every(box => Math.abs(box.y - categoryBoxes[0].y) < 2), `${width}px: categorias alinhadas`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px: catálogo sem rolagem horizontal`);
    if ([390, 1024, 1366].includes(width)) await page.screenshot({ path: resolve(`preview-categories-${width}.png`), fullPage: true });
    if (width <= 1000) {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const visibleAboveNav = await page.evaluate(() => document.querySelector('.cut-category-card:last-child').getBoundingClientRect().bottom <= document.querySelector('.app-bottom-nav').getBoundingClientRect().top);
      assert.ok(visibleAboveNav, `${width}px: último cartão deve ficar acima da barra fixa ao fim da rolagem`);
    }
    console.log(`${width}px: sem rolagem horizontal; hero ${Math.round(dimensions.hero)}px; foto ${Math.round(dimensions.photo)}px`);
    await page.close();
  }

  for (const [width, height] of [[320, 568], [390, 667]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.goto(origin);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const actionVisible = await page.evaluate(() => document.querySelector('.hero-actions .button-gold').getBoundingClientRect().bottom <= document.querySelector('.app-bottom-nav').getBoundingClientRect().top);
    assert.ok(actionVisible, `${width}×${height}px: botão de agendamento deve ficar acessível acima da barra fixa`);
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await page.goto(origin);
  assert.equal(await page.locator('.booking-date-picker').count(), 0);
  assert.equal((await page.locator('#hero-title').innerText()).replace(/\s+/g, ' ').trim(), 'AROLDO BARBER');
  await page.locator('.hero-feature[data-open-category="masculinos"]').click();
  assert.equal(new URL(page.url()).pathname, '/cortes');
  assert.equal(await page.locator('.cut-card').count(), 18);
  await page.locator('.app-bottom-nav a[href="/"]').click();
  await page.locator('.hero-feature[data-open-category="barbas"]').click();
  assert.equal(new URL(page.url()).pathname, '/cortes');
  assert.equal(await page.locator('.cut-card').count(), 5);
  await page.locator('.app-bottom-nav a[href="/"]').click();
  await page.locator('.hero-feature[href="/galeria"]').click();
  assert.equal(new URL(page.url()).pathname, '/galeria');
  await page.locator('.app-bottom-nav a[href="/"]').click();
  await page.locator('.hero-actions .button-gold').click();
  assert.equal(new URL(page.url()).pathname, '/agendamento');
  assert.equal(await page.locator('main > section:not([hidden])').count(), 1);
  await page.goBack();
  assert.equal(new URL(page.url()).pathname, '/');
  for (const path of ['/cortes', '/galeria', '/servicos-precos', '/contato', '/agendamento']) {
    await page.locator(`.app-bottom-nav a[href="${path}"]`).click();
    assert.equal(new URL(page.url()).pathname, path);
    assert.equal(await page.locator('.app-bottom-nav a[aria-current="page"]').getAttribute('href'), path);
    assert.equal(await page.locator('main > section:not([hidden])').count(), 1);
    await page.reload();
    assert.equal(await page.locator('main > section:not([hidden])').count(), 1, `Recarregar ${path}`);
    if (path === '/cortes' || path === '/galeria') {
      const images = page.locator(`${path === '/cortes' ? '#cortes' : '#galeria'} img`);
      const broken = await images.evaluateAll(async elements => {
        await Promise.all(elements.map(async image => {
          image.loading = 'eager';
          try { await image.decode(); } catch { /* reported below */ }
        }));
        return elements.filter(image => !image.naturalWidth).map(image => image.src);
      });
      assert.deepEqual(broken, [], `Imagens da tela ${path}`);
    }
    if (path === '/cortes') {
      assert.equal(await page.locator('.cut-category-card:visible').count(), 3);
      assert.equal(await page.locator('.cut-card').count(), 0);
    }
    if (path === '/agendamento') {
      await chooseDay(page, testDay);
      await page.locator('.slot-available').first().waitFor();
      console.log(`Agenda: horários disponíveis em ${testDay}`);
    }
    await page.screenshot({ path: resolve(`preview-${path.slice(1)}-390.png`), fullPage: true });
  }
  await page.locator('.app-bottom-nav a[href="/galeria"]').click();
  await page.locator('[data-gallery-filter="barbas"]').click();
  assert.equal(await page.locator('.gallery-work-card').count(), 2);
  await page.locator('.gallery-work-card').first().click();
  assert.equal(await page.locator('#gallery-dialog').evaluate(dialog => dialog.open), true);
  await page.locator('.lightbox-close').click();
  await page.locator('.app-bottom-nav a[href="/cortes"]').click();
  for (const [category, count] of [['masculinos', 18], ['infantis', 5], ['barbas', 5]]) {
    await page.locator(`[data-category-choice="${category}"]`).click();
    assert.equal(await page.locator('.cut-category-card:visible').count(), 0);
    assert.equal(await page.locator('.cut-card').count(), count);
    assert.equal(await page.locator('.cut-card-media h4').count(), count, `${category}: nome de cada estilo sobre a foto`);
    if (category === 'masculinos') assert.match(await page.locator('.cut-card').first().locator('.cut-card-price').textContent(), /30,00/);
    const brokenCutImages = await page.locator('.cut-card-media img').evaluateAll(async images => {
      await Promise.all(images.map(async image => {
        image.loading = 'eager';
        try { await image.decode(); } catch { /* reported below */ }
      }));
      return images.filter(image => !image.naturalWidth).map(image => image.src);
    });
    assert.deepEqual(brokenCutImages, [], `Fotos dos ${count} itens em ${category}`);
    if (category === 'masculinos') await page.screenshot({ path: resolve('preview-cortes-masculinos-390.png'), fullPage: true });
    await page.locator('#cut-category-back').click();
    assert.equal(await page.locator('.cut-category-card:visible').count(), 3);
    assert.equal(await page.locator('.cut-card').count(), 0);
  }
  await page.locator('[data-category-choice="masculinos"]').click();
  await page.locator('.cut-card-choose').first().click();
  assert.equal(new URL(page.url()).pathname, '/agendamento');
  assert.ok(await page.evaluate(() => JSON.parse(sessionStorage.getItem('aroldo-cut') || 'null')?.name));
  await chooseDay(page, testDay);
  await page.locator('.slot-available').first().click();
  assert.match(await page.locator('#booking-cut-selection').textContent(), /Estilo escolhido:/);
  assert.match(await page.locator('.booking-service-card').first().textContent(), /Valor a confirmar/);
  await page.locator('.booking-service-card').first().click();
  await page.waitForFunction(() => !document.getElementById('service-next').disabled);
  await page.locator('#service-next').click();
  assert.equal(await page.locator('#booking-stage-confirm').isVisible(), true);
  await page.locator('.menu-toggle').click();
  assert.equal(await page.locator('.nav.open a:visible').count(), 6);
  await page.locator('.nav.open a[href="/"]').click();
  assert.equal(new URL(page.url()).pathname, '/');
  console.log('Rotas, botão de agenda, menu, recarregamento e voltar: OK');
  await page.close();
} finally {
  await browser.close();
  await new Promise(resolveClosed => server.close(resolveClosed));
  if (!resolve(tempDir).startsWith(resolve(process.cwd()) + sep)) throw new Error('Diretório temporário fora do projeto.');
  rmSync(tempDir, { recursive: true, force: true });
}
