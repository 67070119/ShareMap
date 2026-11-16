import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (filename) => readFileSync(path.join(root, filename), 'utf8');
const prod = read('docker-compose.yml');
const dev = read('dokcer-compose.dev.yaml');
const dockerfile = read('backend/Dockerfile');
const ignore = read('backend/.dockerignore');
const backendPkg = JSON.parse(read('backend/package.json'));
const seed = read('backend/prisma/seed.js');

test('Compose startup never bootstraps or seeds Admin automatically', () => {
  for (const [label, yaml] of [['production', prod], ['development', dev]]) {
    assert.doesNotMatch(yaml, /admin:bootstrap|db:seed/, label);
    assert.match(yaml, /npm run db:deploy/);
    assert.match(yaml, /postgres_data:.*\/var\/lib\/postgresql\/data/);
  }
  assert.match(dev, /npm run prisma:generate/);
  assert.match(dev, /npm run dev/);
  assert.match(prod, /npm run start/);
});

test('Docker production builds include explicit CLI only, not DB-modifying QA scripts', () => {
  assert.match(dockerfile, /^COPY scripts\/bootstrap-admin\.mjs \.\/scripts\/bootstrap-admin\.mjs$/m);
  assert.doesNotMatch(dockerfile, /^COPY scripts \.\/scripts$/m);
  assert.match(ignore, /^scripts\/\*\.qa\.\*$/m);
  assert.match(ignore, /^scripts\/e2e-fixtures\.mjs$/m);
  assert.equal(backendPkg.scripts['admin:bootstrap'], 'node scripts/bootstrap-admin.mjs');
});

test('Dev and Prod preserve same named PostgreSQL volume and donation uploads', () => {
  assert.match(prod, /\bpostgres_data:\s*\/var\/lib\/postgresql\/data/);
  assert.match(dev, /\bpostgres_data:\s*\/var\/lib\/postgresql\/data/);
  assert.match(prod, /\.\/backend\/uploads:\/app\/uploads/);
  assert.match(dev, /\.\/backend:\/app/); // Dev bind mount contains uploads.
  assert.match(prod, /NODE_ENV: production/);
  assert.match(dev, /NODE_ENV: development/);
});

test('Demo USER seed cannot run in Production and cannot create Admin', () => {
  assert.match(seed, /process\.env\.NODE_ENV === 'production'/);
  assert.match(seed, /DEMO_SEED_DISABLED_IN_PRODUCTION/);
  assert.doesNotMatch(seed, /SEED_ADMIN_PASSWORD/);
  assert.doesNotMatch(seed, /Role\.ADMIN/);
  assert.match(seed, /Role\.USER/);
});
