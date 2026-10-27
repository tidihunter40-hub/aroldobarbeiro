import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { createServer } from '../app-server.mjs';
import { createBookingApi, openBookingDb } from '../booking-api.mjs';
import { officialServices, mergeOfficialServices } from '../official-services.mjs';

const playwrightPath = process.env.PLAYWRIGHT_PATH;
if (!playwrightPath) throw new Error('Defina PLAYWRIGHT_PATH com o caminho do módulo playwright/index.mjs.');
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
const tempDir = mkdtempSync(join(process.cwd(), '.test-services-prices-'));
const dbPath = join(tempDir, 'bookings.sqlite');
const db = openBookingDb(dbPath);
const api = createBookingApi(db);
const settings = api.settings();
mergeOfficialServices(settings);
settings.hours = settings.hours.map(hours => ({ ...hours, opens: '08:00', closes: '17:00', breakStart: '12:00', breakEnd: '14:00' }));
api.updateSettings(settings);
db.close();

const server = createServer(dbPath);
await new Promise(resolveReady => server.listen(0, '127.0.0.1', resolveReady));
const origin = `http://127.0.0.1:${server.address().port}`;
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 3 * 86400000));

try {
  for (const width of [320, 390, 500, 768, 941, 1024, 1366]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/servicos-precos`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('services-prices-status').textContent === '');
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('main > section:not([hidden])').count(), 1);
    assert.equal(await page.locator('.services-prices-category').count(), 4);
    if (width <= 1000) {
      const quickNav = page.locator('.app-bottom-nav');
      assert.equal(await quickNav.isVisible(), true, `${width}px: atalhos visíveis na entrada`);
      assert.equal(await quickNav.locator('a:visible').count(), 6, `${width}px: seis atalhos`);
      assert.equal(await quickNav.locator('a[aria-current="page"]').getAttribute('href'), '/servicos-precos');
      const navRows = await quickNav.locator('a').evaluateAll(links => links.map(link => Math.round(link.getBoundingClientRect().top)));
      assert.equal(new Set(navRows).size, 1, `${width}px: atalhos na mesma linha`);
    }
    assert.equal(await page.locator('.brand img').getAttribute('src'), './assets/aroldo-logo-fachada.png', 'logo da fachada preservada');
    const landingLogo = page.locator('.services-prices-landing-original-logo');
    assert.equal(await landingLogo.getAttribute('src'), './assets/aroldo-logo-oficial.png');
    assert.equal(await landingLogo.isVisible(), true, 'logo original visível na capa');
    if (width === 390 || width === 500 || width === 1366) await page.screenshot({ path: resolve(`preview-services-prices-${width}.png`), fullPage: true });
    for (const [category, count] of [['cabelo', 7], ['barba', 5], ['coloracao', 6], ['combos', 3]]) {
      await page.locator(`[data-price-category="${category}"]`).click();
      assert.equal(await page.locator('.services-prices-detail-row').count(), count, `${category}: serviços visíveis`);
      assert.equal(await page.locator('#services-prices-detail').isVisible(), true);
      if (width <= 1000) {
        assert.equal(await page.locator('.app-bottom-nav').isVisible(), true, `${category} ${width}px: atalhos visíveis`);
        assert.equal(await page.locator('.app-bottom-nav a[aria-current="page"]').getAttribute('href'), '/servicos-precos', `${category} ${width}px: Serviços & Preços marcado`);
      }
      const detailLogo = page.locator('.services-prices-detail-logo');
      assert.equal(await detailLogo.getAttribute('src'), './assets/aroldo-logo-oficial.png');
      assert.equal(await detailLogo.isVisible(), true, `${category}: logo original visível`);
      assert.equal(await page.locator('#services-prices-booking-bar').count(), 0, `${category}: sem painel duplicado`);
      assert.equal(await page.locator('.services-prices-detail-book').count(), count, `${category}: um botão AGENDAR por serviço`);
      if (category === 'cabelo' || category === 'barba' || category === 'coloracao' || category === 'combos') {
        assert.equal(await page.locator('#services-prices-detail').getAttribute('data-art-ready'), 'true', `${category}: arte de referência com preços oficiais`);
      }
      if (category === 'barba') {
        const artSelector = width <= 700 ? '.services-prices-detail-row' : '#services-prices-detail';
        const art = await page.locator(artSelector).first().evaluate(async element => {
          const background = getComputedStyle(element).backgroundImage;
          const source = background.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
          const image = new Image();
          image.src = source;
          await image.decode();
          return { background, height: element.getBoundingClientRect().height };
        });
        assert.match(art.background, /barba-pagina-referencia\.png/);
        if (width <= 700) assert.ok(art.height >= 70, 'barba: faixas legíveis no celular');
        const rows = await page.locator('.services-prices-detail-row').allTextContents();
        assert.match(rows[0], /Barba simples.*R\$\s*20,00/);
        assert.match(rows[1], /Barba com espuma quente.*R\$\s*25,00/);
        assert.match(rows[2], /Barboterapia com vapor de ozônio.*R\$\s*30,00/);
        assert.match(rows[3], /Pezinho.*R\$\s*10,00/);
        assert.match(rows[4], /Sobrancelha.*R\$\s*10,00/);
      }
      if (category === 'cabelo') {
        const artSelector = width <= 700 ? '.services-prices-detail-row' : '#services-prices-detail';
        const art = await page.locator(artSelector).first().evaluate(async element => {
          const background = getComputedStyle(element).backgroundImage;
          const source = background.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
          const image = new Image();
          image.src = source;
          await image.decode();
          return { background, height: element.getBoundingClientRect().height };
        });
        assert.match(art.background, /cabelos-pagina-referencia\.png/);
        if (width <= 700) assert.ok(art.height >= 65, 'cabelo: faixas legíveis no celular');
      }
      if (category === 'combos') {
        const art = await page.locator('#services-prices-detail').evaluate(async element => {
          const background = getComputedStyle(element).backgroundImage;
          const source = background.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
          const image = new Image();
          image.src = source;
          await image.decode();
          return { background, width: element.clientWidth, height: element.clientHeight };
        });
        assert.match(art.background, /combos-servicos-referencia\.png/);
        assert.ok(art.height <= art.width * 1.36 + 1, 'combos: painel inferior fora da arte');
      }
      if (category === 'coloracao') {
        const artSelector = width <= 700 ? '#services-prices-detail-list .services-prices-detail-row' : '#services-prices-detail';
        const art = await page.locator('#services-prices-detail-list').evaluate(element => ({
          background: getComputedStyle(innerWidth <= 700 ? element.firstElementChild : element.closest('.services-prices-detail')).backgroundImage,
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
          viewportWidth: element.parentElement.clientWidth,
          scrollable: element.parentElement.scrollWidth > element.parentElement.clientWidth
        }));
        await page.locator(artSelector).first().evaluate(async element => {
          const source = getComputedStyle(element).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
          const image = new Image();
          image.src = source;
          await image.decode();
        });
        assert.match(art.background, /coloracao-pagina-referencia\.png/);
        if (width <= 700) {
          assert.ok(art.width <= art.viewportWidth + 1, 'coloracao: imagem inteira no celular');
          assert.equal(art.scrollable, false, 'coloracao: sem corte horizontal');
          assert.ok(art.height >= 450, 'coloracao: faixas grandes no celular');
        }
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${category} ${width}px: sem rolagem horizontal`);
      const brokenPhotos = await page.locator('.services-prices-detail-photo').evaluateAll(async images => {
        await Promise.all(images.map(image => image.decode().catch(() => {})));
        return images.filter(image => !image.naturalWidth).map(image => image.src);
      });
      assert.deepEqual(brokenPhotos, [], `${category}: fotos carregadas`);
      if (width === 390 || width === 500 || width === 941 || (width === 320 && (category === 'coloracao' || category === 'cabelo' || category === 'barba'))) {
        await page.screenshot({ path: resolve(`preview-services-prices-${category}-${width}.png`), fullPage: true });
      }
      if (width === 390 && category === 'cabelo') {
        const rows = await page.locator('.services-prices-detail-row').allTextContents();
        assert.match(rows[0], /Corte com máquina.*R\$\s*35,00/);
        assert.match(rows[1], /Corte na tesoura.*R\$\s*40,00/);
        assert.match(rows[2], /Corte infantil.*R\$\s*40,00/);
      }
      if (width === 390 && (category === 'combos' || category === 'cabelo' || category === 'barba' || category === 'coloracao')) {
        await page.locator('.menu-toggle').click();
        assert.equal(await page.locator('.site-header').evaluate(header => header.classList.contains('menu-open')), true);
        await page.locator('.menu-toggle').click();
      }
      await page.locator('#services-prices-back').click();
    }
    assert.equal(officialServices.length, 19);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px: sem rolagem horizontal`);
    assert.deepEqual(errors, [], `${width}px: sem erros de JavaScript`);
    if (width === 390) {
      await page.locator('[data-price-category="cabelo"]').click();
      await page.locator('.services-prices-detail-book').first().click();
      assert.equal(new URL(page.url()).pathname, '/agendamento');
      assert.match(await page.locator('#booking-preselected').textContent(), /Corte com máquina.*R\$\s*35,00/);
      await page.goto(`${origin}/servicos-precos`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.getElementById('services-prices-status').textContent === '').catch(async error => {
        console.error('Falha ao recarregar serviços:', page.url(), await page.locator('#services-prices-status').textContent(), errors);
        throw error;
      });
      await page.locator('[data-price-category="coloracao"]').click();
      assert.equal(await page.locator('#services-prices-detail').getAttribute('data-art-ready'), 'true');
      await page.locator('.services-prices-detail-book').first().click();
      assert.equal(new URL(page.url()).pathname, '/agendamento');
      assert.match(await page.locator('#booking-preselected').textContent(), /Nevou.*R\$\s*200,00/);
      await page.goto(`${origin}/servicos-precos`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.getElementById('services-prices-status').textContent === '');
      await page.locator('[data-price-category="combos"]').click();
      await page.locator('.services-prices-detail-book').first().click();
      assert.equal(new URL(page.url()).pathname, '/agendamento');
      assert.match(await page.locator('#booking-preselected').textContent(), /Cabelo \+ barba simples.*R\$\s*50,00/);
      await page.locator('#booking-day').evaluate((input, value) => { input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); }, day);
      await page.locator('.slot-available').first().click();
      await page.locator('#booking-stage-confirm:visible').waitFor();
      assert.match(await page.locator('#booking-summary').textContent(), /Cabelo \+ barba simples/);
      assert.equal(await page.locator('#booking-stage-service').isVisible(), false);
      assert.equal(await page.locator('.app-bottom-nav').isVisible(), true, 'atalhos visíveis na confirmação da agenda');
      for (const route of ['/', '/cortes', '/galeria', '/contato', '/agendamento', '/servicos-precos']) {
        await page.locator(`.app-bottom-nav a[href="${route}"]`).click();
        assert.equal(new URL(page.url()).pathname, route);
        assert.equal(await page.locator('.app-bottom-nav a[aria-current="page"]').getAttribute('href'), route, `${route}: atalho marcado`);
        assert.equal(await page.locator('.app-bottom-nav').isVisible(), true, `${route}: atalhos visíveis`);
        if (route === '/cortes') {
          await page.locator('[data-category-choice="barbas"]').click();
          assert.equal(await page.locator('.app-bottom-nav a[aria-current="page"]').getAttribute('href'), '/cortes', 'Cortes marcado dentro da categoria');
        }
      }
    }
    if (width === 941) {
      await page.locator('[data-price-category="cabelo"]').click();
      await page.locator('.services-prices-detail-book').first().click();
      assert.equal(new URL(page.url()).pathname, '/agendamento');
      assert.match(await page.locator('#booking-preselected').textContent(), /Corte com máquina.*R\$\s*35,00/);
    }
    await page.close();
  }
  for (const [index, expected] of [
    [1, /Cabelo \+ barba com espuma quente.*R\$\s*55,00/],
    [2, /Cabelo \+ barboterapia com vapor de ozônio.*R\$\s*60,00/]
  ]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${origin}/servicos-precos`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('services-prices-status').textContent === '');
    await page.locator('[data-price-category="combos"]').click();
    await page.locator('.services-prices-detail-book').nth(index).click();
    assert.equal(new URL(page.url()).pathname, '/agendamento');
    assert.match(await page.locator('#booking-preselected').textContent(), expected);
    await page.close();
  }
  const hairPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await hairPage.goto(`${origin}/servicos-precos`, { waitUntil: 'domcontentloaded' });
  await hairPage.waitForFunction(() => document.getElementById('services-prices-status').textContent === '');
  await hairPage.locator('[data-price-category="cabelo"]').click();
  await hairPage.locator('.services-prices-detail-book').last().click();
  assert.equal(new URL(hairPage.url()).pathname, '/agendamento');
  assert.match(await hairPage.locator('#booking-preselected').textContent(), /Relaxamento capilar.*R\$\s*35,00/);
  await hairPage.close();
  const beardPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await beardPage.goto(`${origin}/servicos-precos`, { waitUntil: 'domcontentloaded' });
  await beardPage.waitForFunction(() => document.getElementById('services-prices-status').textContent === '');
  await beardPage.locator('[data-price-category="barba"]').click();
  await beardPage.locator('.services-prices-detail-book').nth(3).click();
  assert.equal(new URL(beardPage.url()).pathname, '/agendamento');
  assert.match(await beardPage.locator('#booking-preselected').textContent(), /Pezinho.*R\$\s*10,00/);
  await beardPage.close();
  console.log('Serviços & Preços: quatro categorias, preços, rota e agendamento pré-selecionado OK');
} finally {
  await browser.close();
  await new Promise(resolveClosed => server.close(resolveClosed));
  if (!resolve(tempDir).startsWith(resolve(process.cwd()) + sep)) throw new Error('Diretório temporário fora do projeto.');
  rmSync(tempDir, { recursive: true, force: true });
}
