// Run from frontend/: node e2e/phase3-map-visual-qa.mjs [origin]
// Phase 3 read-only visual + interaction regression; all APIs are mocked.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const origin = process.argv[2] || process.env.E2E_BASE_URL || 'http://127.0.0.1:3100';
const output = path.resolve('playwright-report/phase3-map');
await mkdir(output, { recursive: true });

const fixture = [
  { id: 'qa-1', title: 'เสื้อผ้าสภาพดี', category: 'เสื้อผ้า', quantity: 8, distanceKm: .8, latitude: 13.7302, longitude: 100.7799, images: [], status: 'AVAILABLE', isHidden: false },
  { id: 'qa-2', title: 'หนังสือและสมุด', category: 'หนังสือ', quantity: 12, distanceKm: 1.6, latitude: 13.7278, longitude: 100.7749, images: [], status: 'AVAILABLE', isHidden: false },
  { id: 'qa-3', title: 'ของใช้ในบ้าน', category: 'ของใช้', quantity: 4, distanceKm: 2.2, latitude: 13.7352, longitude: 100.7802, images: [], status: 'AVAILABLE', isHidden: false },
];
const scenarios = [
  { name: 'desktop-list-map', width: 1440, height: 900, geolocation: true },
  { name: 'tablet-bottom-sheet', width: 820, height: 1180, geolocation: true, mobile: true },
  { name: 'mobile-bottom-sheet', width: 390, height: 844, geolocation: true, mobile: true },
  { name: 'mobile-small-sheet', width: 320, height: 700, geolocation: true, mobile: true },
  { name: 'mobile-location-denied', width: 390, height: 844, geolocation: false, mobile: true },
  { name: 'desktop-nearby-failure', width: 1440, height: 900, geolocation: true, apiFailure: true },
  { name: 'desktop-empty-results', width: 1440, height: 900, geolocation: true, emptyResults: true },
  { name: 'desktop-return-query', width: 1440, height: 900, geolocation: true, url: '/?category=%E0%B8%AB%E0%B8%99%E0%B8%B1%E0%B8%87%E0%B8%AA%E0%B8%B7%E0%B8%AD&radius=10' },
];

const browser = await chromium.launch({ headless: true });
const results = [];

