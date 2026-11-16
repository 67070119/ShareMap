import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { prisma as livePrisma } from '../src/config/database.js';
import { createAdditionalAdmin } from '../src/services/admin-account.service.js';
import { setUserActive } from '../src/services/admin.service.js';
import { signAuthToken } from '../src/utils/jwt.js';

const actor={id:'admin-1',name:'Admin One',email:'one@test.example',role:'ADMIN',isActive:true,
  createdAt:new Date('2026-01-01'),updatedAt:new Date('2026-01-01'),passwordHash:'existing-one'};
const other={...actor,id:'admin-2',name:'Admin Two',email:'two@test.example',passwordHash:'existing-two'};
const regular={...actor,id:'user-1',name:'User One',email:'user@test.example',role:'USER'};
const input={name:'New Administrator',email:'NEW@EXAMPLE.TEST',password:'super-safe-password-2026'};

function makeMock(initial=[actor],options={}){
  const db={users:structuredClone(initial),marker:options.marker===undefined?{id:1,source:'CLI'}:options.marker,
    audit:[]};
  let queue=Promise.resolve(),counter=0;
  const stats={locks:0,transactions:0};
  const selectUser=(u,s)=>{
    if(!u)return null;
    if(!s)return structuredClone(u);
    const obj={};
    for(const [k,v] of Object.entries(s)){
      if(k==='_count')obj._count={donations:0,reports:0};
      else if(v)obj[k]=u[k];
    }
    return structuredClone(obj);
  };
  const find=(users,where)=>users.find(u=>u.id===where.id||u.email===where.email);
  const mock={
    user:{findUnique:async({where,select})=>selectUser(find(db.users,where),select)},
    $transaction(fn,opts){
      assert.ok(opts?.timeout>=10000);
      const run=queue.then(async()=>{
        const state=structuredClone(db);
        const tx={
          $queryRaw:async(strings,key)=>{assert.match(strings[0],/pg_advisory_xact_lock/);
            assert.equal(typeof key,'bigint');stats.locks++;return [{}];},
          user:{
            findUnique:async({where,select})=>selectUser(find(state.users,where),select),
            count:async({where})=>options.forcedCount ?? state.users.filter(u=>
              u.role===where.role&&u.isActive===where.isActive).length,
            create:async({data,select})=>{
              if(state.users.some(u=>u.email===data.email)){
                const e=new Error('duplicate');e.code='P2002';throw e;
              }
              if(options.forceDuplicate){const e=new Error('race duplicate');e.code='P2002';throw e;}
              counter++;
              const u={...data,id:'new-admin-'+counter,createdAt:new Date(),updatedAt:new Date()};
              state.users.push(u);
              return selectUser(u,select);
            },
            update:async({where,data,select})=>{
              const u=find(state.users,where);
              if(!u)throw new Error('User missing in mock');
              Object.assign(u,data,{updatedAt:new Date()});
              return selectUser(u,select);
            },
          },
          adminBootstrapState:{findUnique:async({where})=>where.id===1?state.marker:null},
          adminAuditLog:{create:async({data})=>{
            if(options.failAudit)throw new Error('injected audit failure');
            state.audit.push(structuredClone(data));
            return data;
          }},
        };
        const result=await fn(tx);
        Object.assign(db,state);
        stats.transactions++;
        return result;
      });
      queue=run.catch(()=>{});
      return run;
    },
  };
  return{db,mock,stats};
}

test('ADMIN creates subsequent ADMIN, response never includes passwordHash',async()=>{
  const{db,mock,stats}=makeMock();
  const result=await createAdditionalAdmin(input,actor.id,mock);
  assert.equal(result.role,'ADMIN');
  assert.equal(result.email,'new@example.test');
  assert.equal(result.isActive,true);
  assert.deepEqual(result._count,{donations:0,reports:0});
  assert.equal('passwordHash' in result,false);
  assert.equal(db.users.length,2);
  assert.equal(await bcrypt.compare(input.password,db.users[1].passwordHash),true);
  assert.deepEqual(db.audit.map(x=>[x.actorUserId,x.targetUserId,x.action,x.outcome]),
    [[actor.id,result.id,'ADMIN_CREATED','SUCCESS']]);
  assert.equal(stats.locks,1);
});

