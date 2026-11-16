// Phase 8 Admin Browser Visual QA. All APIs are mocked; zero database writes.
// From frontend: node e2e/phase8-admin-visual-qa.mjs [origin]
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const origin=process.argv[2]||'http://127.0.0.1:3105';
const folder=path.resolve('playwright-report/phase8-admin');
await mkdir(folder,{recursive:true});
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
const admin={id:'admin-1',name:'QA Admin',role:'ADMIN',email:'admin@example.test',isActive:true};
const user={id:'u1',name:'Somchai User',email:'user@example.test',role:'USER',isActive:true,_count:{donations:2,reports:1}};
const inactiveUser={id:'u2',name:'Other Guest',email:'guest@example.test',role:'USER',isActive:false,_count:{donations:0,reports:0}};
const users=[user,inactiveUser,admin];
const d1={id:'qa-d1',title:'เสื้อผ้าสภาพดี',category:'เสื้อผ้า',status:'AVAILABLE',isHidden:false,
 ownerId:user.id,owner:user,description:'เสื้อผ้าแบ่งปัน',quantity:3,address:'อาคารบริจาค A',
 latitude:13.7291,longitude:100.7789,startDate:'2026-01-01T00:00:00Z',endDate:'2027-01-01T00:00:00Z',
 _count:{reports:1},images:[{id:'img-1',imageUrl:'/uploads/qa.png'},{id:'img-2',imageUrl:'/uploads/qa-2.png'}]};
const d2={...d1,id:'qa-d2',title:'หนังสือชุดใหญ่',category:'หนังสือ',isHidden:true,status:'OUT_OF_STOCK',
 owner:inactiveUser,_count:{reports:0},images:[]};
const r1={id:'qa-r1',reason:'FRAUD',status:'PENDING',description:'ข้อมูลอาจไม่จริง',createdAt:'2026-11-15T02:00:00Z',
 reporter:inactiveUser,donation:d1};