for (const scenario of scenarios) {
  const context = await browser.newContext({
    viewport: { width: scenario.width, height: scenario.height },
    locale: 'th-TH', timezoneId: 'Asia/Bangkok',
    hasTouch: Boolean(scenario.mobile), isMobile: Boolean(scenario.mobile),
    permissions: scenario.geolocation ? ['geolocation'] : [],
    geolocation: scenario.geolocation ? { latitude: 13.7291, longitude: 100.7789, accuracy: 14 } : undefined,
  });
  const page = await context.newPage();
  const errors = [];
  const queries = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'UNAUTHORIZED' }) }));
  await page.route('**/api/donations/nearby?**', (route) => {
    queries.push(new URL(route.request().url()).searchParams.toString());
    if (scenario.apiFailure) {
      return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ message: 'Test provider unavailable' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(scenario.emptyResults ? [] : fixture) });
  });
  // Map tiles are a visual enhancement, not a dependency for API/GPS/UI checks.
  try {
    await page.goto(origin + (scenario.url || '/'), { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('.mapExperience .mapResultsSheet').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('.appHeaderAuthLoading').waitFor({ state: 'detached', timeout: 12000 });
    if (scenario.geolocation) {
      await page.waitForTimeout(950);
      if (scenario.apiFailure) {
        await page.locator('.mapPanelEmptyError').waitFor({ state: 'attached', timeout: 13000 });
      } else if (scenario.emptyResults) {
        await page.locator('.mapPanelEmpty').first().waitFor({ state: 'visible', timeout: 13000 });
      } else {
        await page.locator('.mapResultCard').first().waitFor({ state: 'attached', timeout: 13000 });
      }
    }

    const dims = await page.evaluate(() => ({
      viewport: window.innerWidth,
      docWidth: document.documentElement.scrollWidth,
      mapVisible: Boolean(document.querySelector('.pawMapCanvas')),
      topbarHeight: Math.round(document.querySelector('.appHeader').getBoundingClientRect().height),
    }));
    assert.ok(dims.docWidth <= dims.viewport + 3, `Document overflow ${dims.docWidth} > ${dims.viewport}`);
    assert.equal(dims.mapVisible, true);

    if (scenario.mobile) {
      const sheet = page.locator('.mapResultsSheet');
      assert.equal(await sheet.getAttribute('aria-label'), 'ค้นหาและรายการจุดบริจาค');
      const toggle = page.getByRole('button', { name: 'เปิดแผงค้นหาจุดบริจาค' });
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      await page.screenshot({ path: path.join(output, scenario.name + '-closed.png'), animations: 'disabled' });
      await toggle.click();
      assert.equal(await page.getByRole('button', { name: 'ย่อแผงค้นหาจุดบริจาค' }).getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('.mapPanelFilters').isVisible(), true);
      await page.screenshot({ path: path.join(output, scenario.name + '-expanded.png'), animations: 'disabled' });
      if (scenario.geolocation) {
        const category = page.getByRole('textbox', { name: 'กรองตามประเภทของบริจาค' });
        await category.fill('เสื้อผ้า');
        await page.waitForResponse((r) => r.url().includes('/api/donations/nearby?') && new URL(r.url()).searchParams.get('category') === 'เสื้อผ้า', { timeout: 12000 });
        await page.locator('.radiusSlider').focus();
        await page.keyboard.press('End');
        await page.waitForResponse((r) => r.url().includes('/api/donations/nearby?') && new URL(r.url()).searchParams.get('radius') === '500', { timeout: 12000 });
        await page.locator('.mapResultSelect').first().click();
        assert.equal(await page.getByRole('button', { name: 'เปิดแผงค้นหาจุดบริจาค' }).getAttribute('aria-expanded'), 'false');
        assert.ok((await page.locator('.mapResultDetail').first().getAttribute('href')).includes('returnTo='));
      } else {
        assert.equal(await page.getByRole('textbox', { name: 'กรองตามประเภทของบริจาค' }).isDisabled(), true);
        assert.equal(await page.locator('.mapPanelEmpty').first().isVisible(), true);
      }
    } else {
      assert.equal(await page.locator('.mapSheetToggle').isVisible(), false);
      assert.equal(await page.locator('.mapPanelFilters').isVisible(), true);
      if (scenario.emptyResults) {
        assert.equal(await page.locator('.mapPanelEmpty').first().isVisible(), true);
        assert.equal(await page.locator('.mapResultCard').count(), 0);
      } else if (scenario.apiFailure) {
        assert.equal(await page.locator('.mapPanelEmptyError').isVisible(), true);
        const before = queries.length;
        await page.locator('.mapPanelEmptyError .mapPanelRetry').click();
        await page.waitForResponse((response) => response.url().includes('/api/donations/nearby?') && response.status() === 502, { timeout: 10000 });
        assert.equal(queries.length, before + 1, 'Retry should refetch without requiring new GPS coordinates');
      } else {
        assert.equal(await page.locator('.mapResultCard').count(), fixture.length);
        await page.locator('.mapResultSelect').first().click();
        assert.equal(await page.locator('.mapResultCard.isSelected').count(), 1);
        await page.locator('.leaflet-popup').waitFor({ state: 'visible', timeout: 12000 });
        const href = await page.locator('.mapResultDetail').first().getAttribute('href');
        if (scenario.url) {
          const returned = new URL(href, origin).searchParams.get('returnTo');
          assert.equal(new URLSearchParams(returned.slice(2)).get('category'), 'หนังสือ');
          assert.equal(new URLSearchParams(returned.slice(2)).get('radius'), '10');
          assert.equal(await page.url(), origin + '/');
          assert.equal(queries.some((q) => new URLSearchParams(q).get('category') === 'หนังสือ'), true);
        } else {
          assert.equal(href, '/donations/qa-1');
          const field = page.getByRole('textbox', { name: 'กรองตามประเภทของบริจาค' });
          await field.fill('หนังสือ');
          await page.waitForResponse((r) => r.url().includes('/api/donations/nearby?') && new URL(r.url()).searchParams.get('category') === 'หนังสือ', { timeout: 12000 });
        }
      }
    }

    assert.deepEqual(errors, [], 'Unexpected client-side errors');
    await page.screenshot({ path: path.join(output, scenario.name + '-final.png'), animations: 'disabled' });
    results.push({ scenario: scenario.name, passed: true, queries, dims });
  } catch (error) {
    await page.screenshot({ path: path.join(output, scenario.name + '-failed.png') }).catch(() => {});
    results.push({ scenario: scenario.name, passed: false, message: error.message, errors, queries });
  } finally {
    await context.close();
  }
}
await browser.close();
for (const result of results) console.log(JSON.stringify(result));
console.log(`Phase 3 Playwright CLI: ${results.filter((x) => x.passed).length}/${results.length} passed`);
if (results.some((x) => !x.passed)) process.exitCode = 1;
