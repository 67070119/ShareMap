// Phase 6 — Playwright CLI read-only visual & behavioral verification.
// Run: node e2e/phase6-detail-report-qa.mjs [origin]
// API is fully mocked to avoid writing to production data.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const origin = process.argv[2] || 'http://127.0.0.1:3103';
const folder = path.resolve('playwright-report/phase6-detail-report');
await mkdir(folder, { recursive: true });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
const owner = { id: 'qa-owner', role: 'USER', name: 'QA Owner', email: 'owner@example.test', isActive: true };
const visitor = { id: 'qa-visitor', role: 'USER', name: 'QA Visitor', email: 'visitor@example.test', isActive: true };
const listing = {
  id:'qa-1', ownerId:owner.id, title:'เสื้อผ้าสภาพดี', description:'เสื้อผ้าพร้อมแบ่งปัน\nสะอาดและใช้งานได้',
  category:'เสื้อผ้า', quantity:6, address:'อาคาร A', latitude:13.7291,longitude:100.7789,
  startDate:'2026-01-01T00:00:00.000Z',endDate:'2027-01-01T00:00:00.000Z',
  status:'AVAILABLE',isHidden:false,
  owner:{id:owner.id,name:owner.name},
  images:[{id:'img-1',imageUrl:'/uploads/qa-1.png'},{id:'img-2',imageUrl:'/uploads/qa-2.png'}],
};
const scenarios = [
  { name:'detail-desktop', route:'/donations/qa-1', w:1440,h:900 },
  { name:'detail-tablet', route:'/donations/qa-1', w:820,h:1180 },
  { name:'detail-mobile', route:'/donations/qa-1', w:390,h:844 },
  { name:'detail-small-mobile', route:'/donations/qa-1', w:320,h:700 },
  { name:'detail-gallery-lightbox', route:'/donations/qa-1', w:1440,h:900,action:'gallery' },
  { name:'detail-empty-gallery', route:'/donations/qa-1', w:390,h:844,emptyImages:true },
  { name:'detail-out-of-stock', route:'/donations/qa-1', w:1440,h:900,status:'OUT_OF_STOCK' },
  { name:'detail-expired', route:'/donations/qa-1', w:390,h:844,status:'EXPIRED' },
  { name:'detail-return-to', route:'/donations/qa-1?returnTo=%2F%3Fcategory%3Dfood%26radius%3D10', w:1440,h:900,action:'return' },
  { name:'owner-stock', route:'/donations/qa-1', w:1440,h:900,owner:true,action:'stock' },
  { name:'owner-delete', route:'/donations/qa-1', w:390,h:844,owner:true,action:'delete' },
  { name:'owner-stock-error', route:'/donations/qa-1', w:1440,h:900,owner:true,action:'stock-error' },
  { name:'detail-not-found', route:'/donations/qa-1', w:1440,h:900,action:'not-found' },
  { name:'report-desktop', route:'/donations/qa-1/report', w:1440,h:900 },
  { name:'report-mobile', route:'/donations/qa-1/report', w:390,h:844 },
  { name:'report-small-mobile', route:'/donations/qa-1/report', w:320,h:700 },
  { name:'report-guest', route:'/donations/qa-1/report', w:390,h:844,guest:true },
  { name:'report-required-reason', route:'/donations/qa-1/report', w:1440,h:900,action:'reason-required' },
  { name:'report-success', route:'/donations/qa-1/report', w:390,h:844,action:'report-success' },
  { name:'report-error-retry', route:'/donations/qa-1/report', w:1440,h:900,action:'report-error-retry' },
  { name:'report-auth-expired', route:'/donations/qa-1/report', w:1440,h:900,action:'report-401' },
];
const browser=await chromium.launch({headless:true});
const results=[];
for(const s of scenarios) {
  const ctx=await browser.newContext({
    viewport:{width:s.w,height:s.h},isMobile:s.w<600,hasTouch:s.w<600,
    timezoneId:'Asia/Bangkok',locale:'th-TH',
  });
  const page=await ctx.newPage();
  const requests={stock:0,deleted:0,reported:0,reportPayload:null};
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const current={...listing,images:s.emptyImages?[]:listing.images,status:s.status||listing.status};
  let failReport=s.action==='report-error-retry';
  await page.route('**/uploads/qa-*.png',r=>r.fulfill({status:200,contentType:'image/png',body:png}));
  await page.route('**/api/**',route=>{
    const req=route.request(),u=new URL(req.url()),endpoint=u.pathname,method=req.method();
    const json=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(endpoint==='/api/auth/me')return json(s.guest?401:200,s.guest?{error:'UNAUTHORIZED'}:{user:s.owner?owner:visitor});
    if(endpoint==='/api/donations/qa-1'&&method==='GET')return s.action==='not-found'
      ?json(404,{message:'ไม่พบจุดบริจาค'}):json(200,current);
    if(endpoint==='/api/donations/qa-1/out-of-stock'&&method==='PATCH'){
      requests.stock++;
      if(s.action==='stock-error')return json(502,{message:'Mock stock error'});
      current.status='OUT_OF_STOCK';
      return json(200,current);
    }
    if(endpoint==='/api/donations/qa-1'&&method==='DELETE'){
      requests.deleted++;return route.fulfill({status:204,body:''});
    }
    if(endpoint==='/api/donations/qa-1/reports'&&method==='POST'){
      requests.reported++;
      requests.reportPayload=req.postDataJSON();
      if(s.action==='report-401')return json(401,{message:'Session expired'});
      if(failReport){failReport=false;return json(502,{message:'Mock report error'});}
      return json(201,{id:'report-mock',reason:requests.reportPayload.reason});
    }
    if(endpoint==='/api/donations/nearby')return json(200,[]);
    return json(404,{message:`Unmapped mock endpoint ${endpoint}`});
  });

  try {
    await page.goto(origin+s.route,{waitUntil:'domcontentloaded',timeout:19000});
    if(s.guest){
      await page.waitForURL(origin+'/login?next=/donations/qa-1/report',{timeout:13000});
      assert.equal(requests.reported,0);
      results.push({scenario:s.name,passed:true,redirected:true});
      continue;
    }
    if(s.action==='not-found'){
      await page.getByRole('alert').first().waitFor({state:'visible',timeout:12000});
      assert.ok((await page.locator('.donationDetailExperience .errorBox').innerText()).includes('ไม่พบ'));
      results.push({scenario:s.name,passed:true,notFound:true});
      continue;
    }
    const isReport=s.route.includes('/report');
    await page.locator(isReport?'.donationReportExperience .reportPortCard':'.donationDetailExperience .pointHeroCard')
      .waitFor({state:'visible',timeout:13000});
    const dims=await page.evaluate(()=>({
      viewport:innerWidth,docWidth:document.documentElement.scrollWidth,
      heading:document.querySelector('main h1')?.textContent,
      bodyBackground:getComputedStyle(document.body).backgroundColor,
    }));
    assert.ok(dims.docWidth<=dims.viewport+3,`Horizontal overflow ${dims.docWidth} > ${dims.viewport}`);
    assert.deepEqual(errors,[], 'Unexpected JS errors before interaction');

    if(isReport){
      assert.equal(await page.locator('.reportReasonOption').count(),5);
      if(s.action==='reason-required'){
        await page.getByRole('button',{name:'ส่งรายงาน'}).click();
        await page.locator('.reportErrorNotice').waitFor({state:'visible',timeout:8000});
        assert.equal(requests.reported,0);
        assert.ok((await page.locator('.reportErrorNotice').innerText()).includes('เลือกเหตุผล'));
      }else if(s.action==='report-success'){
        await page.getByRole('radio',{name:/ข้อมูลหลอกลวง/}).check();
        await page.locator('#report-description').fill('พบข้อความหลอกลวง');
        await page.getByRole('button',{name:'ส่งรายงาน'}).click();
        await page.waitForURL(url=>url.pathname==='/donations/qa-1',{timeout:12000});
        assert.equal(requests.reported,1);
        assert.deepEqual(requests.reportPayload,{reason:'FRAUD',description:'พบข้อความหลอกลวง'});
      }else if(s.action==='report-error-retry'){
        await page.getByRole('radio',{name:/สิ่งของผิดกฎหมาย/}).check();
        await page.locator('#report-description').fill('ตรวจสอบด้วย');
        assert.ok((await page.locator('.reportDescriptionCounter').innerText()).includes('/1000'));
        await page.getByRole('button',{name:'ส่งรายงาน'}).click();
        await page.locator('.reportErrorNotice').waitFor({state:'visible',timeout:10000});
        assert.equal(requests.reported,1);
        await page.getByRole('button',{name:'ส่งรายงาน'}).click();
        await page.waitForURL(url=>url.pathname==='/donations/qa-1',{timeout:12000});
        assert.equal(requests.reported,2);
      }else if(s.action==='report-401'){
        await page.getByRole('radio',{name:/ของอันตราย/}).check();
        await page.getByRole('button',{name:'ส่งรายงาน'}).click();
        await page.waitForURL(origin+'/login?next=/donations/qa-1/report',{timeout:12000});
        assert.equal(requests.reported,1);
      }else{
        await page.getByRole('radio',{name:/เหตุผลอื่น/}).check();
        assert.equal(await page.locator('.reportReasonOption.isSelected').count(),1);
        await page.locator('#report-description').fill('เพิ่มเติม');
        assert.equal(await page.locator('.reportDescriptionCounter').innerText(),'9/1000');
      }
    }else{
      assert.equal(await page.locator('.pointStatusBadge').count(),1);
      if(s.emptyImages)assert.equal(await page.locator('.pointHeroFallback').count(),1);
      else assert.equal(await page.locator('.pointThumbButton').count(),2);
      if(['OUT_OF_STOCK','EXPIRED'].includes(s.status)){
        assert.equal(await page.getByRole('link',{name:/นำทางไปจุดนี้/}).count(),0);
        assert.equal(await page.locator('.pointAvailabilityHint').count(),1);
      }
      if(s.action==='return'){
        const href=await page.getByRole('link',{name:/กลับแผนที่/}).first().getAttribute('href');
        assert.equal(href,'/?category=food&radius=10');
      }
      if(s.action==='gallery'){
        await page.getByRole('button',{name:'เลือกรูปที่ 2'}).click();
        assert.equal(await page.locator('.pointThumbButton.isActive').count(),1);
        await page.getByRole('button',{name:'เปิดรูปของบริจาคแบบเต็มจอ'}).click();
        const modal=page.getByRole('dialog',{name:'รูปของบริจาคแบบเต็มจอ'});
        await modal.waitFor({state:'visible',timeout:9000});
        assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
        await page.keyboard.press('ArrowRight');
        assert.equal(await modal.locator('.pointLightboxTop span').innerText(),'1 / 2');
        await page.getByRole('button',{name:'รูปก่อนหน้า'}).click();
        assert.equal(await modal.locator('.pointLightboxTop span').innerText(),'2 / 2');
        await page.screenshot({path:path.join(folder,s.name+'-lightbox.png'),animations:'disabled'});
        await page.keyboard.press('Escape');
        assert.equal(await modal.count(),0);
        assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
      }
      if(['stock','delete','stock-error'].includes(s.action)){
        assert.equal(await page.getByRole('link',{name:/แก้ไขโพสต์/}).count(),1);
        const danger=s.action==='delete';
        const action=page.getByRole('button',{name:danger?'ลบโพสต์':'ของหมดแล้ว'});
        await action.click();
        const confirm=page.getByRole('dialog');
        await confirm.waitFor({state:'visible',timeout:9000});
        await confirm.getByRole('button',{name:'ยกเลิก'}).click();
        assert.equal(await confirm.count(),0);
        assert.equal(requests.stock+requests.deleted,0);
        await action.click();
        if(danger){
          await confirm.getByRole('button',{name:'ยืนยันลบโพสต์'}).click();
          await page.waitForURL(origin+'/',{timeout:12000});
          assert.equal(requests.deleted,1);
        }else{
          await confirm.getByRole('button',{name:'ยืนยันว่าของหมด'}).click();
          if(s.action==='stock-error'){
            await page.locator('.pointDetailNotice.errorBox').waitFor({state:'visible',timeout:9000});
            assert.equal(requests.stock,1);
          }else{
            await page.locator('.pointStatusBadge--out_of_stock').waitFor({state:'visible',timeout:9000});
            assert.equal(requests.stock,1);
            assert.equal(await page.getByRole('link',{name:/นำทางไปจุดนี้/}).count(),0);
          }
        }
      }
      if(!s.owner&&s.status==='AVAILABLE'&&s.action!=='not-found'){
        assert.equal(await page.getByRole('link',{name:'รายงานโพสต์'}).count(),1);
      }
    }
    assert.deepEqual(errors,[],'Unexpected JS errors after interaction');
    if(!['report-success','report-error-retry','report-401','delete'].includes(s.action)){
      await page.screenshot({path:path.join(folder,s.name+'.png'),animations:'disabled'});
    }
    results.push({scenario:s.name,passed:true,dims,requests});
  }catch(error){
    await page.screenshot({path:path.join(folder,s.name+'-failed.png'),animations:'disabled'}).catch(()=>{});
    results.push({scenario:s.name,passed:false,reason:error.message,errors,requests});
  }finally{
    await ctx.close();
  }
}
await browser.close();
for(const r of results)console.log(JSON.stringify(r));
console.log(`Phase 6 Playwright CLI: ${results.filter(x=>x.passed).length}/${results.length} passed`);
if(results.some(x=>!x.passed))process.exitCode=1;
