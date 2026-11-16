// Phase 10 Thai font rendering and touch target regression.
// Tests the actual Chromium glyph font selection using Chrome DevTools Protocol.
// All API endpoints are mocked; no backend/database writes.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const origin=process.argv[2]||'http://127.0.0.1:3107';
const root=path.resolve('playwright-report/phase10-fixes');
await mkdir(root,{recursive:true});
const user={id:'u1',role:'USER',name:'ผู้บริจาค',isActive:true};
const admin={id:'a1',role:'ADMIN',name:'ผู้ดูแลระบบ',isActive:true};
const donation={id:'qa-donation',ownerId:user.id,owner:user,title:'เสื้อผ้าสภาพดี',category:'เสื้อผ้า',
  quantity:2,description:'ของใช้สภาพดี',address:'อาคารแบ่งปัน',status:'AVAILABLE',isHidden:false,
  latitude:13.736,longitude:100.790,startDate:'2026-01-01T00:00:00Z',endDate:'2027-12-30T00:00:00Z',
  images:[],_count:{reports:1}};
const report={id:'qa-report',reason:'FRAUD',description:'รายละเอียด',status:'PENDING',
  createdAt:'2026-11-16T00:00:00Z',reporter:user,donation};
const route={distanceMeters:1350,durationSeconds:300,
  geometry:{type:'LineString',coordinates:[[100.7789,13.7291],[100.790,13.736]]},
  steps:[{instruction:'turn',modifier:'left',name:'ถนนหลัก',distanceMeters:1350,
    durationSeconds:300,location:[100.790,13.736]}]};
const cases=[
  {name:'login',url:'/login',role:'guest',selectors:['.authFormHead h1','label[for="login-email"]','.authSubmit']},
  {name:'register',url:'/register',role:'guest',selectors:['.authFormHead h1','label[for="register-name"]']},
  {name:'donation-new',url:'/donations/new',role:'user',selectors:['main h1','label[for="donation-title"]'],breadcrumbs:true},
  {name:'detail',url:'/donations/qa-donation',role:'user',selectors:['main h1']},
  {name:'navigation',url:'/donations/qa-donation/navigate',role:'guest',selectors:['.navStartButton'],attribution:true,tooltip:true},
  {name:'admin',url:'/admin',role:'admin',selectors:['.adminModernHeadingMain h1']},
  {name:'admin-report',url:'/admin/reports/qa-report',role:'admin',selectors:['main h1'],breadcrumbs:true},
];
const browser=await chromium.launch({headless:true});
const results=[];
for(const sample of cases){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,
    locale:'th-TH',timezoneId:'Asia/Bangkok',permissions:['geolocation'],
    geolocation:{latitude:13.7291,longitude:100.7789,accuracy:12}});
  const page=await ctx.newPage();let writes=[];let fontFetched=0;
  page.on('response',res=>{if(res.url().endsWith('/fonts/NotoSansThai-Variable.ttf')&&res.status()===200)fontFetched++;});
  await page.route('**/api/**',r=>{
    const p=new URL(r.request().url()).pathname,m=r.request().method();
    const json=(code,body)=>r.fulfill({status:code,contentType:'application/json',body:JSON.stringify(body)});
    if(m!=='GET'){writes.push(m+' '+p);return json(403,{message:'Read-only QA'});}
    if(p==='/api/auth/me')return sample.role==='guest'?json(401,{message:'Guest'}):json(200,{user:sample.role==='admin'?admin:user});
    if(p==='/api/admin/users')return json(200,[user,admin]);
    if(p==='/api/admin/donations')return json(200,[donation]);
    if(p==='/api/admin/reports')return json(200,[report]);
    if(p==='/api/admin/reports/qa-report')return json(200,report);
    if(p==='/api/donations/qa-donation')return json(200,donation);
    if(p==='/api/donations/nearby')return json(200,[donation]);
    if(p==='/api/routes')return json(200,route);
    return json(404,{message:'Unmapped QA GET '+p});
  });
  try{
    await page.goto(origin+sample.url,{waitUntil:'domcontentloaded',timeout:18000});
    await page.locator(sample.selectors[0]).first().waitFor({state:'visible',timeout:13000});
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.evaluate(()=>document.fonts.check('16px "Noto Sans Thai"','กดปุ่ม')),true);
    const client=await page.context().newCDPSession(page);
    await client.send('DOM.enable');await client.send('CSS.enable');
    const doc=await client.send('DOM.getDocument');
    const fontChecks=[];
    for(const selector of sample.selectors){
      const node=await client.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});
      assert.ok(node.nodeId>0,'Missing selector '+selector);
      const fonts=await client.send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId});
      const families=fonts.fonts.filter(f=>f.glyphCount>0).map(f=>f.familyName);
      assert.ok(families.includes('Noto Sans Thai'),`Missing real Thai font on ${selector}: ${families.join(',')}`);
      fontChecks.push({selector,families});
    }
    if(sample.breadcrumbs){
      const links=await page.locator('.donationEditorBreadcrumb a,.appBreadcrumbPart a').all();
      for(const link of links){
        if(!(await link.isVisible()))continue;
        const box=await link.boundingBox();
        assert.ok(box?.width>=35&&box.height>=33,`Breadcrumb touch target too small: ${JSON.stringify(box)}`);
      }
    }
    if(sample.tooltip){
      await page.locator('.leaflet-tooltip').first().waitFor({state:'visible',timeout:10000});
      await page.evaluate(()=>document.fonts.ready);
      const tooltipNodes=await client.send('DOM.querySelectorAll',{nodeId:doc.root.nodeId,selector:'.leaflet-tooltip'});
      assert.ok(tooltipNodes.nodeIds.length>0,'Navigation map tooltip is missing');
      for(const nodeId of tooltipNodes.nodeIds){
        const fonts=await client.send('CSS.getPlatformFontsForNode',{nodeId});
        assert.ok(fonts.fonts.some(f=>f.familyName==='Noto Sans Thai'&&f.glyphCount>0),
          `Leaflet tooltip is not rendering Thai with Noto Sans Thai: ${JSON.stringify(fonts.fonts)}`);
      }
    }
    if(sample.attribution){
      const attr=page.locator('.leaflet-control-attribution a').first();
      await attr.waitFor({state:'visible',timeout:8000});
      const box=await attr.boundingBox();
      assert.ok(box?.width>=35&&box.height>=27,`Attribution too small ${JSON.stringify(box)}`);
    }
    assert.deepEqual(writes,[]);
    const width=await page.evaluate(()=>document.documentElement.scrollWidth);
    assert.ok(width<=390,'Horizontal overflow after Thai font rendering');
    await page.screenshot({path:path.join(root,'thai-'+sample.name+'-mobile.png'),animations:'disabled'});
    results.push({name:sample.name,passed:true,fontChecks,fontFetched,width});
  }catch(e){
    await page.screenshot({path:path.join(root,'thai-'+sample.name+'-FAILED.png')}).catch(()=>{});
    results.push({name:sample.name,passed:false,error:e.message,fontFetched,writes});
  }finally{await ctx.close();}
}
await browser.close();
await writeFile(path.join(root,'font-a11y.json'),JSON.stringify(results,null,2)+'\n');
for(const x of results)console.log(JSON.stringify(x));
console.log(`Phase 10 Thai Font & Touch: ${results.filter(x=>x.passed).length}/${results.length} passed`);
if(results.some(x=>!x.passed))process.exitCode=1;