const r2={...r1,id:'qa-r2',reason:'OTHER',status:'RESOLVED',reporter:user,donation:d2};
const pages=[
  {tag:'dashboard',route:'/admin',heading:'ภาพรวมระบบ'},
  {tag:'users',route:'/admin/users',heading:'จัดการผู้ใช้'},
  {tag:'donations',route:'/admin/donations',heading:'จัดการของบริจาค'},
  {tag:'donation-detail',route:'/admin/donations/qa-d1',heading:'เสื้อผ้าสภาพดี'},
  {tag:'reports',route:'/admin/reports',heading:'รายงานปัญหา'},
  {tag:'report-detail',route:'/admin/reports/qa-r1',heading:'ข้อมูลหลอกลวง'},
];
const cases=[
  ...pages.map(item=>({...item,name:'desktop-'+item.tag,w:1440,h:900})),
  ...pages.map(item=>({...item,name:'mobile-'+item.tag,w:390,h:844})),
  {...pages[0],name:'tablet-dashboard',w:820,h:1180},
  {...pages[1],name:'users-search-filter',w:1440,h:900,action:'users-filter'},
  {...pages[2],name:'donations-search-filter',w:1440,h:900,action:'donations-filter'},
  {...pages[4],name:'reports-search-filter',w:1440,h:900,action:'reports-filter'},
  {...pages[1],name:'users-suspend-activate',w:1440,h:900,action:'users-toggle'},
  {...pages[2],name:'donations-hide-delete',w:1440,h:900,action:'donations-toggle'},
  {...pages[3],name:'donation-detail-hide-delete',w:1440,h:900,action:'donation-detail-toggle'},
  {...pages[3],name:'donation-detail-gallery',w:1440,h:900,action:'gallery'},
  {...pages[5],name:'report-detail-moderation',w:1440,h:900,action:'report-detail-actions'},
  {...pages[0],name:'dashboard-api-error',w:1440,h:900,action:'api-error'},
  {...pages[4],name:'reports-empty',w:390,h:844,action:'empty'},
  {...pages[0],name:'nonadmin-redirect',w:390,h:844,action:'unauthorized'},
  {...pages[1],name:'narrow-users',w:320,h:700},
  {...pages[2],name:'narrow-donations',w:320,h:700},
  {...pages[4],name:'narrow-reports',w:320,h:700},
];
const browser=await chromium.launch({headless:true});
const results=[];
for(const s of cases){
  const ctx=await browser.newContext({viewport:{width:s.w,height:s.h},isMobile:s.w<600,hasTouch:s.w<600,
    locale:'th-TH',timezoneId:'Asia/Bangkok'});
  const page=await ctx.newPage();
  const metrics={calls:[],patchUser:0,patchVisibility:0,deleteDonation:0,patchReport:0,payloads:[]};
  let currentUser={...user},currentDonation={...d1},currentReport={...r1,donation:{...d1,owner:{...user}}};
  const jsErrors=[];
  page.on('pageerror',e=>jsErrors.push(e.message));
  await page.route('**/uploads/qa*.png',r=>r.fulfill({status:200,contentType:'image/png',body:image}));
  await page.route('**/api/**',route=>{
    const req=route.request(),u=new URL(req.url()),path=u.pathname,method=req.method();
    metrics.calls.push(method+' '+path);
    const data=req.postData()?.startsWith('{')?req.postDataJSON():null;
    const json=(status,value)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
    if(path==='/api/auth/me')return json(200,{user:s.action==='unauthorized'?{...user,role:'USER'}:admin});
    if(s.action==='api-error'&&path==='/api/admin/reports')return json(502,{message:'Mock dashboard unavailable'});
    if(path==='/api/admin/users'&&method==='GET')return json(200,[currentUser,inactiveUser,admin]);
    if(path==='/api/admin/donations'&&method==='GET')return json(200,[currentDonation,d2]);
    if(path==='/api/admin/reports'&&method==='GET')return json(200,s.action==='empty'?[]:[{...r1,donation:currentDonation},r2]);
    if(path==='/api/admin/donations/qa-d1'&&method==='GET')return json(200,{...currentDonation,reports:[r1]});
    if(path==='/api/admin/reports/qa-r1'&&method==='GET')return json(200,currentReport);
    if(path==='/api/admin/users/u1/status'&&method==='PATCH'){
      metrics.patchUser++; metrics.payloads.push(data);
      currentUser={...currentUser,isActive:data.isActive};
      return json(200,{id:'u1',isActive:data.isActive});
    }
    if(path==='/api/admin/donations/qa-d1/visibility'&&method==='PATCH'){
      metrics.patchVisibility++;metrics.payloads.push(data);
      currentDonation={...currentDonation,isHidden:data.isHidden};
      currentReport={...currentReport,donation:{...currentReport.donation,isHidden:data.isHidden}};
      return json(200,{id:'qa-d1',isHidden:data.isHidden});
    }
    if(path==='/api/admin/donations/qa-d1'&&method==='DELETE'){
      metrics.deleteDonation++;return route.fulfill({status:204,body:''});
    }
    if(path==='/api/admin/reports/qa-r1'&&method==='PATCH'){
      metrics.patchReport++;metrics.payloads.push(data);
      currentReport={...currentReport,status:data.status};
      // Partial response: UI must preserve nested donation and owner.
      return json(200,{id:'qa-r1',status:data.status});
    }
    if(path==='/api/donations/nearby')return json(200,[]);
    return json(404,{message:'Mock route unmapped: '+path});
  });

  try{
    await page.goto(origin+s.route,{waitUntil:'domcontentloaded',timeout:18000});
    if(s.action==='unauthorized'){
      await page.waitForURL(origin+'/',{timeout:14000});
      results.push({scenario:s.name,passed:true,redirected:true});continue;
    }
    if(s.action==='api-error'){
      await page.locator('.adminModernAlert').waitFor({state:'visible',timeout:11000});
      assert.equal(await page.locator('.adminDashboardKpis').count(),0);
      assert.ok((await page.locator('.adminModernAlert').innerText()).includes('Mock dashboard unavailable'));
    }else{
      await page.getByRole('heading',{name:s.heading,exact:true}).first().waitFor({state:'visible',timeout:11000});
      if(s.action!=='empty')await page.locator(s.tag==='dashboard'?'.adminQuickAction':'.adminModernPanel').first()
        .waitFor({state:'visible',timeout:11000});
    }
    const dimensions=await page.evaluate(()=>({
      width:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,
      bodyBackground:getComputedStyle(document.querySelector('.adminPortShell')).backgroundColor,
      sideVisible:getComputedStyle(document.querySelector('.appAdminSidebar')).display!=='none',
      mainWidth:Math.round(document.querySelector('.adminModernPage').getBoundingClientRect().width),
      headerHeight:Math.round(document.querySelector('.adminModernHeading').getBoundingClientRect().height),
    }));
    assert.ok(dimensions.scrollWidth<=dimensions.width+3,`Horizontal overflow ${dimensions.scrollWidth} > ${dimensions.width}`);
    assert.equal(dimensions.sideVisible,s.w>900);
    assert.ok(dimensions.mainWidth>0);
    if(s.w<600)assert.ok(dimensions.headerHeight<260,`Mobile admin header excessively tall: ${dimensions.headerHeight}px`);
    if(s.tag==='dashboard'&&s.action!=='api-error'){
      assert.equal(await page.locator('.adminKpiCard').count(),4);
      assert.equal(await page.locator('.adminQuickAction').count(),3);
      assert.equal(await page.locator('.adminDashboardFocus').count(),1);
    }

    if(s.action==='users-filter'){
      await page.getByRole('searchbox',{name:'ค้นหาในรายการ'}).fill('somchai');
      assert.equal(await page.locator('.adminModernRow').count(),1);
      await page.getByRole('combobox',{name:'กรองสถานะบัญชี'}).selectOption('SUSPENDED');
      assert.equal(await page.locator('.adminModernRow').count(),0);
      await page.getByRole('button',{name:'ล้างตัวกรอง'}).click();
      assert.equal(await page.locator('.adminModernRow').count(),3);
    }
    if(s.action==='donations-filter'){
      await page.getByRole('searchbox',{name:'ค้นหาในรายการ'}).fill('หนังสือ');
      assert.equal(await page.locator('.adminModernRow').count(),1);
      await page.getByRole('combobox',{name:'กรองการแสดงโพสต์'}).selectOption('VISIBLE');
      assert.equal(await page.locator('.adminModernRow').count(),0);
      await page.getByRole('button',{name:'ล้างตัวกรอง'}).click();
      assert.equal(await page.locator('.adminModernRow').count(),2);
    }
    if(s.action==='reports-filter'){
      await page.getByRole('combobox',{name:'กรองสถานะรายงาน'}).selectOption('PENDING');
      assert.equal(await page.locator('.adminModernRow').count(),1);
      await page.getByRole('combobox',{name:'กรองประเภทปัญหา'}).selectOption('OTHER');
      assert.equal(await page.locator('.adminModernRow').count(),0);
      await page.getByRole('button',{name:'ล้างตัวกรอง'}).click();
      assert.equal(await page.locator('.adminModernRow').count(),2);
    }

    if(s.action==='users-toggle'){
      await page.getByRole('button',{name:'ระงับบัญชี',exact:true}).first().click();
      const dialog=page.getByRole('dialog');
      await dialog.getByRole('button',{name:'ยกเลิก'}).click();
      assert.equal(metrics.patchUser,0);
      await page.getByRole('button',{name:'ระงับบัญชี',exact:true}).first().click();
      await dialog.getByRole('button',{name:'ยืนยันระงับบัญชี'}).click();
      await page.getByRole('button',{name:'เปิดใช้งาน',exact:true}).first().waitFor({state:'visible',timeout:11000});
      assert.equal(metrics.patchUser,1);
      assert.deepEqual(metrics.payloads[0],{isActive:false});
      // Restore the same account by finding the row explicitly.
      await page.locator('.adminModernRow').filter({hasText:'Somchai User'}).getByRole('button',{name:'เปิดใช้งาน'}).click();
      await dialog.getByRole('button',{name:'ยืนยันเปิดใช้งาน'}).click();
      await page.locator('.adminModernRow').filter({hasText:'Somchai User'}).getByRole('button',{name:'ระงับบัญชี'})
        .waitFor({state:'visible',timeout:11000});
      assert.equal(metrics.patchUser,2);
    }
    if(s.action==='donations-toggle'){
      const row=page.locator('.adminModernRow').filter({hasText:'เสื้อผ้าสภาพดี'});
      await row.getByRole('button',{name:'ซ่อน'}).click();
      await row.getByRole('button',{name:'แสดง'}).waitFor({state:'visible',timeout:10000});
      assert.equal(metrics.patchVisibility,1);
      assert.deepEqual(metrics.payloads[0],{isHidden:true});
      await row.getByRole('button',{name:'ลบ'}).click();
      const dialog=page.getByRole('dialog');
      await dialog.getByRole('button',{name:'ยกเลิก'}).click();
      assert.equal(metrics.deleteDonation,0);
      await row.getByRole('button',{name:'ลบ'}).click();
      await dialog.getByRole('button',{name:'ยืนยันลบโพสต์'}).click();
      await page.waitForFunction(()=>document.querySelectorAll('.adminModernRow').length===1);
      assert.equal(metrics.deleteDonation,1);
    }
    if(s.action==='gallery'){
      assert.equal(await page.locator('.adminModernGallery .pointThumbButton').count(),2);
      await page.getByRole('button',{name:'เลือกรูปที่ 2'}).click();
      await page.getByRole('button',{name:'เปิดรูปของบริจาคแบบเต็มจอ'}).click();
      const lightbox=page.getByRole('dialog',{name:'รูปของบริจาคแบบเต็มจอ'});
      await lightbox.waitFor({state:'visible',timeout:12000});
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
      await page.keyboard.press('ArrowRight');
      assert.ok((await lightbox.innerText()).includes('1 / 2'));
      await page.keyboard.press('Escape');
      assert.equal(await lightbox.count(),0);
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
    }
    if(s.action==='donation-detail-toggle'){
      await page.getByRole('button',{name:'ซ่อน Donation'}).click();
      await page.getByRole('button',{name:'แสดง Donation'}).waitFor({state:'visible',timeout:10000});
      assert.equal(metrics.patchVisibility,1);
      await page.getByRole('button',{name:'ลบ Donation'}).click();
      const dialog=page.getByRole('dialog');
      await dialog.getByRole('button',{name:'ยกเลิก'}).click();
      assert.equal(metrics.deleteDonation,0);
      await page.getByRole('button',{name:'ลบ Donation'}).click();
      await dialog.getByRole('button',{name:'ยืนยันลบโพสต์'}).click();
      await page.waitForURL(origin+'/admin/donations',{timeout:13000});
      assert.equal(metrics.deleteDonation,1);
    }
    if(s.action==='report-detail-actions'){
      await page.getByRole('button',{name:'ซ่อน Donation'}).click();
      await page.getByRole('button',{name:'ซ่อนอยู่แล้ว'}).waitFor({state:'visible',timeout:11000});
      assert.equal(metrics.patchVisibility,1);
      await page.getByRole('button',{name:'ระงับเจ้าของโพสต์'}).click();
      await page.getByRole('button',{name:'เจ้าของถูกระงับแล้ว'}).waitFor({state:'visible',timeout:11000});
      assert.equal(metrics.patchUser,1);
      await page.getByRole('button',{name:'ปิด Report'}).click();
      await page.getByRole('button',{name:'ตรวจสอบแล้ว'}).waitFor({state:'visible',timeout:11000});
      assert.equal(metrics.patchReport,1);
      // Partial PATCH response must not erase donation/owner or its actions.
      assert.ok(await page.getByRole('link',{name:/เปิด Donation Detail/}).isVisible());
      await page.getByRole('button',{name:'ลบ Donation'}).click();
      const dialog=page.getByRole('dialog');
      await dialog.getByRole('button',{name:'ยกเลิก'}).click();
      assert.equal(metrics.deleteDonation,0);
    }
    if(s.action==='empty'){
      await page.locator('.adminModernEmpty').waitFor({state:'visible',timeout:10000});
      assert.equal(await page.locator('.adminModernEmpty').count(),1);
    }
    if(!['donations-toggle','donation-detail-toggle'].includes(s.action)){
      await page.screenshot({path:path.join(folder,s.name+'.png'),animations:'disabled'});
    }
    assert.deepEqual(jsErrors,[],'Unexpected browser JS errors');
    results.push({scenario:s.name,passed:true,dimensions,mutations:{users:metrics.patchUser,visibility:metrics.patchVisibility,delete:metrics.deleteDonation,reports:metrics.patchReport}});
  }catch(error){
    await page.screenshot({path:path.join(folder,s.name+'-FAILED.png'),animations:'disabled'}).catch(()=>{});
    results.push({scenario:s.name,passed:false,reason:error.message,pageErrors:jsErrors,mutations:metrics.payloads});
  }finally{await ctx.close();}
}
await browser.close();
for(const result of results)console.log(JSON.stringify(result));
console.log(`Phase 8 Playwright CLI: ${results.filter(r=>r.passed).length}/${results.length} passed`);
if(results.some(r=>!r.passed))process.exitCode=1;
