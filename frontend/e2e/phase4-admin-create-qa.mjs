// Phase 4 Admin Create browser QA — all API requests mocked, ZERO database access.
// Run: node e2e/phase4-admin-create-qa.mjs http://127.0.0.1:3108
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.argv[2] || 'http://127.0.0.1:3108';
const output = path.resolve('playwright-report/phase4-admin-create');
await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true});
const admin = { id:'admin-1', name:'QA Existing Admin', email:'admin@test.example',
  role:'ADMIN', isActive:true, _count:{donations:0,reports:0} };
const user = { id:'u1', name:'QA Regular User', email:'regular@test.example',
  role:'USER', isActive:true, _count:{donations:0,reports:0} };
const secret = 'test-password-for-mock-only';
const tests = [
  {id:'desktop-create',width:1440,height:900,mode:'create'},
  {id:'tablet-create',width:820,height:1180,mode:'create'},
  {id:'mobile-create',width:390,height:844,mode:'create'},
  {id:'narrow-320-create',width:320,height:750,mode:'create'},
  {id:'required-and-confirm-mismatch',width:390,height:844,mode:'validation'},
  {id:'escape-close-clears-secret',width:390,height:844,mode:'escape'},
  {id:'duplicate-email-retry',width:390,height:844,mode:'duplicate'},
  {id:'api-500-retry',width:390,height:844,mode:'api-error'},
  {id:'pending-post-no-double-submit',width:390,height:844,mode:'inflight'},
  {id:'refetch-502-keeps-created-account',width:390,height:844,mode:'refresh-fail'},
  {id:'keydown-and-focus',width:390,height:844,mode:'keyboard'},
  {id:'ordinary-user-no-admin',width:390,height:844,mode:'unauthorized'},
  {id:'guest-no-admin',width:390,height:844,mode:'guest'},
];
const result = [];

