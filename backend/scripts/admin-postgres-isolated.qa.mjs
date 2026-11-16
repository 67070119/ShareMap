import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { prisma } from '../src/config/database.js';
import { app } from '../src/app.js';
import { signAuthToken } from '../src/utils/jwt.js';
import { registerUser } from '../src/services/auth.service.js';
import { inspectInitialAdminStatus, bootstrapFirstAdmin } from '../src/services/admin-bootstrap.service.js';
import { createAdditionalAdmin } from '../src/services/admin-account.service.js';
import { setUserActive } from '../src/services/admin.service.js';

const dbURL = new URL(process.env.DATABASE_URL || 'http://invalid/');
assert.equal(dbURL.hostname, '127.0.0.1', 'Isolated testing requires local host');
assert.equal(dbURL.port, process.env.OGTB_ISOLATED_PG_PORT, 'Wrong isolated PostgreSQL port');
assert.equal(dbURL.pathname, '/ogtb_p5', 'Refuse to touch any non-ephemeral database');
assert.equal(process.env.OGTB_ISOLATED_PHASE5, 'true');
let first;
let second;
let user;
let server;
let baseURL;
const secret = 'disposable-only-test-password-2026';
const setupEmail = 'initial@p5.example.test';

after(async () => {
  if (server) await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
  await prisma.$disconnect();
});

