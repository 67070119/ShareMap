// Phase 9 all-route browser audit — 14 page templates x 3 breakpoints.
// All backend endpoints are mocked; no fixture setup, no mutations, no production data writes.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const origin=process.argv[2] || 'http://127.0.0.1:3106';
const output=path.resolve('playwright-report/phase9-full-audit');
await mkdir(output,{recursive:true});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
const owner={id:'qa-user',name:'QA User',email:'qa-user@example.test',role:'USER',isActive:true,_count:{donations:1,reports:0}};
const admin={id:'qa-admin',name:'QA Admin',email:'qa-admin@example.test',role:'ADMIN',isActive:true};
const listing={
  id:'qa-donation',ownerId:owner.id,title:'สิ่งของสำหรับบริจาค',
  description:'ของบริจาคสภาพดี\nพร้อมรับที่จุดนัดพบ',category:'เสื้อผ้า',quantity:4,
  latitude:13.7360,longitude:100.7900,address:'อาคาร A',
  startDate:'2026-01-01T00:00:00Z',endDate:'2027-01-01T00:00:00Z',
  status:'AVAILABLE',isHidden:false,owner,
  images:[{id:'qa-img',imageUrl:'/uploads/qa.png'}],
  _count:{reports:1},
};
const report={
  id:'qa-report',donationId:listing.id,reason:'FRAUD',status:'PENDING',
  description:'รายละเอียดรายงานตัวอย่าง',
  createdAt:'2026-11-15T00:00:00Z',reporter:admin,donation:listing,
};
const routeFixture={
  distanceMeters:1650,durationSeconds:480,
  geometry:{type:'LineString',coordinates:[[100.7789,13.7291],[100.7840,13.7315],[100.7900,13.7360]]},
  steps:[
    {distanceMeters:700,durationSeconds:180,name:'ถนนสายหลัก',instruction:'turn',modifier:'right',location:[100.7840,13.7315]},
    {distanceMeters:950,durationSeconds:300,name:'',instruction:'arrive',location:[100.7900,13.7360]},
  ],
};
const routes=[
  {id:'home',path:'/',role:'guest',ready:'.mapExperience .mapResultsSheet'},
  {id:'login',path:'/login',role:'guest',ready:'form.authCard'},
  {id:'register',path:'/register',role:'guest',ready:'form.authCard'},
  {id:'donation-new',path:'/donations/new',role:'user',ready:'.donationComposerForm'},
  {id:'donation-detail',path:'/donations/qa-donation',role:'user',ready:'.pointHeroCard'},
  {id:'donation-edit',path:'/donations/qa-donation/edit',role:'user',ready:'.donationComposerForm'},
  {id:'donation-navigation',path:'/donations/qa-donation/navigate',role:'guest',ready:'.navBottomSheet'},
  {id:'donation-report',path:'/donations/qa-donation/report',role:'user',ready:'.reportPortCard'},
  {id:'admin-dashboard',path:'/admin',role:'admin',ready:'.adminKpiCard'},
  {id:'admin-users',path:'/admin/users',role:'admin',ready:'.adminModernRow'},
  {id:'admin-donations',path:'/admin/donations',role:'admin',ready:'.adminModernRow'},
  {id:'admin-donation-detail',path:'/admin/donations/qa-donation',role:'admin',ready:'.adminModernDetailLayout'},
  {id:'admin-reports',path:'/admin/reports',role:'admin',ready:'.adminModernRow'},
  {id:'admin-report-detail',path:'/admin/reports/qa-report',role:'admin',ready:'.adminModernDetailLayout'},
];
const views=[
  {id:'desktop',width:1440,height:900},
  {id:'tablet',width:820,height:1180},
  {id:'mobile',width:390,height:844,mobile:true},
];