for(const test of tests){
  const ctx = await browser.newContext({
    viewport:{width:test.width,height:test.height},
    isMobile:test.width<=390,hasTouch:test.width<=390,
    locale:'th-TH', timezoneId:'Asia/Bangkok',
  });
  const page = await ctx.newPage();
  const events = {post:0,get:0, unexpected:[],postKeys:[],postEmail:[],pageErrors:[]};
  let records = [admin,user];
  page.on('pageerror',err=>events.pageErrors.push(err.message));
  await page.route('**/api/**',route=>{
    const request=route.request(),u=new URL(request.url()),method=request.method();
    const json=(status,obj)=>route.fulfill({
      status,contentType:'application/json',body:JSON.stringify(obj),
    });
    if(u.pathname==='/api/auth/me'){
      if(test.mode==='guest')return json(401,{message:'UNAUTHORIZED'});
      return json(200,{user:test.mode==='unauthorized'?user:admin});
    }
    if(u.pathname==='/api/admin/users'&&method==='GET'){
      events.get++;
      if(test.mode==='refresh-fail'&&events.get>1)return json(502,{message:'REFRESH_DOWN'});
      return json(200,records);
    }
    if(u.pathname==='/api/admin/users/admins'&&method==='POST'){
      events.post++;
      const body=request.postDataJSON();
      events.postKeys.push(Object.keys(body).sort());
      events.postEmail.push(body.email);
      if(body.password!==secret) return json(400,{error:'VALIDATION_ERROR',message:'Password does not match test input'});
      if(test.mode==='duplicate'&&events.post===1){
        return json(409,{error:'EMAIL_ALREADY_EXISTS',message:'อีเมลนี้ถูกใช้งานแล้ว'});
      }
      if(test.mode==='api-error'&&events.post===1){
        return json(500,{error:'INTERNAL_SERVER_ERROR',message:'Mock failure, retry allowed'});
      }
      const newAccount={id:'new-'+events.post,name:body.name,email:body.email,
        role:'ADMIN',isActive:true,_count:{donations:0,reports:0}};
      records=[...records,newAccount];
      if(test.mode==='inflight')return new Promise(resolve=>
        setTimeout(()=>resolve(json(201,newAccount)),650));
      return json(201,newAccount);
    }
    events.unexpected.push(method+' '+u.pathname);
    return json(404,{message:'Mock route unmapped'});
  });

  async function openAndFill(){
    await page.getByRole('button',{name:'เพิ่ม Admin'}).click();
    const dialog=page.getByRole('dialog');
    await dialog.waitFor({state:'visible'});
    await dialog.getByLabel('ชื่อผู้ดูแล',{exact:true}).fill('New Admin');
    await dialog.getByLabel('อีเมล',{exact:true}).fill('new@test.example');
    await dialog.getByLabel('รหัสผ่าน',{exact:true}).fill(secret);
    await dialog.getByLabel('ยืนยันรหัสผ่าน',{exact:true}).fill(secret);
    if(test.id==='mobile-create')await page.screenshot({
      path:path.join(output,'mobile-create-form.png'),animations:'disabled'});
    return dialog;
  }
  async function moveToConfirm(dialog){
    await dialog.getByRole('button',{name:'ตรวจสอบข้อมูล'}).click();
    await dialog.getByRole('heading',{name:'ยืนยันการเพิ่ม Admin'}).waitFor();
    assert.equal(await dialog.locator('input[type=password]').count(),0);
    assert.ok(!(await dialog.innerText()).includes(secret),'Password must not be in confirmation text');
    if(test.id==='mobile-create')await page.screenshot({
      path:path.join(output,'mobile-create-confirm.png'),animations:'disabled'});
  }
  async function assertSuccess(){
    await page.getByRole('status').filter({hasText:'สร้าง'}).first()
      .waitFor({state:'visible',timeout:10000});
    await page.locator('.adminModernRow').filter({hasText:'new@test.example'})
      .waitFor({state:'visible'});
    assert.equal(events.post,1);
    assert.ok(events.get>=2,'List must refetch after successful creation');
    assert.deepEqual(events.postKeys[0],['email','name','password']);
    assert.deepEqual(events.postEmail,['new@test.example']);
    assert.equal(await page.getByRole('dialog').count(),0);
    assert.equal(await page.getByRole('button',{name:'เพิ่ม Admin'}).isVisible(),true);
  }
  try{
    await page.goto(origin+'/admin/users',{waitUntil:'domcontentloaded',timeout:19000});
    if(test.mode==='unauthorized'||test.mode==='guest'){
      await page.waitForURL(origin+'/',{timeout:12000});
      assert.equal(events.get,0);
      assert.equal(events.post,0);
      assert.equal(await page.getByRole('button',{name:'เพิ่ม Admin'}).count(),0);
      result.push({test:test.id,pass:true,redirect:true});continue;
    }
    await page.getByRole('button',{name:'เพิ่ม Admin'}).waitFor({state:'visible',timeout:10000});
    if(test.mode==='validation'){
      await page.getByRole('button',{name:'เพิ่ม Admin'}).click();
      const dialog=page.getByRole('dialog');
      await dialog.getByRole('button',{name:'ตรวจสอบข้อมูล'}).click();
      assert.ok(await dialog.getByText('กรุณากรอกชื่อ 2–80 ตัวอักษร').isVisible());
      assert.equal(events.post,0);
      await dialog.getByLabel('ชื่อผู้ดูแล',{exact:true}).fill('New Admin');
      await dialog.getByLabel('อีเมล',{exact:true}).fill('new@test.example');
      await dialog.getByLabel('รหัสผ่าน',{exact:true}).fill(secret);
      await dialog.getByLabel('ยืนยันรหัสผ่าน',{exact:true}).fill('different');
      await dialog.getByRole('button',{name:'ตรวจสอบข้อมูล'}).click();
      assert.ok(await dialog.getByText('รหัสผ่านทั้งสองช่องไม่ตรงกัน').isVisible());
      assert.equal(events.post,0);
      await dialog.getByLabel('ยืนยันรหัสผ่าน',{exact:true}).fill(secret);
      await moveToConfirm(dialog);
      await dialog.getByRole('button',{name:'กลับไปแก้ไข'}).click();
      assert.equal(await dialog.getByLabel('รหัสผ่าน',{exact:true}).inputValue(),secret);
      await dialog.getByRole('button',{name:'ยกเลิก'}).click();
      assert.equal(events.post,0);
    }else if(test.mode==='escape'){
      const dialog=await openAndFill();
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').count(),0);
      await page.getByRole('button',{name:'เพิ่ม Admin'}).click();
      const again=page.getByRole('dialog');
      assert.equal(await again.getByLabel('รหัสผ่าน',{exact:true}).inputValue(),'');
      assert.equal(await again.getByLabel('ยืนยันรหัสผ่าน',{exact:true}).inputValue(),'');
      await again.getByRole('button',{name:'ยกเลิก'}).click();
      assert.equal(events.post,0);
    }else if(test.mode==='keyboard'){
      const dialog=await openAndFill();
      const modalFocus=await page.evaluate(()=>document.activeElement?.getAttribute('id'));
      assert.equal(modalFocus,'admin-create-confirm');
      await moveToConfirm(dialog);
      const confirmFocused=await dialog.getByRole('button',{name:'ยืนยันสร้าง Admin'}).evaluate(
        (button)=>document.activeElement===button);
      assert.ok(confirmFocused);
      await page.keyboard.press('Tab');
      assert.ok(await dialog.getByRole('button',{name:'ปิดหน้าต่าง'}).isVisible());
      await dialog.getByRole('button',{name:'กลับไปแก้ไข'}).click();
      await dialog.getByRole('button',{name:'ยกเลิก'}).click();
    }else{
      const dialog=await openAndFill();
      await moveToConfirm(dialog);
      if(test.mode==='duplicate'){
        await dialog.getByRole('button',{name:'ยืนยันสร้าง Admin'}).click();
        await dialog.getByText('อีเมลนี้มีบัญชีอยู่แล้ว กรุณาใช้อีเมลอื่น').waitFor();
        assert.equal(events.post,1);
        await dialog.getByLabel('อีเมล',{exact:true}).fill('new2@test.example');
        await moveToConfirm(dialog);
        await dialog.getByRole('button',{name:'ยืนยันสร้าง Admin'}).click();
        await page.locator('.adminModernRow').filter({hasText:'new2@test.example'}).waitFor();
        assert.equal(events.post,2);
      }else if(test.mode==='api-error'){
        await dialog.getByRole('button',{name:'ยืนยันสร้าง Admin'}).click();
        await dialog.getByRole('alert').filter({hasText:'Mock failure'}).waitFor();
        assert.equal(await dialog.count(),1);
        await dialog.getByRole('button',{name:'ยืนยันสร้าง Admin'}).click();
        await page.locator('.adminModernRow').filter({hasText:'new@test.example'}).waitFor();
        assert.equal(events.post,2);
      }else{
        await dialog.getByRole('button',{name:'ยืนยันสร้าง Admin'}).click();
        if(test.mode==='inflight'){
          const pending=dialog.getByRole('button',{name:'กำลังสร้างบัญชี...'});
          await pending.waitFor({state:'visible'});
          assert.equal(await pending.isDisabled(),true);
          await pending.evaluate(button=>button.click());
          assert.equal(events.post,1);
        }
        await assertSuccess();
        if(test.mode==='refresh-fail'){
          assert.ok((await page.getByRole('status').filter({hasText:'สร้าง'}).first().innerText())
            .includes('ไม่สามารถโหลดรายการล่าสุด'));
          assert.equal(events.post,1);
        }
      }
    }
    if(test.width<=390){
      await page.screenshot({path:path.join(output,test.id+'.png'),animations:'disabled'});
    }
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    assert.equal(overflow,false,'Horizontal overflow on '+test.id);
    assert.deepEqual(events.pageErrors,[]);
    assert.deepEqual(events.unexpected,[]);
    result.push({test:test.id,pass:true,post:events.post,get:events.get,viewport:test.width});
  }catch(error){
    await page.screenshot({path:path.join(output,test.id+'-FAILED.png')}).catch(()=>{});
    result.push({test:test.id,pass:false,reason:error.message,pageErrors:events.pageErrors,
      unexpected:events.unexpected,post:events.post});
  }finally{await ctx.close();}
}
await browser.close();
await writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2)+'\n');
for(const row of result)console.log(JSON.stringify(row));
console.log('Phase4 Admin Add Browser QA: '+result.filter(x=>x.pass).length+'/'+result.length+' passed');
if(result.some(x=>!x.pass))process.exitCode=1;
