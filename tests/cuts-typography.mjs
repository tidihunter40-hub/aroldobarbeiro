import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { createServer } from '../app-server.mjs';

const playwrightPath = process.env.PLAYWRIGHT_PATH;
if (!playwrightPath) throw new Error('Defina PLAYWRIGHT_PATH com o caminho do módulo playwright/index.mjs.');
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const tempDir = mkdtempSync(join(process.cwd(), '.test-cuts-'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
const server = createServer(join(tempDir, 'bookings.sqlite'));
await new Promise(resolveReady => server.listen(0, '127.0.0.1', resolveReady));
const origin = `http://127.0.0.1:${server.address().port}`;

try {
  for (const width of [320, 390, 941]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    await page.goto(`${origin}/cortes`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    for (const [category, count] of [['masculinos', 18], ['infantis', 5], ['barbas', 5]]) {
      await page.locator(`[data-category-choice="${category}"]`).click();
      assert.equal(await page.locator('.cut-card').count(), count);
      const titles = await page.locator('.cut-card-media h4').evaluateAll(elements => elements.map(title => {
        const media = title.parentElement.getBoundingClientRect();
        const text = title.getBoundingClientRect();
        return {
          name: title.textContent,
          font: getComputedStyle(title).fontFamily,
          inside: text.left >= media.left && text.right <= media.right && text.bottom <= media.bottom,
          bottomGap: media.bottom - text.bottom
        };
      }));
      assert.equal(titles.length, count);
      assert.ok(titles.every(title => title.name && title.font.startsWith('Sora') && title.inside && title.bottomGap <= 20), `${category} ${width}px: nomes legíveis dentro das fotos`);
      const brokenPhotos = await page.locator('.cut-card-media img').evaluateAll(async images => {
        await Promise.all(images.map(async image => {
          image.loading = 'eager';
          try { await image.decode(); } catch { /* reported below */ }
        }));
        return images.filter(image => !image.naturalWidth).map(image => image.src);
      });
      assert.deepEqual(brokenPhotos, [], `${category} ${width}px: fotos carregadas`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${category} ${width}px: sem rolagem horizontal`);
      if (width === 390 && category === 'barbas') await page.screenshot({ path: resolve('preview-cortes-barbas-390.png'), fullPage: true });
      if (width === 390 && category === 'masculinos') await page.screenshot({ path: resolve('preview-cortes-masculinos-390.png'), fullPage: true });
      await page.locator('#cut-category-back').click();
    }
    await page.close();
  }
  console.log('Cortes: fonte e nomes sobre todas as fotos em três tamanhos OK');
} finally {
  await browser.close();
  await new Promise(resolveClosed => server.close(resolveClosed));
  rmSync(tempDir, { recursive: true, force: true });
}
