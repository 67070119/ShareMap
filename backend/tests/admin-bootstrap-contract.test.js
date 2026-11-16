import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const schema = readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(path.join(root, 'prisma/migrations/20261116040000_admin_bootstrap_audit_contracts/migration.sql'), 'utf8');
const seed = readFileSync(path.join(root, 'prisma/seed.js'), 'utf8');

test('bootstrap uses a one-row permanent marker independent of User deletion', () => {
  assert.match(schema, /model AdminBootstrapState\s*\{/);
  assert.match(schema, /id\s+Int\s+@id\s+@default\(1\)/);
  assert.match(schema, /initialAdminId\s+String/);
  assert.match(migration, /CHECK \("id" = 1\)/);
  assert.doesNotMatch(migration, /FOREIGN KEY.*"User"/);
});

test('legacy Admin (including inactive) is adopted without user updates', () => {
  assert.match(migration, /WHERE legacy\."role" = 'ADMIN'/);
  assert.doesNotMatch(migration, /WHERE legacy\."isActive"/);
  assert.match(migration, /ORDER BY legacy\."createdAt" ASC, legacy\."id" ASC/);
  assert.match(migration, /ON CONFLICT \("id"\) DO NOTHING/);
  assert.doesNotMatch(migration, /\bUPDATE\s+"User"\b/i);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\s+"User"\b/i);
  assert.doesNotMatch(migration, /\b(passwordHash|isActive)\b/);
});

test('legacy adoption audit is written, without storing credentials', () => {
  assert.match(schema, /model AdminAuditLog\s*\{/);
  for (const field of ['actorUserId', 'targetUserId', 'action', 'outcome', 'createdAt']) {
    assert.match(schema, new RegExp('\\b' + field + '\\b'));
  }
  assert.match(migration, /'LEGACY_ADMIN_ADOPTION'::"AdminAuditAction"/);
  assert.doesNotMatch(schema, /model AdminAuditLog\s*\{[^}]*passwordHash/s);
});

test('Seed is USER-only and never creates or resets any ADMIN', () => {
  assert.doesNotMatch(seed, /SEED_ADMIN_PASSWORD/);
  assert.doesNotMatch(seed, /role:\s*Role\.ADMIN/);
  assert.doesNotMatch(seed, /\buser\.update\(/);
  assert.doesNotMatch(seed, /\buser\.upsert\(/);
  assert.match(seed, /role:\s*Role\.USER/);
  assert.match(seed, /\buser\.findUnique\(/);
  assert.match(seed, /\buser\.create\(/);
});
