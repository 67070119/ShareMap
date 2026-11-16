// OGTB Phase 7 Playwright command-line visual and workflow QA.
// Run from frontend: node e2e/phase7-navigation-visual-qa.mjs [baseOrigin]
// Donation/OSRM responses are mocked: no DB writes or backend routing changes.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const origin = process.argv[2] || 'http://127.0.0.1:3104';
const folder = path.resolve('playwright-report/phase7-navigation');
await mkdir(folder, { recursive: true });

const gps = { latitude:13.7291, longitude:100.7789, accuracy:18 };
const donation = {
  id:'qa-nav',title:'จุดรับของบริจาค',description:'ของบริจาคทดสอบ UI',
  latitude:13.7360,longitude:100.7900,address:'สถานที่รับของบริจาค',
  status:'AVAILABLE',isHidden:false,ownerId:'qa-owner',
  startDate:'2026-01-01T00:00:00Z',endDate:'2027-12-30T00:00:00Z',images:[],
};
const routeFixture = {
  distanceMeters:1650,durationSeconds:480,
  geometry:{type:'LineString',coordinates:[
    [gps.longitude,gps.latitude],[100.7835,13.732],[donation.longitude,donation.latitude],
  ]},
  steps:[
    {distanceMeters:700,durationSeconds:200,name:'ถนนสายหลัก',instruction:'turn',modifier:'right',location:[100.7835,13.732]},
    {distanceMeters:950,durationSeconds:280,name:'',instruction:'arrive',modifier:null,location:[donation.longitude,donation.latitude]},
  ],
};
const scenarios = [
  { name:'desktop-route', w:1440,h:900 },
  { name:'tablet-route', w:820,h:1180 },
  { name:'mobile-route', w:390,h:844 },
  { name:'small-mobile-route', w:320,h:700 },
  { name:'landscape-route', w:844,h:390 },
  { name:'desktop-active', w:1440,h:900, action:'active' },
  { name:'mobile-active', w:390,h:844, action:'active' },
  { name:'mobile-collapse', w:390,h:844, action:'collapse' },
  { name:'desktop-route-retry', w:1440,h:900, action:'route-retry' },
  { name:'mobile-route-error', w:390,h:844, action:'route-error' },
  { name:'mobile-gps-denied', w:390,h:844, gpsDenied:true },
  { name:'desktop-gps-poor', w:1440,h:900, gpsAccuracy:95 },
  { name:'desktop-out-of-stock', w:1440,h:900, status:'OUT_OF_STOCK' },
  { name:'mobile-expired', w:390,h:844, status:'EXPIRED' },
  { name:'desktop-not-found', w:1440,h:900, notFound:true },
  { name:'mobile-recenter', w:390,h:844, action:'recenter' },
  { name:'mobile-arrived', w:390,h:844, action:'arrived' },
  { name:'mobile-off-route-recovery', w:390,h:844, action:'off-route-recovery' },
  { name:'mobile-off-route-error', w:390,h:844, action:'off-route-error' },
];

