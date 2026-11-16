// Phase 5 non-destructive Playwright CLI QA. All auth/donation/images APIs are mocked.
// Run from frontend: node e2e/phase5-donation-editor-qa.mjs [baseUrl]
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const base = process.argv[2] || 'http://127.0.0.1:3102';
const folder = path.resolve('playwright-report/phase5-donation-editor');
await mkdir(folder, { recursive: true });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
const user = { id: 'qa-user', role: 'USER', name: 'QA User', isActive: true };
const donation = {
  id: 'qa-1', ownerId: user.id, title: 'เสื้อผ้าสภาพดี', description: 'ใส่ได้',
  category: 'เสื้อผ้า', quantity: 5, address: 'อาคาร A', latitude: 13.7291,
  longitude: 100.7789, startDate: '2026-11-14T17:00:00.000Z',
  endDate: '2026-12-29T16:59:59.999Z', status: 'AVAILABLE', isHidden: false,
  owner: { id: user.id, name: user.name }, images: [],
};
const cases = [
  {name:'new-desktop',route:'/donations/new',w:1440,h:900},
  {name:'new-tablet',route:'/donations/new',w:820,h:1180},
  {name:'new-mobile',route:'/donations/new',w:390,h:844},
  {name:'new-320px',route:'/donations/new',w:320,h:700},
  {name:'edit-desktop',route:'/donations/qa-1/edit',w:1440,h:900},
  {name:'edit-mobile',route:'/donations/qa-1/edit',w:390,h:844},
  {name:'new-guest-redirect',route:'/donations/new',w:390,h:844,guest:true},
  {name:'edit-nonowner',route:'/donations/qa-1/edit',w:1440,h:900,nonowner:true},
  {name:'new-no-location',route:'/donations/new',w:1440,h:900,workflow:'no-location'},
  {name:'new-picker-escape',route:'/donations/new',w:390,h:844,workflow:'picker-escape'},
  {name:'new-image-limit',route:'/donations/new',w:1440,h:900,workflow:'image-limit'},
  {name:'new-upload-retry',route:'/donations/new',w:1440,h:900,workflow:'create-retry'},
  {name:'edit-patch',route:'/donations/qa-1/edit',w:390,h:844,workflow:'edit-patch'},
  {name:'edit-upload-retry',route:'/donations/qa-1/edit',w:1440,h:900,workflow:'edit-retry'},
  {name:'edit-image-delete',route:'/donations/qa-1/edit',w:1440,h:900,workflow:'image-delete'},
];
const results = [];
const browser = await chromium.launch({ headless: true });
for(const scenario of cases) {
  const context = await browser.newContext({ viewport:{width:scenario.w,height:scenario.h},
    locale:'th-TH',timezoneId:'Asia/Bangkok',permissions:[],
    isMobile:scenario.w<600,hasTouch:scenario.w<600,
  });
  const page=await context.newPage();
  const requests={created:0,patched:0,uploaded:0,deleted:0,payload:null};
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  let failUpload = ['create-retry','edit-retry'].includes(scenario.workflow);
  const fixture = { ...donation, ownerId: scenario.nonowner?'not-my-account':user.id,
    images:scenario.workflow==='image-delete'?[{id:'img-1',imageUrl:'/uploads/test.png'}]:[] };
  await page.route('**/uploads/test.png',r=>r.fulfill({status:200,contentType:'image/png',body:png}));
  await page.route('**/api/**',route=>{
    const req=route.request(),url=new URL(req.url()),pathname=url.pathname,method=req.method();
    const body=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(pathname==='/api/auth/me')return body(scenario.guest?401:200,scenario.guest?{error:'UNAUTHORIZED'}:{user});
    if(pathname==='/api/donations'&&method==='POST'){
      requests.created++;requests.payload=req.postDataJSON();return body(201,fixture);
    }
    if(pathname==='/api/donations/qa-1'&&method==='GET')return body(200,fixture);
    if(pathname==='/api/donations/qa-1'&&method==='PATCH'){
      requests.patched++;requests.payload=req.postDataJSON();return body(200,{...fixture,...requests.payload});
    }
    if(pathname==='/api/donations/qa-1/images'&&method==='POST'){
      requests.uploaded++;
      if(failUpload){failUpload=false;return body(503,{message:'mock: upload interrupted'});}
      return body(201,[]);
    }
    if(pathname==='/api/donations/qa-1/images/img-1'&&method==='DELETE'){
      requests.deleted++;return route.fulfill({status:204,body:''});
    }
    if(pathname==='/api/donations/nearby')return body(200,[]);
    return body(404,{message:'QA unmapped '+pathname});
  });

  const choose=async(name='test-image.png')=>page.locator('input[type=file]').setInputFiles(
    [{name,mimeType:'image/png',buffer:png}]);
  const fillRequired=async()=>{
    await page.locator('#donation-title').fill('ของบริจาคสำหรับ QA');
    await page.locator('#donation-category').fill('เครื่องใช้');
    await page.locator('#donation-quantity').fill('3');
    await page.locator('#donation-end-date').fill('2026-12-28');
  };
  const selectLocation=async()=>{
    await page.getByRole('button',{name:'เลือกตำแหน่งบนแผนที่'}).click();
    await page.getByRole('dialog',{name:'เลือกตำแหน่งจุดรับของ'}).waitFor({state:'visible',timeout:12000});
    await page.getByRole('button',{name:'ยืนยันตำแหน่งนี้'}).click();
    await page.locator('.locationPreviewMap .pickerMap').waitFor({state:'visible',timeout:12000});
  };

  try {
    await page.goto(base+scenario.route,{waitUntil:'domcontentloaded',timeout:18000});
    if(scenario.guest){
      await page.waitForURL(base+'/login?next=/donations/new',{timeout:13000});
      results.push({name:scenario.name,pass:true,redirect:true});continue;
    }
    if(scenario.nonowner){
      await page.getByText('คุณไม่มีสิทธิ์แก้ไขโพสต์นี้').waitFor({timeout:13000});
      assert.equal(await page.locator('.donationComposerForm').count(),0);
      results.push({name:scenario.name,pass:true,ownership:true});continue;
    }
    await page.locator('.donationComposerForm').waitFor({state:'visible',timeout:13000});
    const dimensions=await page.evaluate(()=>({viewport:innerWidth,docWidth:document.documentElement.scrollWidth,
      columns:getComputedStyle(document.querySelector('.donationComposerForm')).gridTemplateColumns,
      sectionCount:document.querySelectorAll('.donationComposerCard').length}));
    assert.ok(dimensions.docWidth<=dimensions.viewport+3,'Horizontal overflow');
    assert.equal(dimensions.sectionCount,4);
    assert.equal(await page.locator('.donationComposerStepLink').count(),4);
    assert.equal(await page.locator('.donationComposerRail').isVisible(),true);
    assert.equal(await page.locator('#donation-title').count(),1);
    if(scenario.workflow==='no-location'){
      await fillRequired();
      await page.getByRole('button',{name:'สร้างจุดบริจาค'}).click();
      assert.ok((await page.locator('.locationErrorBox').innerText()).includes('เลือกตำแหน่ง'));
      assert.equal(requests.created,0);
    } else if(scenario.workflow==='picker-escape'){
      const launch=page.getByRole('button',{name:'เลือกตำแหน่งบนแผนที่'});
      await launch.click();
      const dialog=page.getByRole('dialog',{name:'เลือกตำแหน่งจุดรับของ'});
      await dialog.waitFor({state:'visible',timeout:13000});
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
      assert.equal(await dialog.locator('.locationPickerCoordinates').isVisible(),true);
      await page.waitForFunction(() => [...document.querySelectorAll('.locationPickerMap .leaflet-tile')].some(
        (tile) => tile.complete && tile.naturalWidth > 0,
      ), { timeout: 12000 });
      await page.screenshot({path:path.join(folder,scenario.name+'-picker.png'),animations:'disabled'});
      await page.keyboard.press('Escape');
      assert.equal(await dialog.count(),0);
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
      await page.getByRole('button',{name:'เลือกตำแหน่งบนแผนที่'}).click();
      await dialog.waitFor({state:'visible',timeout:13000});
      const originalCoordinates=await dialog.locator('.locationPickerCoordinates strong').innerText();
      await page.locator('.locationPickerMap .pickerMap').click({position:{x:110,y:245}});
      await page.waitForFunction((before)=>document.querySelector('.locationPickerCoordinates strong')?.textContent!==before,originalCoordinates);
      await page.getByRole('button',{name:'ยืนยันตำแหน่งนี้'}).click();
      await page.locator('.locationPreviewMap .pickerMap').waitFor({state:'visible',timeout:12000});
      assert.ok(await page.locator('.locationState.isReady').count());
    } else if(scenario.workflow==='image-limit'){
      await choose();
      assert.equal(await page.locator('.donationImagePreview').count(),1);
      await page.locator('.donationImageRemove').click();
      assert.equal(await page.locator('.donationImagePreview').count(),0);
      await page.locator('input[type=file]').setInputFiles(Array.from({length:7},(_,i)=>({
        name:`image-${i}.png`,mimeType:'image/png',buffer:png,
      })));
      assert.equal(await page.locator('.donationImagePreview').count(),5);
      assert.equal(await page.locator('.donationImageFull').count(),1);
      assert.equal(await page.locator('input[type=file]').count(),0);
      assert.equal(requests.created,0);
    } else if(['create-retry','edit-patch','edit-retry'].includes(scenario.workflow)){
      if(scenario.workflow==='create-retry')await selectLocation();
      await fillRequired();
      if(scenario.workflow!=='edit-patch')await choose();
      const submitLabel=scenario.route.includes('/edit')?'บันทึกการแก้ไข':'สร้างจุดบริจาค';
      await page.getByRole('button',{name:submitLabel}).click();
      if(scenario.workflow==='edit-patch'){
        await page.waitForURL(base+'/donations/qa-1',{timeout:13000});
        assert.equal(requests.patched,1);
        assert.equal(requests.uploaded,0);
      } else {
        await page.getByRole('button',{name:'ลองอัปโหลดรูปอีกครั้ง'}).waitFor({timeout:13000});
        assert.equal(requests.uploaded,1);
        if(scenario.workflow==='create-retry') assert.equal(requests.created,1);
        else assert.equal(requests.patched,1);
        await page.getByRole('button',{name:'ลองอัปโหลดรูปอีกครั้ง'}).click();
        await page.waitForURL(base+'/donations/qa-1',{timeout:13000});
        assert.equal(requests.uploaded,2);
        if(scenario.workflow==='create-retry')assert.equal(requests.created,1);
        else assert.equal(requests.patched,1);
      }
      assert.equal(requests.payload.title,'ของบริจาคสำหรับ QA');
      assert.equal(requests.payload.quantity,3);
      assert.equal(requests.payload.endDate,'2026-12-28');
    } else if(scenario.workflow==='image-delete'){
      assert.equal(await page.locator('.donationImagePreview').count(),1);
      await page.locator('.donationImageRemove').click();
      await page.waitForFunction(()=>document.querySelectorAll('.donationImagePreview').length===0);
      assert.equal(requests.deleted,1);
      assert.equal(await page.locator('input[type=file]').count(),1);
    }
    assert.deepEqual(errors,[],'Unexpected page errors');
    await page.screenshot({path:path.join(folder,scenario.name+'.png'),animations:'disabled'});
    results.push({name:scenario.name,pass:true,dimensions,requests});
  }catch(e){
    await page.screenshot({path:path.join(folder,scenario.name+'-FAILED.png')}).catch(()=>{});
    results.push({name:scenario.name,pass:false,error:e.message,errors,requests});
  }finally{await context.close();}
}
await browser.close();
for(const r of results)console.log(JSON.stringify(r));
console.log(`Phase 5 Playwright CLI: ${results.filter(x=>x.pass).length}/${results.length} passed`);
if(results.some(x=>!x.pass))process.exitCode=1;
