// Phase 5: real browser -> isolated Express -> isolated PostgreSQL.
// This script MUST NOT hit the project's existing :3000/:4000/:5432 services.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chromium } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';

const uiBase = 'http://127.0.0.1:3109';
const apiBase = 'http://127.0.0.1:41118';
if (process.env.OGTB_ISOLATED_PHASE5 !== 'true') throw Error('Explicit isolated QA opt-in required');
const folder=path.resolve('playwright-report/phase5-postgres-integration');
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true});
const records=[];
const password='disposable-only-test-password-2026';
const nonce=randomBytes(5).toString('hex');
const email='p5-browser-added-'+nonce+'@p5.example.test';
try {
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'th-TH',
    timezoneId:'Asia/Bangkok'});
  const login=await context.request.post(apiBase+'/api/auth/login',{
    data:{email:'concurrent-new@p5.example.test',password},
  });
  assert.equal(login.status(),200,'Isolated ADMIN login failed');
  assert.equal((await login.json()).user.role,'ADMIN');
  const cookies=await context.cookies(uiBase);
  assert.ok(cookies.some(x=>x.name==='ogtb_session'&&x.httpOnly),'Admin cookie is missing');
  const page=await context.newPage();
  const errors=[];
  const requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
    const req=route.request();
    const u=new URL(req.url());
    const target=apiBase+u.pathname+u.search;
    if(!u.pathname.startsWith('/api/'))throw Error('Unexpected API route');
    requests.push({method:req.method(),path:u.pathname,
      ...(req.method()==='POST'&&u.pathname.endsWith('/admins')?{
        keys:Object.keys(req.postDataJSON()).sort(),
      }:{})});
    const response=await route.fetch({url:target,timeout:15000});
    await route.fulfill({response});
  });
  await page.goto(uiBase+'/admin/users',{waitUntil:'domcontentloaded',timeout:16000});
  await page.getByRole('button',{name:'เพิ่ม Admin'}).waitFor({state:'visible',timeout:12000});
  await page.locator('.adminModernRow').filter({hasText:'concurrent-new@p5.example.test'}).waitFor({state:'visible',timeout:15000});
  await page.getByRole('button',{name:'เพิ่ม Admin'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('ชื่อผู้ดูแล',{exact:true}).fill('Browser QA Admin');
  await dialog.getByLabel('อีเมล',{exact:true}).fill(email.toUpperCase());
  await dialog.getByLabel('รหัสผ่าน',{exact:true}).fill(password);
  await dialog.getByLabel('ยืนยันรหัสผ่าน',{exact:true}).fill(password);
  await dialog.getByRole('button',{name:'ตรวจสอบข้อมูล'}).click();
  await dialog.getByRole('heading',{name:'ยืนยันการเพิ่ม Admin'}).waitFor();
  assert.ok(!(await dialog.innerText()).includes(password));
  await page.screenshot({path:path.join(folder,'real-db-confirmation.png'),animations:'disabled'});
  await dialog.getByRole('button',{name:'ยืนยันสร้าง Admin'}).click();
  await page.getByRole('status').filter({hasText:'สร้างบัญชี Admin สำเร็จ'}).waitFor({timeout:15000});
  await page.locator('.adminModernRow').filter({hasText:email}).waitFor({timeout:15000});
  const adminPosts=requests.filter(x=>x.path==='/api/admin/users/admins'&&x.method==='POST');
  assert.equal(adminPosts.length,1);
  assert.deepEqual(adminPosts[0].keys,['email','name','password']);
  assert.ok(requests.filter(x=>x.method==='GET'&&x.path==='/api/admin/users').length>=2);
  await page.screenshot({path:path.join(folder,'real-db-create-success.png'),animations:'disabled'});
  records.push({scenario:'real-dashboard-to-api-to-PostgreSQL-add-admin',pass:true,
    apiPosts:adminPosts.length,refreshes:requests.filter(x=>x.method==='GET'&&x.path==='/api/admin/users').length});
  // Duplicate Email error must not create or replace existing Admin.
  await page.getByRole('button',{name:'เพิ่ม Admin'}).click();
  const duplicateDialog=page.getByRole('dialog');
  await duplicateDialog.getByLabel('ชื่อผู้ดูแล',{exact:true}).fill('Duplicate Admin');
  await duplicateDialog.getByLabel('อีเมล',{exact:true}).fill(email);
  await duplicateDialog.getByLabel('รหัสผ่าน',{exact:true}).fill(password);
  await duplicateDialog.getByLabel('ยืนยันรหัสผ่าน',{exact:true}).fill(password);
  await duplicateDialog.getByRole('button',{name:'ตรวจสอบข้อมูล'}).click();
  await duplicateDialog.getByRole('button',{name:'ยืนยันสร้าง Admin'}).click();
  await duplicateDialog.getByText('อีเมลนี้มีบัญชีอยู่แล้ว กรุณาใช้อีเมลอื่น').waitFor({timeout:10000});
  assert.equal(await duplicateDialog.count(),1);
  await duplicateDialog.getByRole('button',{name:'ยกเลิก'}).click();
  records.push({scenario:'real-duplicate-admin-request-is-rejected',pass:true});
  assert.deepEqual(errors,[]);
  await context.close();

  // A second independent browser context registers a USER and proves
  // Dashboard navigation and Add Admin are not available.
  const guest=await browser.newContext({viewport:{width:390,height:844}});
  const registered=await guest.request.post(apiBase+'/api/auth/register',{
    data:{name:'P5 QA User',email:'p5-browser-user-'+nonce+'@p5.example.test',password},
  });
  assert.equal(registered.status(),201,'Isolated USER registration failed');
  assert.equal((await registered.json()).user.role,'USER');
  const userPage=await guest.newPage();
  await userPage.route('**/api/**',async route=>{
    const u=new URL(route.request().url());
    const response=await route.fetch({url:apiBase+u.pathname+u.search,timeout:15000});
    await route.fulfill({response});
  });
  await userPage.goto(uiBase+'/admin/users',{waitUntil:'domcontentloaded'});
  await userPage.waitForURL(uiBase+'/',{timeout:12000});
  assert.equal(await userPage.getByRole('button',{name:'เพิ่ม Admin'}).count(),0);
  records.push({scenario:'real-USER-session-cannot-open-admin-dashboard',pass:true});
  await guest.close();
} finally {
  await browser.close();
  await writeFile(path.join(folder,'results.json'),JSON.stringify(records,null,2)+'\n');
}
for(const row of records)console.log(JSON.stringify(row));
console.log('P5 real browser integration: '+records.filter(x=>x.pass).length+'/'+records.length+' passed');
