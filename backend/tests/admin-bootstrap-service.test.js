import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import bcrypt from 'bcryptjs';
import test from 'node:test';
import {
  AdminBootstrapError,
  ADMIN_PRIVILEGE_LOCK_KEY,
  bootstrapFirstAdmin,
  inspectInitialAdminStatus,
  validateBootstrapCredentials,
} from '../src/services/admin-bootstrap.service.js';

const sample = { name: 'First Admin', email: 'First@Example.com', password: 'secure-password-2026' };

function fakeDatabase(initialUsers = [], { failAudit = false, failMarker = false } = {}) {
  const db = { users: structuredClone(initialUsers), marker: null, audit: [] };
  let queue = Promise.resolve();
  const events = [];
  let nextId = 0;
  const prisma = {
    $transaction(fn, opts) {
      assert.ok(opts.timeout >= 10000);
      const run = queue.then(async () => {
        const snapshot = structuredClone(db);
        const tx = {
          $queryRaw(strings, lockKey) {
            assert.match(strings[0], /pg_advisory_xact_lock/);
            assert.match(strings.join(''), /::text AS locked/,
              'Raw advisory lock result must be cast from PostgreSQL void to Prisma-supported text');
            assert.equal(lockKey, ADMIN_PRIVILEGE_LOCK_KEY);
            events.push('lock');
            return Promise.resolve([{}]);
          },
          adminBootstrapState: {
            findUnique: async ({ where }) => (where.id === 1 ? snapshot.marker : null),
            create: async ({ data }) => {
              if (failMarker) throw new Error('marker insert failed');
              assert.equal(data.id, 1);
              if (snapshot.marker) throw new Error('marker duplicate');
              snapshot.marker = structuredClone(data);
              return snapshot.marker;
            },
          },
          user: {
            findFirst: async ({ where, orderBy }) => {
              assert.equal(where.role, 'ADMIN');
              assert.deepEqual(orderBy, [{ createdAt: 'asc' }, { id: 'asc' }]);
              return snapshot.users.filter(x => x.role === 'ADMIN')
                .sort((a,b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id))
                .map(x => ({ id: x.id }))[0] || null;
            },
            findUnique: async ({ where }) => {
              const found = snapshot.users.find(x => x.email === where.email);
              return found ? { id: found.id } : null;
            },
            create: async ({ data }) => {
              if (snapshot.users.some(x => x.email === data.email)) {
                const err = new Error('unique'); err.code = 'P2002'; throw err;
              }
              nextId++;
              const user = { ...data, id: 'created-' + nextId, createdAt: new Date().toISOString() };
              snapshot.users.push(user);
              return { id: user.id, email: user.email };
            },
          },
          adminAuditLog: {
            create: async ({ data }) => {
              if (failAudit) throw new Error('audit insert failed');
              snapshot.audit.push(structuredClone(data));
              return data;
            },
          },
        };
        const result = await fn(tx);
        Object.assign(db, snapshot); // commit; errors leave original unmodified
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
  return { prisma, db, events };
}

test('CLI validates canonical name/email and restricts bcrypt 72-byte boundary', () => {
  assert.deepEqual(validateBootstrapCredentials({ ...sample, name: '  First Admin  ' }),
    { ...sample, name: 'First Admin', email: 'first@example.com' });
  for (const field of [
    { name: 'A' }, { email: 'invalid' }, { password: 'short' },
    { password: 'ก'.repeat(30) }, { password: 'p'.repeat(73) },
    { password: 'password\n123' },
  ]) {
    assert.throws(() => validateBootstrapCredentials({ ...sample, ...field }), AdminBootstrapError);
  }
});

test('first CLI call creates ADMIN, marker, and audit together with hashed password', async () => {
  const { prisma, db, events } = fakeDatabase();
  assert.deepEqual(await inspectInitialAdminStatus(prisma), { kind: 'available' });
  const result = await bootstrapFirstAdmin(prisma, sample);
  assert.equal(result.kind, 'created');
  assert.equal(result.email, 'first@example.com');
  assert.equal(db.users.length, 1);
  assert.equal(db.users[0].role, 'ADMIN');
  assert.equal(db.users[0].isActive, true);
  assert.notEqual(db.users[0].passwordHash, sample.password);
  assert.equal(await bcrypt.compare(sample.password, db.users[0].passwordHash), true);
  assert.deepEqual(db.marker, { id: 1, source: 'CLI', initialAdminId: result.adminId });
  assert.equal(db.audit.length, 1);
  assert.equal(db.audit[0].actorUserId, null); // CLI has no authenticated app actor
  assert.equal(db.audit[0].targetUserId, result.adminId);
  assert.deepEqual([db.audit[0].action, db.audit[0].outcome],
    ['INITIAL_ADMIN_BOOTSTRAP', 'SUCCESS']);
  assert.ok(events.length >= 2 && events.every(v => v === 'lock'));
});

test('permanent bootstrap marker rejects retry after Admin deletion', async () => {
  const { prisma, db } = fakeDatabase();
  await bootstrapFirstAdmin(prisma, sample);
  db.users.length = 0;
  assert.deepEqual(await bootstrapFirstAdmin(prisma, { ...sample, email: 'other@example.com' }),
    { kind: 'already_completed', source: 'CLI' });
  assert.equal(db.audit.length, 1);
  assert.equal(db.users.length, 0);
});

test('legacy ADMIN is adopted without touching credentials, role or active flag', async () => {
  const older = { id: 'legacy-1', email: 'old@example.com', role: 'ADMIN', isActive: false,
    passwordHash: 'existing-hash', createdAt: '2025-01-01' };
  const newer = { ...older, id: 'legacy-2', email: 'newer@example.com', isActive: true, createdAt: '2026-01-01' };
  const { prisma, db } = fakeDatabase([newer, older]);
  const before = structuredClone(db.users);
  assert.deepEqual(await inspectInitialAdminStatus(prisma), { kind: 'legacy_adopted' });
  assert.deepEqual(db.users, before);
  assert.deepEqual(db.marker, { id: 1, source: 'LEGACY_ADMIN', initialAdminId: 'legacy-1' });
  assert.equal(db.audit[0].action, 'LEGACY_ADMIN_ADOPTION');
  assert.deepEqual(await inspectInitialAdminStatus(prisma),
    { kind: 'already_completed', source: 'LEGACY_ADMIN' });
  assert.equal(db.audit.length, 1);
});

test('legacy account appearing after preflight blocks creation and is adopted', async () => {
  const { prisma, db } = fakeDatabase();
  assert.deepEqual(await inspectInitialAdminStatus(prisma), { kind: 'available' });
  db.users.push({ id: 'legacy-new', role: 'ADMIN', email: 'legacy@demo.test' });
  assert.deepEqual(await bootstrapFirstAdmin(prisma, sample), { kind: 'legacy_adopted' });
  assert.equal(db.users.length, 1);
  assert.equal(db.marker.initialAdminId, 'legacy-new');
});

test('concurrent bootstrap invocations serialize and create exactly one Admin', async () => {
  const { prisma, db } = fakeDatabase();
  const [a,b] = await Promise.all([
    bootstrapFirstAdmin(prisma, sample),
    bootstrapFirstAdmin(prisma, { ...sample, email: 'second@demo.test' }),
  ]);
  assert.deepEqual([a.kind,b.kind].sort(), ['already_completed', 'created']);
  assert.equal(db.users.length, 1);
  assert.equal(db.audit.length, 1);
});

test('existing USER email is never upgraded to Admin by CLI bootstrap', async () => {
  const original = { id: 'regular-1', role: 'USER', email: 'first@example.com', isActive: false };
  const { prisma, db } = fakeDatabase([original]);
  await assert.rejects(bootstrapFirstAdmin(prisma, sample),
    e => e instanceof AdminBootstrapError && e.code === 'EMAIL_ALREADY_EXISTS');
  assert.deepEqual(db.users, [original]);
  assert.equal(db.marker, null);
  assert.equal(db.audit.length, 0);
});

test('audit failure rolls back User and marker, not merely the audit insert', async () => {
  const { prisma, db } = fakeDatabase([], { failAudit: true });
  await assert.rejects(bootstrapFirstAdmin(prisma, sample), /audit insert failed/);
  assert.equal(db.users.length, 0);
  assert.equal(db.marker, null);
  assert.equal(db.audit.length, 0);
});

test('marker failure rolls back the created Admin', async () => {
  const { prisma, db } = fakeDatabase([], { failMarker: true });
  await assert.rejects(bootstrapFirstAdmin(prisma, sample), /marker insert failed/);
  assert.equal(db.users.length, 0);
  assert.equal(db.audit.length, 0);
});

test('CLI rejects arguments and noninteractive invocation without DB access', () => {
  const noTty = spawnSync(process.execPath, ['scripts/bootstrap-admin.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgresql://dummy:dummy@127.0.0.1:1/dummy' },
    timeout: 4000,
  });
  assert.notEqual(noTty.status, 0);
  assert.match(noTty.stderr, /INTERACTIVE_TERMINAL_REQUIRED/);
  assert.doesNotMatch(noTty.stderr, /dummy:dummy/);
  const withArg = spawnSync(process.execPath, ['scripts/bootstrap-admin.mjs', '--password=sensitive-example'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgresql://dummy:dummy@127.0.0.1:1/dummy' },
    timeout: 4000,
  });
  assert.notEqual(withArg.status, 0);
  assert.match(withArg.stderr, /CLI_ARGUMENTS_DISABLED/);
  assert.doesNotMatch(withArg.stderr, /sensitive-example/);
});