test('creation requires bootstrap marker, cannot use API as initial Admin setup',async()=>{
  const{db,mock}=makeMock([actor],{marker:null});
  await assert.rejects(createAdditionalAdmin(input,actor.id,mock),
    e=>e.status===409&&e.code==='ADMIN_BOOTSTRAP_REQUIRED');
  assert.equal(db.users.length,1);
  assert.equal(db.audit.length,0);
});

test('ordinary USER, inactive ADMIN and unknown actor cannot create ADMIN',async()=>{
  for(const [users,who] of [[[actor,regular],regular.id],[[{...actor,isActive:false}],actor.id],
    [[actor],'missing-id']]){
    const{db,mock}=makeMock(users);
    await assert.rejects(createAdditionalAdmin(input,who,mock),
      e=>e.status===403&&e.code==='ADMIN_ACCESS_REVOKED');
    assert.equal(db.users.length,users.length);
    assert.equal(db.audit.length,0);
  }
});

test('email collision never promotes or replaces existing USER/ADMIN',async()=>{
  for(const existing of [regular,other]){
    const{db,mock}=makeMock([actor,existing]);
    const old=structuredClone(db.users);
    await assert.rejects(createAdditionalAdmin({...input,email:existing.email},actor.id,mock),
      e=>e.status===409&&e.code==='EMAIL_ALREADY_EXISTS');
    assert.deepEqual(db.users,old);
    assert.equal(db.audit.length,0);
  }
});

test('Prisma uniqueness race mapped to HTTP 409 without leaking internal details',async()=>{
  const{mock}=makeMock([actor],{forceDuplicate:true});
  await assert.rejects(createAdditionalAdmin(input,actor.id,mock),
    e=>e.status===409&&e.code==='EMAIL_ALREADY_EXISTS');
});

test('audit insertion failure rolls back new ADMIN creation completely',async()=>{
  const{db,mock}=makeMock([actor],{failAudit:true});
  await assert.rejects(createAdditionalAdmin(input,actor.id,mock),/injected audit failure/);
  assert.equal(db.users.length,1);
  assert.equal(db.audit.length,0);
});

