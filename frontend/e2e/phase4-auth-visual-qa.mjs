// Phase 4: non-destructive Playwright CLI auth visual/behavior QA.
// Run: node e2e/phase4-auth-visual-qa.mjs [origin]
// Mocked auth responses, no real credentials or database mutations.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const origin = process.argv[2] || 'http://127.0.0.1:3101';
const dir = path.resolve('playwright-report/phase4-auth');
await mkdir(dir, { recursive: true });

const fixtureUser = { id: 'qa-user', name: 'QA User', email: 'qa@example.test', role: 'USER', isActive: true };
const cases = [
  { label: 'desktop-login', route: '/login', width: 1440, height: 900 },
  { label: 'desktop-register', route: '/register', width: 1440, height: 900 },
  { label: 'tablet-register', route: '/register', width: 820, height: 1180 },
  { label: 'mobile-login', route: '/login', width: 390, height: 844, mobile: true },
  { label: 'mobile-register', route: '/register', width: 390, height: 844, mobile: true },
  { label: 'small-mobile-register', route: '/register', width: 320, height: 700, mobile: true },
  { label: 'login-invalid-credentials', route: '/login', width: 1440, height: 900 },
  { label: 'register-password-mismatch', route: '/register', width: 390, height: 844, mobile: true },
  { label: 'register-email-duplicate', route: '/register', width: 1440, height: 900 },
  { label: 'login-next-success', route: '/login?next=%2Fdonations%2Fnew', width: 1440, height: 900 },
  { label: 'register-success', route: '/register', width: 390, height: 844, mobile: true },
  { label: 'authenticated-login-redirect', route: '/login', width: 1440, height: 900, signedIn: true },
  { label: 'authenticated-register-redirect', route: '/register', width: 390, height: 844, mobile: true, signedIn: true },
];