const browser=await chromium.launch({headless:true});
const results=[];
for(const route of routes){
  for(const view of views){
    const label=route.id+'-'+view.id;
    const context=await browser.newContext({
      viewport:{width:view.width,height:view.height},
      locale:'th-TH',timezoneId:'Asia/Bangkok',
      isMobile:Boolean(view.mobile),hasTouch:Boolean(view.mobile),
      permissions:['geolocation'],geolocation:{latitude:13.7291,longitude:100.7789,accuracy:17},
      reducedMotion:'reduce',
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    let unwantedMutations=[];
    await page.route('**/uploads/qa.png',r=>r.fulfill({status:200,contentType:'image/png',body:png}));
    await page.route('**/api/**',r=>{
      const req=r.request(),u=new URL(req.url()),p=u.pathname,m=req.method();
      const json=(code,data)=>r.fulfill({status:code,contentType:'application/json',body:JSON.stringify(data)});
      if(m!=='GET'){
        unwantedMutations.push(m+' '+p);
        return json(403,{message:'Phase9 GET-only cross-route audit'});
      }
      if(p==='/api/auth/me'){
        if(route.role==='guest')return json(401,{message:'Guest'});
        return json(200,{user:route.role==='admin'?admin:owner});
      }
      if(p==='/api/donations/nearby')return json(200,[{...listing,distanceKm:.9}]);
      if(p==='/api/routes')return json(200,routeFixture);
      if(p==='/api/donations/qa-donation')return json(200,listing);
      if(p==='/api/admin/users')return json(200,[owner,admin]);
      if(p==='/api/admin/donations')return json(200,[listing]);
      if(p==='/api/admin/reports')return json(200,[report]);
      if(p==='/api/admin/donations/qa-donation')return json(200,{...listing,reports:[report]});
      if(p==='/api/admin/reports/qa-report')return json(200,report);
      return json(404,{message:'Unmapped mock GET '+p});
    });

    try{
      await page.goto(origin+route.path,{waitUntil:'domcontentloaded',timeout:19000});
      await page.locator(route.ready).first().waitFor({state:'visible',timeout:16000});
      if(route.id==='home'){
        await page.locator('.mapResultCard').first().waitFor({state:view.width<=900?'attached':'visible',timeout:14000});
        if(view.width<=900){
          const toggle=page.getByRole('button',{name:'เปิดแผงค้นหาจุดบริจาค'});
          await toggle.click();
          await page.locator('.mapResultCard').first().waitFor({state:'visible',timeout:9000});
          await page.getByRole('button',{name:'ย่อแผงค้นหาจุดบริจาค'}).click();
        }
      }
      await page.evaluate(()=>document.fonts.ready);
      const metrics=await page.evaluate(()=>{
        const getName=(node)=>{
          const labelledby=node.getAttribute('aria-labelledby');
          if(labelledby)return labelledby.split(/\s+/).map(id=>document.getElementById(id)?.textContent || '').join(' ').trim();
          return node.getAttribute('aria-label')||node.getAttribute('title')||
            (node.labels?.length ? Array.from(node.labels).map(x=>x.textContent).join(' ') : '')||
            node.innerText?.trim()||node.textContent?.trim()||'';
        };
        const elements=Array.from(document.querySelectorAll('a[href],button,input,select,textarea,[role="button"]'));
        let missingLabels=[],clipped=[],covered=[],undersized=[];
        const w=window.innerWidth,h=window.innerHeight;
        for(const el of elements){
          const style=getComputedStyle(el);
          if(style.display==='none'||style.visibility==='hidden'||style.pointerEvents==='none'||style.opacity==='0')continue;
          const box=el.getBoundingClientRect();
          if(box.width<2||box.height<2)continue;
          if(el.matches('input[type="hidden"],input[type="file"]'))continue;
          if(el.getAttribute('aria-hidden')==='true')continue;
          const identifier=el.tagName.toLowerCase()+' '+(el.id||el.className?.toString()?.slice(0,50)||'');
          if(el.matches('button,input,textarea,select,[role="button"]')&&!getName(el).trim())
            missingLabels.push(identifier);
          if(box.right<0||box.left>w||box.bottom<0||box.top>h)continue; // scrollable offscreen sections
          const ancestorScroll=(()=>{let p=el.parentElement;while(p&&p!==document.body){
            const overflow=getComputedStyle(p).overflowX;
            if(['auto','scroll'].includes(overflow)&&p.scrollWidth>p.clientWidth+2)return true;
            p=p.parentElement;
          }return false})();
          if(!ancestorScroll && (box.left<-3||box.right>w+3))clipped.push({selector:identifier,left:Math.round(box.left),right:Math.round(box.right)});
          if(box.width>=12&&box.height>=12 && !el.hasAttribute('disabled')){
            const cx=Math.min(w-2,Math.max(2,box.left+box.width/2));
            const cy=Math.min(h-2,Math.max(2,box.top+box.height/2));
            const top=document.elementFromPoint(cx,cy);
            // This identifies actionable visible centers hidden by fixed overlays / masks.
            if(top&&!el.contains(top)&&!top.contains(el) && style.position!=='absolute' &&
              box.left>=0&&box.right<=w&&box.top>=0&&box.bottom<=h) {
              const parentTop=top.closest('button,a,[role="button"]');
              if(parentTop!==el && !el.closest('.leaflet-control') && !el.closest('.leaflet-container'))
                covered.push({selector:identifier,occluder:(top.tagName+' '+(top.className?.toString()?.slice(0,35)||''))});
            }
          }
          if(el.matches('button,a[href]')&&!el.hasAttribute('disabled')&&box.width<35&&box.height<35
              &&box.left>=0&&box.right<=w&&box.top>=0&&box.bottom<=h)
            undersized.push({selector:identifier,w:Math.round(box.width),h:Math.round(box.height)});
        }
        return {
          viewport:w, docWidth:document.documentElement.scrollWidth, scrollHeight:document.documentElement.scrollHeight,
          lang:document.documentElement.lang, title:document.title,
          mainCount:document.querySelectorAll('main').length,
          h1Count:document.querySelectorAll('h1').length,
          missingLabels:missingLabels.slice(0,24),clipped:clipped.slice(0,24),
          covered:covered.slice(0,24),undersized:undersized.slice(0,24),
          navVisible:Boolean(document.querySelector('.appAdminHeader, .appHeader')),
        };
      });
      assert.equal(metrics.lang,'th','Language metadata is missing');
      assert.ok(metrics.docWidth<=view.width+3,`Horizontal overflow: ${metrics.docWidth} > ${view.width}`);
      assert.deepEqual(errors,[],'Uncaught browser errors');
      assert.deepEqual(unwantedMutations,[],'Unexpected write request during read-only page load');
      await page.screenshot({path:path.join(output,label+'.png'),animations:'disabled',fullPage:false});
      results.push({route:route.id,viewport:view.id,passed:true,...metrics});
    }catch(e){
      await page.screenshot({path:path.join(output,label+'-FAILED.png'),animations:'disabled'}).catch(()=>{});
      results.push({route:route.id,viewport:view.id,passed:false,error:e.message,pageErrors:errors,mutations:unwantedMutations});
    }finally{await context.close();}
  }
}
await browser.close();
await writeFile(path.join(output,'route-audit.json'),JSON.stringify(results,null,2)+'\n');
for(const r of results)console.log(JSON.stringify({route:r.route,viewport:r.viewport,passed:r.passed,
  error:r.error,docWidth:r.docWidth,missingLabels:r.missingLabels?.length,clipped:r.clipped?.length,
  covered:r.covered?.length,undersized:r.undersized?.length,h1Count:r.h1Count}));
console.log(`Phase 9 Route Sweep: ${results.filter(x=>x.passed).length}/${results.length} passed`);
if(results.some(x=>!x.passed))process.exitCode=1;