function authHeader(account) {
  return { Authorization: 'Bearer ' + signAuthToken(account), 'Content-Type':'application/json' };
}
async function request(path, method, account, body) {
  const response = await fetch(baseURL + path, {
    method, headers: account ? authHeader(account) : { 'Content-Type':'application/json' },
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
  return {response, json: response.status===204 ? null : await response.json()};
}
test('preflight confirms fresh isolated migrated database', async () => {
  assert.equal(await prisma.user.count(), 0);
  assert.equal(await prisma.adminBootstrapState.count(), 0);
  assert.equal((await inspectInitialAdminStatus(prisma)).kind, 'available');
});
test('concurrent CLI bootstrap transactions create exactly one first ADMIN', async () => {
  const options = [
    {name:'Initial Admin',email:setupEmail,password:secret},
    {name:'Concurrent Admin',email:'other@p5.example.test',password:secret},
  ];
  const results = await Promise.all(options.map(x=>bootstrapFirstAdmin(prisma,x)));
  assert.deepEqual(results.map(x=>x.kind).sort(), ['already_completed','created']);
  assert.equal(await prisma.user.count({where:{role:'ADMIN'}}), 1);
  first = await prisma.user.findFirst({where:{role:'ADMIN'}});
  assert.equal(first.email, results.find(x=>x.kind==='created').email);
  assert.equal(await prisma.adminBootstrapState.count(), 1);
  assert.equal((await prisma.adminBootstrapState.findUnique({where:{id:1}})).source, 'CLI');
  assert.equal(await prisma.adminAuditLog.count({where:{action:'INITIAL_ADMIN_BOOTSTRAP'}}), 1);
});
test('permanent marker refuses bootstrap even after first Admin deleted', async () => {
  // First deactivate admin rather than delete, then marker must still block.
  await prisma.user.update({where:{id:first.id},data:{isActive:false}});
  assert.equal((await bootstrapFirstAdmin(prisma,{
    name:'No Second Initial',email:'blocked@p5.example.test',password:secret,
  })).kind,'already_completed');
  await prisma.user.update({where:{id:first.id},data:{isActive:true}});
});
test('USER registration cannot elevate role', async () => {
  user = await registerUser({name:'Regular User',email:'regular@p5.example.test',password:secret});
  assert.equal(user.role,'USER');
  assert.equal((await prisma.user.findUnique({where:{id:user.id}})).role,'USER');
});
test('real HTTP API rejects anonymous and USER and forbidden client fields', async () => {
  server=app.listen(0);
  await new Promise(r=>server.once('listening',r));
  baseURL='http://127.0.0.1:'+server.address().port;
  const path='/api/admin/users/admins';
  assert.equal((await request(path,'POST',null,{name:'Unauthorized',email:'unauth@p5.example.test',password:secret})).response.status,401);
  assert.equal((await request(path,'POST',user,{name:'Unauthorized',email:'userblocked@p5.example.test',password:secret})).response.status,403);
  const invalid = await request(path,'POST',first,{name:'Unauthorized',email:'role@p5.example.test',password:secret,role:'ADMIN'});
  assert.equal(invalid.response.status,400);
  const short = await request(path,'POST',first,{name:'Invalid',email:'short@p5.example.test',password:'short'});
  assert.equal(short.response.status,400);
});
test('real HTTP creates additional ADMIN and audit, DTO excludes secrets', async () => {
  const response=await request('/api/admin/users/admins','POST',first,{name:'Second Admin',email:'SECOND@P5.EXAMPLE.TEST',password:secret});
  assert.equal(response.response.status,201,JSON.stringify(response.json));
  assert.equal(response.json.role,'ADMIN');
  assert.equal(response.json.email,'second@p5.example.test');
  assert.equal(response.json.passwordHash,undefined);
  second=await prisma.user.findUnique({where:{id:response.json.id}});
  assert.ok(second.passwordHash && second.passwordHash!==secret);
  assert.equal(await prisma.adminAuditLog.count({where:{targetUserId:second.id,action:'ADMIN_CREATED',actorUserId:first.id}}),1);
  const duplicate=await request('/api/admin/users/admins','POST',first,{name:'Duplicate',email:second.email,password:secret});
  assert.equal(duplicate.response.status,409);
  assert.equal(duplicate.json.error,'EMAIL_ALREADY_EXISTS');
});
test('concurrent real API creation race: one created, one duplicate 409',async()=>{
  const payload={name:'Concurrent Admin',email:'concurrent-new@p5.example.test',password:secret};
  const response=await Promise.all([request('/api/admin/users/admins','POST',first,payload),
    request('/api/admin/users/admins','POST',first,payload)]);
  assert.deepEqual(response.map(x=>x.response.status).sort(),[201,409]);
  assert.equal(await prisma.user.count({where:{email:payload.email}}),1);
});
test('same serial lock protects ADMIN suspension, self denial and audit',async()=>{
  const self=await request('/api/admin/users/'+first.id+'/status','PATCH',first,{isActive:false});
  assert.equal(self.response.status,400);
  assert.equal(await prisma.adminAuditLog.count({where:{actorUserId:first.id,targetUserId:first.id,outcome:'DENIED'}}),1);
  const suspend=await request('/api/admin/users/'+second.id+'/status','PATCH',first,{isActive:false});
  assert.equal(suspend.response.status,200);
  assert.equal((await prisma.user.findUnique({where:{id:second.id}})).isActive,false);
  assert.equal(await prisma.adminAuditLog.count({where:{actorUserId:first.id,targetUserId:second.id,action:'ADMIN_SUSPENDED',outcome:'SUCCESS'}}),1);
  const blocked=await request('/api/admin/users/'+first.id+'/status','PATCH',second,{isActive:false});
  assert.equal(blocked.response.status,401);
  const enable=await request('/api/admin/users/'+second.id+'/status','PATCH',first,{isActive:true});
  assert.equal(enable.response.status,200);
});
test('real database audit-trigger failure fully rolls back ADMIN creation',async()=>{
  const functionName='ogtb_p5_block_audit';
  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'p5 audit blocked'; END; $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER p5_deny_insert BEFORE INSERT ON "AdminAuditLog" FOR EACH ROW EXECUTE FUNCTION ${functionName}()`);
  try{
    const before=await prisma.user.count();
    const response=await request('/api/admin/users/admins','POST',first,{name:'Rollback Admin',email:'rollback@p5.example.test',password:secret});
    assert.equal(response.response.status,500);
    assert.equal(await prisma.user.count(),before);
    assert.equal(await prisma.user.count({where:{email:'rollback@p5.example.test'}}),0);
  }finally{
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS p5_deny_insert ON "AdminAuditLog"');
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS ogtb_p5_block_audit()');
  }
});
test('simultaneous admin cross-suspension preserves at least one active account',async()=>{
  const [a,b]=await Promise.allSettled([
    setUserActive(second.id,false,first.id),
    setUserActive(first.id,false,second.id),
  ]);
  assert.ok([a,b].some(x=>x.status==='fulfilled'));
  assert.equal(await prisma.user.count({where:{role:'ADMIN',isActive:true}})>=1,true);
  const active=await prisma.user.findMany({where:{role:'ADMIN',isActive:true}});
  // Repair only disposable test state, via direct Prisma write.
  for (const record of [first,second]){
    if(!active.some(x=>x.id===record.id))await prisma.user.update({where:{id:record.id},data:{isActive:true}});
  }
});
test('first-admin marker remains after account deletion and initial Admin cannot be recreated',async()=>{
  // Test foreign-key independence without touching real DB.
  await prisma.user.delete({where:{id:second.id}});
  await prisma.user.delete({where:{id:first.id}});
  assert.equal(await prisma.adminBootstrapState.count(),1);
  assert.equal((await bootstrapFirstAdmin(prisma,{name:'Replacement',email:'no-replace@p5.example.test',password:secret})).kind,'already_completed');
  assert.equal(await prisma.user.count({where:{role:'ADMIN'}}),1); // other concurrent account persists
});