const browser = await chromium.launch({ headless: true });
const results = [];
for (const scenario of cases) {
  const ctx = await browser.newContext({
    viewport: { width: scenario.width, height: scenario.height },
    isMobile: Boolean(scenario.mobile),
    hasTouch: Boolean(scenario.mobile),
    locale: 'th-TH', timezoneId: 'Asia/Bangkok',
  });
  const page = await ctx.newPage();
  let signedIn = Boolean(scenario.signedIn);
  let loginPosts = 0;
  let registerPosts = 0;
  let lastRegisterPayload = null;
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: signedIn ? 200 : 401,
    contentType: 'application/json',
    body: JSON.stringify(signedIn ? { user: fixtureUser } : { error: 'UNAUTHORIZED' }),
  }));
  await page.route('**/api/auth/login', async (route) => {
    loginPosts++;
    const data = route.request().postDataJSON();
    if (scenario.label === 'login-invalid-credentials') {
      return route.fulfill({ status: 401, contentType: 'application/json',
        body: JSON.stringify({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }) });
    }
    assert.deepEqual(data, { email: 'qa@example.test', password: 'Password123' });
    signedIn = true;
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ user: fixtureUser }) });
  });
  await page.route('**/api/auth/register', async (route) => {
    registerPosts++;
    lastRegisterPayload = route.request().postDataJSON();
    if (scenario.label === 'register-email-duplicate') {
      return route.fulfill({ status: 409, contentType: 'application/json',
        body: JSON.stringify({ message: 'อีเมลนี้ถูกใช้งานแล้ว' }) });
    }
    signedIn = true;
    return route.fulfill({ status: 201, contentType: 'application/json',
      body: JSON.stringify({ user: fixtureUser }) });
  });
  await page.route('**/api/donations/nearby?**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));

  const fillRegister = async (mismatch = false) => {
    await page.locator('#register-name').fill('QA User');
    await page.locator('#register-email').fill('qa@example.test');
    await page.locator('#register-password').fill('Password123');
    await page.locator('#register-confirm').fill(mismatch ? 'AnotherPassword123' : 'Password123');
  };

  try {
    await page.goto(origin + scenario.route, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (scenario.signedIn) {
      await page.waitForURL(origin + '/', { timeout: 15000 });
      assert.equal(await page.locator('.authCard').count(), 0);
    } else {
      await page.locator('.authCard').waitFor({ state: 'visible', timeout: 13000 });
      await page.locator('.appHeaderAuthLoading').waitFor({ state: 'detached', timeout: 12000 });
      const metrics = await page.evaluate(() => ({
        viewport: window.innerWidth,
        docWidth: document.documentElement.scrollWidth,
        formWidth: Math.round(document.querySelector('.authCard').getBoundingClientRect().width),
        formHeading: document.querySelector('.authCard h1')?.textContent,
        visualVisible: getComputedStyle(document.querySelector('.authVisual')).display !== 'none',
        formBackground: getComputedStyle(document.querySelector('.authPanel')).backgroundColor,
      }));
      assert.ok(metrics.docWidth <= metrics.viewport + 3,
        `Horizontal overflow: ${metrics.docWidth} > ${metrics.viewport}`);
      assert.ok(metrics.formWidth > 250 && metrics.formWidth <= 448);
      assert.equal(metrics.visualVisible, scenario.width > 980);
      assert.equal(await page.locator('.authCard h1').count(), 1);
      assert.equal(await page.locator('.authExperience').count(), 1);

      if (scenario.route.startsWith('/login')) {
        assert.equal(await page.getByRole('textbox', { name: 'อีเมล' }).count(), 1);
        await page.locator('#login-password').fill('Password123');
        await page.getByRole('button', { name: 'แสดงรหัสผ่าน' }).click();
        assert.equal(await page.locator('#login-password').getAttribute('type'), 'text');
        await page.getByRole('button', { name: 'ซ่อนรหัสผ่าน' }).click();
        assert.equal(await page.locator('#login-password').getAttribute('type'), 'password');
      } else {
        assert.equal(await page.locator('.authCard input').count(), 4);
        assert.equal(await page.locator('#register-password').getAttribute('minlength'), '8');
      }

      if (scenario.label === 'login-invalid-credentials') {
        await page.locator('#login-email').fill('qa@example.test');
        await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
        await page.locator('.authCard .authErrorNotice').waitFor({ state: 'visible', timeout: 10000 });
        assert.ok((await page.locator('.authCard .authErrorNotice').innerText()).includes('ไม่ถูกต้อง'));
        assert.equal(loginPosts, 1);
        assert.equal(await page.locator('.authCard input[aria-invalid="true"]').count(), 2);
      } else if (scenario.label === 'register-password-mismatch') {
        await fillRegister(true);
        await page.getByRole('button', { name: 'สร้างบัญชี', exact: true }).click();
        assert.equal(await page.locator('.authCard .authErrorNotice').innerText(), 'รหัสผ่านยืนยันไม่ตรงกัน');
        assert.equal(await page.locator('#register-confirm').getAttribute('aria-invalid'), 'true');
        assert.equal(registerPosts, 0);
      } else if (scenario.label === 'register-email-duplicate') {
        await fillRegister();
        await page.getByRole('button', { name: 'สร้างบัญชี', exact: true }).click();
        await page.locator('.authCard .authErrorNotice').waitFor({ state: 'visible', timeout: 10000 });
        assert.equal(await page.locator('.authCard .authErrorNotice').innerText(), 'อีเมลนี้ถูกใช้งานแล้ว');
        assert.equal(registerPosts, 1);
      } else if (scenario.label === 'login-next-success') {
        await page.locator('#login-email').fill('qa@example.test');
        await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
        await page.waitForURL(origin + '/donations/new', { timeout: 15000 });
        assert.equal(loginPosts, 1);
      } else if (scenario.label === 'register-success') {
        await fillRegister();
        await page.getByRole('button', { name: 'สร้างบัญชี', exact: true }).click();
        await page.waitForURL(origin + '/', { timeout: 15000 });
        assert.equal(registerPosts, 1);
        assert.deepEqual(lastRegisterPayload, {
          name: 'QA User', email: 'qa@example.test', password: 'Password123',
        });
      }

      if (!['login-next-success', 'register-success'].includes(scenario.label)) {
        await page.screenshot({ path: path.join(dir, scenario.label + '.png'),
          fullPage: false, animations: 'disabled' });
      }
      results.push({ label: scenario.label, passed: true, metrics });
    }
    if (scenario.signedIn) results.push({ label: scenario.label, passed: true, authenticatedRedirect: true });
    assert.deepEqual(errors, [], 'Unexpected browser errors');
  } catch (error) {
    const screenshot = path.join(dir, scenario.label + '-failed.png');
    await page.screenshot({ path: screenshot }).catch(() => {});
    results.push({ label: scenario.label, passed: false, reason: error.message, errors,
      loginPosts, registerPosts });
  } finally { await ctx.close(); }
}
await browser.close();
for (const result of results) console.log(JSON.stringify(result));
console.log(`Phase 4 Playwright CLI: ${results.filter((r) => r.passed).length}/${results.length} passed`);
if (results.some((r) => !r.passed)) process.exitCode = 1;
