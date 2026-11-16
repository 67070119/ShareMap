// Phase 2: independent Playwright CLI visual / navigation smoke checks.
// Run: node e2e/phase2-shell-visual-qa.mjs
// Uses read-only public pages and mocked Admin GETs. No test fixtures or DB writes.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const baseURL = process.argv[2] || process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const screenshotDir = path.resolve('playwright-report', 'phase2-shell');
await mkdir(screenshotDir, { recursive: true });

const scenarios = [
  { label: 'home-desktop', url: '/', width: 1440, height: 900 },
  { label: 'login-desktop', url: '/login', width: 1440, height: 900 },
  { label: 'register-mobile', url: '/register', width: 390, height: 844, mobile: true },
  { label: 'home-mobile', url: '/', width: 390, height: 844, mobile: true },
  { label: 'admin-desktop', url: '/admin', width: 1440, height: 900, admin: true },
  { label: 'admin-mobile', url: '/admin/users', width: 390, height: 844, mobile: true, admin: true },
  { label: 'admin-tablet', url: '/admin/donations', width: 820, height: 1180, mobile: true, admin: true },
];
const browser = await chromium.launch({ headless: true });
const results = [];

for (const scenario of scenarios) {
  const context = await browser.newContext({
    viewport: { width: scenario.width, height: scenario.height },
    isMobile: Boolean(scenario.mobile),
    hasTouch: Boolean(scenario.mobile),
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    permissions: [],
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  if (scenario.admin) {
    await page.route('**/api/auth/me', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ user: { id: 'visual-admin', name: 'Visual QA', role: 'ADMIN', isActive: true } }),
    }));
    for (const endpoint of ['users', 'donations', 'reports']) {
      await page.route(`**/api/admin/${endpoint}`, (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: '[]',
      }));
    }
  } else {
    await page.route('**/api/auth/me', (route) => route.fulfill({
      status: 401, contentType: 'application/json',
      body: JSON.stringify({ error: 'UNAUTHORIZED', message: 'Guest' }),
    }));
  }

  try {
    await page.goto(baseURL + scenario.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator(scenario.admin ? '.appAdminHeader' : '.appHeader').waitFor({ timeout: 15000 });
    await page.waitForTimeout(380);
    const metrics = await page.evaluate(() => {
      const el = document.querySelector('.appAdminHeader, .appHeader');
      return {
        viewport: window.innerWidth,
        bodyScrollWidth: document.body.scrollWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        headerHeight: Math.round(el.getBoundingClientRect().height),
        background: getComputedStyle(el).backgroundColor,
      };
    });
    assert.ok(metrics.docScrollWidth <= metrics.viewport + 3,
      `Horizontal overflow: ${metrics.docScrollWidth} > ${metrics.viewport}`);

    if (scenario.admin) {
      assert.equal(await page.locator('.appAdminSidebar').isVisible(), !scenario.mobile && scenario.width > 900);
      if (scenario.width > 900) {
        assert.equal(await page.getByRole('navigation', { name: 'ส่วนจัดการระบบ' }).isVisible(), true);
        assert.ok(await page.getByRole('link', { name: 'ภาพรวม' }).count());
      } else {
        const menu = page.getByRole('button', { name: 'เปิดเมนู' });
        await menu.click();
        assert.equal(await page.getByRole('navigation', { name: 'เมนู Admin บนมือถือ' }).isVisible(), true);
        assert.equal(await page.getByRole('navigation', { name: 'เมนู Admin บนมือถือ' }).getByRole('link', { name: 'ผู้ใช้' }).count(), 1);
        const adminDrawer = await page.locator('.appNavDrawer').boundingBox();
        assert.ok(adminDrawer && adminDrawer.height >= scenario.height - 3, 'Admin drawer must cover viewport height');
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
        await page.screenshot({ path: path.join(screenshotDir, scenario.label + '-drawer.png') });
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('button', { name: 'เปิดเมนู' }).getAttribute('aria-expanded'), 'false');
      }
    } else {
      assert.equal(await page.locator('.appBrand').isVisible(), true);
      if (scenario.mobile) {
        await page.getByRole('button', { name: 'เปิดเมนู' }).click();
        const nav = page.getByRole('navigation', { name: 'เมนูหลักบนมือถือ' });
        assert.equal(await nav.isVisible(), true);
        assert.equal(await nav.getByRole('link', { name: 'แผนที่' }).count(), 1);
        const publicDrawer = await page.locator('.appNavDrawer').boundingBox();
        assert.ok(publicDrawer && publicDrawer.height >= scenario.height - 3, 'Public drawer must cover viewport height');
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
        await page.screenshot({ path: path.join(screenshotDir, scenario.label + '-drawer.png') });
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('button', { name: 'เปิดเมนู' }).getAttribute('aria-expanded'), 'false');
      } else {
        assert.equal(await page.getByRole('navigation', { name: 'เมนูหลัก' }).isVisible(), true);
      }
    }

    assert.deepEqual(pageErrors, [], 'Uncaught browser errors');
    const screenshot = path.join(screenshotDir, `${scenario.label}.png`);
    await page.screenshot({ path: screenshot, fullPage: false, animations: 'disabled' });
    results.push({ scenario: scenario.label, passed: true, screenshot, metrics });
  } catch (error) {
    const screenshot = path.join(screenshotDir, `${scenario.label}-failed.png`);
    await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {});
    results.push({ scenario: scenario.label, passed: false, reason: error.message, screenshot, pageErrors });
  } finally {
    await context.close();
  }
}
await browser.close();
for (const result of results) console.log(JSON.stringify(result));
console.log(`Phase 2 Playwright CLI: ${results.filter((r) => r.passed).length}/${results.length} passed`);
if (results.some((r) => !r.passed)) process.exitCode = 1;
