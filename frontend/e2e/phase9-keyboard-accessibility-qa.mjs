// Phase 9 focused keyboard / focus / contrast smoke tests (mock API, no DB writes).
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const origin=process.argv[2]||'http://127.0.0.1:3106';
const out=path.resolve('playwright-report/phase9-full-audit');
await mkdir(out,{recursive:true});
const user={id:'qa-user',role:'USER',name:'QA User',isActive:true};
const admin={id:'qa-admin',role:'ADMIN',name:'QA Admin',isActive:true};
const donation={id:'qa-donation',ownerId:user.id,owner:user,title:'เสื้อผ้าสภาพดี',
  category:'เสื้อผ้า',description:'ของแบ่งปัน',quantity:3,address:'อาคาร A',latitude:13.736,
  longitude:100.79,status:'AVAILABLE',isHidden:false,
  startDate:'2026-01-01T00:00:00.000Z',endDate:'2027-01-01T00:00:00.000Z',
  images:[{id:'one',imageUrl:'/uploads/1.png'},{id:'two',imageUrl:'/uploads/2.png'}]};
const report={id:'qa-report',reason:'FRAUD',status:'PENDING',description:'QA report',donation,reporter:user,
  createdAt:'2026-11-15T00:00:00.000Z'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
const tests=[
 ['mobile drawer Escape restores focus','/', 'guest',390,async page=>{
  const trigger=page.getByRole('button',{name:'เปิดเมนู'});
  await trigger.click();
  await page.getByRole('navigation',{name:'เมนูหลักบนมือถือ'}).waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button',{name:'เปิดเมนู'}).getAttribute('aria-expanded'),'false');
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'เปิดเมนู');
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
 }],
 ['login keyboard focus and reveal','/login','guest',1440,async page=>{
  const email=page.locator('#login-email');
  await email.focus();
  assert.equal(await email.evaluate(el=>el.matches(':focus-visible')),true);
  const reveal=page.getByRole('button',{name:'แสดงรหัสผ่าน'});
  await reveal.focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#login-password').getAttribute('type'),'text');
  assert.equal(await page.getByRole('button',{name:'ซ่อนรหัสผ่าน'}).getAttribute('aria-pressed'),'true');
 }],
 ['register announces mismatch','/register','guest',390,async page=>{
  await page.locator('#register-name').fill('QA Tester');
  await page.locator('#register-email').fill('qa@example.test');
  await page.locator('#register-password').fill('abcdefghAA1!');
  await page.locator('#register-confirm').fill('abcdefghBB1!');
  await page.getByRole('button',{name:'สร้างบัญชี'}).click();
  assert.equal(await page.locator('.authErrorNotice[role=alert]').count(),1);
  assert.equal(await page.locator('#register-confirm').getAttribute('aria-invalid'),'true');
 }],
 ['donation picker Escape restores focus','/donations/new','user',390,async page=>{
  const trigger=page.getByRole('button',{name:'เลือกตำแหน่งบนแผนที่'});
  await trigger.click();
  const dlg=page.getByRole('dialog',{name:'เลือกตำแหน่งจุดรับของ'});
  await dlg.waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
  await page.keyboard.press('Escape');
  assert.equal(await dlg.count(),0);
  assert.equal(await trigger.evaluate(el=>document.activeElement===el),true);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
 }],
 ['gallery arrow and Escape focus restore','/donations/qa-donation','user',1440,async page=>{
  await page.getByRole('button',{name:'เปิดรูปของบริจาคแบบเต็มจอ'}).click();
  const dlg=page.getByRole('dialog',{name:'รูปของบริจาคแบบเต็มจอ'});
  await dlg.waitFor({state:'visible'});
  await page.keyboard.press('ArrowRight');
  assert.ok((await dlg.innerText()).includes('2 / 2'));
  await page.keyboard.press('Escape');
  assert.equal(await dlg.count(),0);
  assert.equal(await page.getByRole('button',{name:'เปิดรูปของบริจาคแบบเต็มจอ'})
    .evaluate(el=>document.activeElement===el),true);
 }],
 ['report reason radio arrow-key','/donations/qa-donation/report','user',1440,async page=>{
  const first=page.getByRole('radio',{name:/สิ่งของผิดกฎหมาย/});
  await first.focus();
  await page.keyboard.press('Space');
  assert.equal(await first.isChecked(),true);
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.getByRole('radio',{name:/ของอันตราย/}).isChecked(),true);
 }],
 ['admin confirmation Escape no mutation','/admin/donations','admin',390,async page=>{
  const btn=page.getByRole('button',{name:'ลบ'}).first();
  await btn.click();
  const dlg=page.getByRole('dialog');
  await dlg.waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
  await page.keyboard.press('Escape');
  assert.equal(await dlg.count(),0);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  assert.equal(await btn.evaluate(el=>document.activeElement===el),true);
 }],
 ['navigation sheet button keyboard','/donations/qa-donation/navigate','guest',390,async page=>{
  await page.getByRole('button',{name:'เริ่มนำทาง'}).waitFor({state:'visible'});
  const toggle=page.getByRole('button',{name:'ย่อแผงข้อมูล'});
  await toggle.focus();
  await page.keyboard.press('Space');
  const expand=page.getByRole('button',{name:'ขยายแผงข้อมูล'});
  assert.equal(await expand.getAttribute('aria-expanded'),'false');
  await expand.focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('button',{name:'ย่อแผงข้อมูล'}).getAttribute('aria-expanded'),'true');
 }],
 ['theme WCAG AA contrast semantic tokens','/admin','admin',1440,async page=>{
  const ratios=await page.evaluate(()=>{
    const rules=getComputedStyle(document.documentElement);
    const names=['--ui-bg','--ui-surface','--ui-surface-soft','--ui-ink','--ui-text','--ui-muted',
      '--ui-primary','--ui-primary-soft','--ui-primary-contrast','--ui-danger','--ui-danger-soft',
      '--ui-warning','--ui-warning-soft','--ui-success','--ui-success-soft'];
    const colors=Object.fromEntries(names.map(n=>[n,rules.getPropertyValue(n).trim()]));
    function light(hex){
      const channels=[1,3,5].map(i=>{
        const c=parseInt(hex.slice(i,i+2),16)/255;
        return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
      });
      return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
    }
    const pairs=[['--ui-ink','--ui-bg'],['--ui-text','--ui-surface'],['--ui-muted','--ui-surface'],
      ['--ui-muted','--ui-surface-soft'],['--ui-primary','--ui-primary-soft'],
      ['--ui-primary-contrast','--ui-primary'],['--ui-danger','--ui-danger-soft'],
      ['--ui-warning','--ui-warning-soft'],['--ui-success','--ui-success-soft']];
    return pairs.map(([fg,bg])=>{const a=light(colors[fg]),b=light(colors[bg]);
      return {fg,bg,ratio:+((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toFixed(2)};});
  });
  assert.ok(ratios.every(r=>r.ratio>=4.5),'Semantic text colors must meet AA 4.5:1');
 }],
];
const browser=await chromium.launch({headless:true});
const results=[];
for(const [name,route,role,w,fn] of tests){
 const ctx=await browser.newContext({viewport:{width:w,height:w<600?844:900},isMobile:w<600,hasTouch:w<600,
   locale:'th-TH',timezoneId:'Asia/Bangkok',permissions:['geolocation'],
   geolocation:{latitude:13.7291,longitude:100.7789,accuracy:12},reducedMotion:'reduce'});
 const page=await ctx.newPage();const writes=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/uploads/*.png',r=>r.fulfill({status:200,contentType:'image/png',body:png}));
 await page.route('**/api/**',r=>{
   const p=new URL(r.request().url()).pathname,m=r.request().method();
   const json=(code,data)=>r.fulfill({status:code,contentType:'application/json',body:JSON.stringify(data)});
   if(m!=='GET'){writes.push(m+' '+p);return json(403,{message:'Mutations blocked in accessibility audit'});}
   if(p==='/api/auth/me')return role==='guest'?json(401,{message:'Guest'}):json(200,{user:role==='admin'?admin:user});
   if(p==='/api/donations/nearby')return json(200,[{...donation,distanceKm:.8}]);
   if(p==='/api/donations/qa-donation')return json(200,donation);
   if(p==='/api/routes')return json(200,{distanceMeters:900,durationSeconds:180,
     geometry:{type:'LineString',coordinates:[[100.7789,13.7291],[donation.longitude,donation.latitude]]},
     steps:[{distanceMeters:900,durationSeconds:180,instruction:'arrive',location:[donation.longitude,donation.latitude]}]});
   if(p==='/api/admin/donations')return json(200,[donation]);
   if(p==='/api/admin/users')return json(200,[user,admin]);
   if(p==='/api/admin/reports')return json(200,[report]);
   return json(404,{message:'Mock GET '+p});
 });
 try{
  await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:19000});
  if(route==='/')await page.locator('.mapExperience').waitFor({state:'visible',timeout:12000});
  if(route.includes('/navigate'))await page.locator('.navBottomSheet').waitFor({state:'visible',timeout:12000});
  await fn(page);
  assert.deepEqual(writes,[],'Unexpected API mutation');
  assert.deepEqual(errors,[],'Uncaught JS errors');
  results.push({name,passed:true});
 }catch(e){
  await page.screenshot({path:path.join(out,'keyboard-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-FAILED.png')}).catch(()=>{});
  results.push({name,passed:false,error:e.message,writes,errors});
 }finally{await ctx.close();}
}
await browser.close();
await writeFile(path.join(out,'keyboard-a11y.json'),JSON.stringify(results,null,2));
for(const r of results)console.log(JSON.stringify(r));
console.log(`Phase 9 Keyboard/Accessibility: ${results.filter(x=>x.passed).length}/${results.length} passed`);
if(results.some(x=>!x.passed))process.exitCode=1;