const browser=await chromium.launch({headless:true});
const results=[];
for(const s of scenarios) {
  const ctx=await browser.newContext({
    viewport:{width:s.w,height:s.h},isMobile:s.w<600,hasTouch:s.w<600,
    locale:'th-TH',timezoneId:'Asia/Bangkok',
    permissions:s.gpsDenied?[]:['geolocation'],
    geolocation:s.gpsDenied?undefined:{...gps,accuracy:s.gpsAccuracy||gps.accuracy},
  });
  const page=await ctx.newPage();
  let routeMode=s.action==='route-retry'?'timeout':s.action==='route-error'?'not-found':'success';
  let routeRequests=0;
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  await page.route('**/api/**',r=>{
    const u=new URL(r.request().url());
    const json=(code,v)=>r.fulfill({status:code,contentType:'application/json',body:JSON.stringify(v)});
    if(u.pathname==='/api/auth/me')return json(401,{error:'UNAUTHORIZED'});
    if(u.pathname==='/api/donations/qa-nav'){
      if(s.notFound)return json(404,{message:'ไม่พบจุดบริจาค'});
      return json(200,{...donation,status:s.status||'AVAILABLE'});
    }
    if(u.pathname==='/api/routes'){
      routeRequests++;
      if(routeMode==='timeout')return json(504,{error:'ROUTING_TIMEOUT',message:'QA timeout'});
      if(routeMode==='not-found')return json(404,{error:'ROUTE_NOT_FOUND',message:'QA route not found'});
      return json(200,routeFixture);
    }
    return json(404,{message:'Mock endpoint not mapped'});
  });

  try {
    await page.goto(origin+'/donations/qa-nav/navigate',{waitUntil:'domcontentloaded',timeout:20000});
    if(s.notFound){
      await page.locator('.navStandaloneState .navStateError').waitFor({state:'visible',timeout:12000});
      assert.equal(routeRequests,0);
      await page.screenshot({path:path.join(folder,s.name+'.png'),animations:'disabled'});
      results.push({scenario:s.name,passed:true,notFound:true});
      continue;
    }

    await page.locator('.navExperienceV2 .navigationMapCanvas').waitFor({state:'visible',timeout:15000});
    if(!s.gpsDenied&&!s.status) {
      if(routeMode==='success') await page.getByRole('button',{name:'เริ่มนำทาง'}).waitFor({state:'visible',timeout:14000});
      else await page.locator('.routeErrorNotice').waitFor({state:'visible',timeout:14000});
    }
    if(s.gpsDenied) {
      await page.locator('.routeErrorNotice').waitFor({state:'visible',timeout:14000});
      assert.equal(routeRequests,0);
      assert.ok((await page.locator('.routeErrorNotice').innerText()).includes('Location'));
      assert.equal(await page.getByRole('button',{name:'ลองตำแหน่งอีกครั้ง'}).count(),1);
    }
    if(s.status){
      await page.getByRole('button',{name:'ไม่สามารถนำทางได้'}).waitFor({state:'visible',timeout:10000});
      assert.equal(await page.getByRole('button',{name:'ไม่สามารถนำทางได้'}).isDisabled(),true);
      assert.equal(routeRequests,0);
    }
    const size=await page.evaluate(()=>({
      innerWidth, scrollWidth:document.documentElement.scrollWidth,
      mapHeight:Math.round(document.querySelector('.navigationMapCanvas').getBoundingClientRect().height),
      sheetWidth:Math.round(document.querySelector('.navBottomSheet').getBoundingClientRect().width),
      sheetHeight:Math.round(document.querySelector('.navBottomSheet').getBoundingClientRect().height),
      sheetTop:Math.round(document.querySelector('.navBottomSheet').getBoundingClientRect().top),
      sheetBottom:Math.round(document.querySelector('.navBottomSheet').getBoundingClientRect().bottom),
      bg:getComputedStyle(document.querySelector('.navBottomSheet')).backgroundColor,
    }));
    assert.ok(size.scrollWidth<=size.innerWidth+2,`Horizontal overflow ${size.scrollWidth} > ${size.innerWidth}`);
    assert.ok(size.sheetTop>=0&&size.sheetBottom<=s.h+3,'Sheet must remain in the viewport');
    assert.equal(size.mapHeight,s.h);
    assert.equal(await page.locator('.navMapStatusBar').isVisible(),true);
    assert.equal(await page.locator('.navMapButton').count(),1);
    if(!s.gpsDenied&&!s.status&&routeMode==='success'){
      assert.equal(await page.locator('.navTurnItem').count(),2);
      assert.equal(await page.locator('.navDistanceSummary').count(),1);
      assert.ok((await page.locator('.navGpsPill').innerText()).includes('GPS'));
      if(s.gpsAccuracy)assert.ok((await page.locator('.navGpsPill').getAttribute('class')).includes('gpsPoor'));
    }

    if(s.action==='route-retry'){
      assert.ok((await page.locator('.routeErrorNotice').innerText()).includes('ตอบสนองช้า'));
      routeMode='success';
      await page.getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();
      await page.getByRole('button',{name:'เริ่มนำทาง'}).waitFor({state:'visible',timeout:14000});
      assert.equal(routeRequests,2);
      assert.equal(await page.locator('.routeErrorNotice').count(),0);
    }
    if(s.action==='route-error'){
      assert.ok((await page.locator('.routeErrorNotice').innerText()).includes('ไม่พบเส้นทาง'));
      assert.equal(await page.getByRole('button',{name:'เริ่มนำทาง'}).count(),0);
    }
    if(s.action==='collapse'){
      await page.getByRole('button',{name:'ย่อแผงข้อมูล'}).click();
      const toggle=page.getByRole('button',{name:'ขยายแผงข้อมูล'});
      assert.equal(await toggle.getAttribute('aria-expanded'),'false');
      await toggle.click();
      assert.equal(await page.getByRole('button',{name:'ย่อแผงข้อมูล'}).getAttribute('aria-expanded'),'true');
      assert.equal(await page.locator('.navTurnItem').count(),2);
    }
    if(s.action==='active'||s.action==='arrived'){
      await page.getByRole('button',{name:'เริ่มนำทาง'}).click();
      await page.getByRole('button',{name:'สิ้นสุดการนำทาง'}).waitFor({state:'visible',timeout:9000});
      assert.equal(await page.locator('.navActiveTopBar').count(),1);
      assert.equal(await page.locator('.navRouteProgress').count(),1);
      assert.equal(await page.locator('.navTurnItem').count(),2);
      if(s.action==='arrived'){
        await ctx.setGeolocation({latitude:donation.latitude,longitude:donation.longitude,accuracy:10});
        await page.getByText('ถึงจุดรับของบริจาคแล้ว').waitFor({state:'visible',timeout:10000});
        assert.equal(await page.locator('.navRouteProgressHeader strong').innerText(),'100%');
      }
      await page.screenshot({path:path.join(folder,s.name+'-active.png'),animations:'disabled'});
      await page.getByRole('button',{name:'สิ้นสุดการนำทาง'}).click();
      await page.getByRole('button',{name:'เริ่มนำทาง'}).waitFor({state:'visible',timeout:9000});
      assert.equal(await page.locator('.navActiveTopBar').count(),0);
    }
    if(s.action==='recenter'){
      await page.getByRole('button',{name:'กลับไปตำแหน่งปัจจุบัน'}).click();
      assert.equal(await page.locator('.navigationMapCanvas').isVisible(),true);
    }
    if(s.action==='off-route-recovery'||s.action==='off-route-error'){
      await page.getByRole('button',{name:'เริ่มนำทาง'}).click();
      await page.getByRole('button',{name:'สิ้นสุดการนำทาง'}).waitFor({state:'visible',timeout:10000});
      routeMode=s.action==='off-route-error'?'not-found':'success';
      await ctx.setGeolocation({latitude:13.8000,longitude:100.9000,accuracy:12});
      await page.waitForTimeout(160);
      await ctx.setGeolocation({latitude:13.8100,longitude:100.9200,accuracy:12});
      if(s.action==='off-route-error'){
        await page.locator('.navInlineNotice.routeErrorNotice').filter({hasText:'ยังใช้เส้นทางเดิมอยู่'})
          .waitFor({state:'visible',timeout:12000});
        assert.equal(await page.getByRole('button',{name:'สิ้นสุดการนำทาง'}).isVisible(),true);
        assert.equal(await page.locator('.navRouteProgress').count(),1);
        routeMode='success';
        await page.getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();
        await page.locator('.navRecoveryNotice').waitFor({state:'visible',timeout:12000});
        assert.ok(routeRequests>=3);
      }else{
        await page.locator('.navRecoveryNotice').waitFor({state:'visible',timeout:12000});
        assert.ok(routeRequests>=2);
      }
      await page.getByRole('button',{name:'สิ้นสุดการนำทาง'}).click();
      await page.getByRole('button',{name:'เริ่มนำทาง'}).waitFor({state:'visible',timeout:9000});
    }

    assert.deepEqual(pageErrors,[],'Uncaught browser errors');
    await page.screenshot({path:path.join(folder,s.name+'.png'),animations:'disabled'});
    results.push({scenario:s.name,passed:true,routeRequests,size});
  }catch(e){
    await page.screenshot({path:path.join(folder,s.name+'-FAILED.png')}).catch(()=>{});
    results.push({scenario:s.name,passed:false,message:e.message,routeRequests,pageErrors});
  }finally{await ctx.close();}
}
await browser.close();
for(const r of results)console.log(JSON.stringify(r));
console.log(`Phase 7 Playwright CLI: ${results.filter(x=>x.passed).length}/${results.length} passed`);
if(results.some(x=>!x.passed))process.exitCode=1;