test('concurrent requests serialize via the same lock and duplicate email is rejected',async()=>{
  const{db,mock,stats}=makeMock();
  const settled=await Promise.allSettled([
    createAdditionalAdmin(input,actor.id,mock),
    createAdditionalAdmin({...input,email:'new@example.test'},actor.id,mock),
  ]);
  assert.equal(settled.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(settled.filter(x=>x.status==='rejected').length,1);
  assert.equal(db.users.length,2);
  assert.equal(db.audit.length,1);
  assert.equal(stats.locks,2);
});

test('ADMIN can suspend and reactivate another ADMIN with transactional audit',async()=>{
  const{db,mock}=makeMock([actor,other]);
  const gone=await setUserActive(other.id,false,actor.id,mock);
  assert.equal(gone.isActive,false);
  assert.equal('passwordHash' in gone,false);
  assert.equal(db.audit[0].action,'ADMIN_SUSPENDED');
  const restored=await setUserActive(other.id,true,actor.id,mock);
  assert.equal(restored.isActive,true);
  assert.equal(db.audit[1].action,'ADMIN_REACTIVATED');
  assert.deepEqual(db.audit.map(x=>x.actorUserId),[actor.id,actor.id]);
  assert.deepEqual(db.audit.map(x=>x.outcome),['SUCCESS','SUCCESS']);
});

test('self-suspension denied and auditable, no status change',async()=>{
  const{db,mock}=makeMock([actor,other]);
  await assert.rejects(setUserActive(actor.id,false,actor.id,mock),
    e=>e.status===400&&e.code==='CANNOT_SUSPEND_SELF');
  assert.equal(db.users[0].isActive,true);
  assert.deepEqual(db.audit.map(x=>[x.action,x.outcome]),[['ADMIN_SUSPENDED','DENIED']]);
});

test('last active ADMIN cannot be suspended even when concurrent count is 1',async()=>{
  const{db,mock}=makeMock([actor,other],{forcedCount:1});
  await assert.rejects(setUserActive(other.id,false,actor.id,mock),
    e=>e.status===409&&e.code==='LAST_ACTIVE_ADMIN');
  assert.equal(db.users[1].isActive,true);
  assert.deepEqual(db.audit.map(x=>x.outcome),['DENIED']);
});

test('two ADMINs cannot suspend one another in concurrent requests',async()=>{
  const{db,mock}=makeMock([actor,other]);
  const results=await Promise.allSettled([
    setUserActive(other.id,false,actor.id,mock),
    setUserActive(actor.id,false,other.id,mock),
  ]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.filter(x=>x.status==='rejected').length,1);
  assert.equal(db.users.filter(x=>x.role==='ADMIN'&&x.isActive).length,1);
});

test('existing USER suspension remains supported and does not create ADMIN privilege audit',async()=>{
  const{db,mock}=makeMock([actor,regular]);
  const result=await setUserActive(regular.id,false,actor.id,mock);
  assert.equal(result.role,'USER');
  assert.equal(result.isActive,false);
  assert.equal(db.audit.length,0);
});

test('inactive/missing actor and missing target cannot change state',async()=>{
  const{db,mock}=makeMock([actor,other,regular]);
  await assert.rejects(setUserActive(other.id,false,regular.id,mock),
    e=>e.status===403&&e.code==='ADMIN_ACCESS_REVOKED');
  await assert.rejects(setUserActive('missing',false,actor.id,mock),
    e=>e.status===404&&e.code==='USER_NOT_FOUND');
  assert.equal(db.audit.length,0);
});

test('no-op state change leaves update timestamp/audit unchanged',async()=>{
  const{db,mock}=makeMock([actor,other]);
  const old=db.users[1].updatedAt;
  const x=await setUserActive(other.id,true,actor.id,mock);
  assert.equal(x.isActive,true);
  assert.equal(db.users[1].updatedAt.getTime(),old.getTime());
  assert.equal(db.audit.length,0);
});

test('ADMIN suspension audit failure causes state rollback',async()=>{
  const{db,mock}=makeMock([actor,other],{failAudit:true});
  await assert.rejects(setUserActive(other.id,false,actor.id,mock),/injected audit failure/);
  assert.equal(db.users[1].isActive,true);
  assert.equal(db.audit.length,0);
});

test('real Express route rejects anonymous/USER and invalid payload; 201 success via mocked Prisma',async()=>{
  const{db,mock}=makeMock([actor,regular]);
  const originalFind=livePrisma.user.findUnique;
  const originalTx=livePrisma.$transaction;
  // All data access in this test is mocked. No external database is touched.
  livePrisma.user.findUnique=mock.user.findUnique;
  livePrisma.$transaction=mock.$transaction.bind(mock);
  const server=app.listen(0);
  try{
    await new Promise(resolve=>server.once('listening',resolve));
    const url='http://127.0.0.1:'+server.address().port+'/api/admin/users/admins';
    const post=(token,payload)=>fetch(url,{method:'POST',
      headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},
      body:JSON.stringify(payload)});
    const unauth=await post(null,input);
    assert.equal(unauth.status,401);
    const denied=await post(signAuthToken(regular),input);
    assert.equal(denied.status,403);
    const adminToken=signAuthToken(actor);
    const invalid=await post(adminToken,{...input,role:'ADMIN',isActive:true});
    assert.equal(invalid.status,400);
    assert.equal((await invalid.json()).error,'VALIDATION_ERROR');
    const short=await post(adminToken,{...input,password:'short'});
    assert.equal(short.status,400);
    const success=await post(adminToken,input);
    assert.equal(success.status,201);
    const body=await success.json();
    assert.equal(body.role,'ADMIN');
    assert.equal(body.email,'new@example.test');
    assert.ok(!('passwordHash' in body));
    assert.ok(!('password' in body));
    assert.equal(db.users.length,3);
    const conflict=await post(adminToken,input);
    assert.equal(conflict.status,409);
    assert.equal((await conflict.json()).error,'EMAIL_ALREADY_EXISTS');
    assert.equal(db.audit.length,1);
  }finally{
    await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
    livePrisma.user.findUnique=originalFind;
    livePrisma.$transaction=originalTx;
  }
});
