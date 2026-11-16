import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const docs = [
  'README.md', 'server-side-project-system.md', 'docs/api-spec.md',
  'docs/architecture.md', 'docs/database.md', 'docs/project-flow.md',
  'docs/admin-bootstrap.md', 'docs/docker-admin-setup.md',
];
const dev = 'docker compose -f dokcer-compose.dev.yaml up -d';
const prod = 'docker compose up -d';
const devCLI = 'docker compose -f dokcer-compose.dev.yaml exec backend npm run admin:bootstrap';
const prodCLI = 'docker compose exec backend npm run admin:bootstrap';

test('README and runbook preserve exact Dev/Prod startup and operator bootstrap commands', () => {
  for (const file of ['README.md', 'docs/docker-admin-setup.md', 'docs/admin-bootstrap.md']) {
    const text = read(file);
    for (const cmd of [dev, prod, devCLI, prodCLI]) {
      assert.ok(text.includes(cmd), file + ' missing ' + cmd);
    }
  }
  assert.ok(read('.env.example').includes(dev));
  assert.ok(read('.env.example').includes(prod));
});

test('documentation matches USER-only Seed, operator-only first Admin and protected additional Admin API', () => {
  const seed = read('backend/prisma/seed.js');
  const route = read('backend/src/routes/admin.routes.js');
  const auth = read('backend/src/services/auth.service.js');
  assert.doesNotMatch(seed, /Role\.ADMIN|SEED_ADMIN_PASSWORD/);
  assert.match(seed, /NODE_ENV === 'production'/);
  assert.match(route, /post\('\/users\/admins', validateAdditionalAdmin, createAdmin\)/);
  assert.doesNotMatch(auth, /Role\.ADMIN/);
  for (const file of ['README.md','docs/admin-bootstrap.md','docs/database.md',
    'docs/project-flow.md','server-side-project-system.md']) {
    const text = read(file);
    assert.match(text, /admin:bootstrap|Bootstrap/i, file);
    assert.match(text, /ADMIN|Admin/, file);
  }
  assert.match(read('docs/api-spec.md'), /POST \/api\/admin\/users\/admins/);
});

test('docs clarify that Compose migrations run automatically but first Admin/seed do not', () => {
  for (const file of ['README.md', 'docs/admin-bootstrap.md', 'docs/docker-admin-setup.md']) {
    const text = read(file);
    assert.match(text, /migrate deploy|db:deploy/, file);
    assert.match(text, /automatically|อัตโนมัติ/, file);
  }
  for (const file of ['docker-compose.yml', 'dokcer-compose.dev.yaml']) {
    const yaml = read(file);
    assert.match(yaml, /npm run db:deploy/);
    assert.doesNotMatch(yaml, /admin:bootstrap|db:seed/);
  }
});

test('runbooks warn about live DB risk, production credentials and isolated QA', () => {
  const readme=read('README.md');
  assert.match(readme, /DATABASE_URL/);
  assert.match(readme, /ฐานข้อมูลทดสอบ|disposable test database/);
  assert.match(readme, /Backup|back up|สำรอง/i);
  assert.match(read('docs/docker-admin-setup.md'), /tmpfs/);
  assert.match(read('docs/admin-phase5-isolated-qa.md'), /107\/107/);
  assert.match(read('docs/admin-phase6-docker-qa.md'), /8\/8/);
});

test('core docs have no obsolete P5 pending or unverified TTY status', () => {
  for (const file of docs) {
    const text = read(file);
    for (const old of [
      'Phase 5 pending:', 'Database-backed E2E verification remains P5',
      'still pending a verified isolated disposable DB in P5',
      'Full interactive TTY entry was not automated',
      'Repository ปัจจุบันมี Backend test cases 77 cases',
      'CLI/API/Dashboard creation are **not yet implemented**',
    ]) {
      assert.ok(!text.includes(old), file + ' has obsolete wording: ' + old);
    }
  }
});

test('all relative Markdown documentation links point to existing files', () => {
  const pages=['README.md','server-side-project-system.md',
    ...readdirSync(path.join(root,'docs')).filter(x=>x.endsWith('.md')).map(x=>'docs/'+x)];
  let checked=0;
  for (const page of pages) {
    const markdown=read(page);
    for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target=match[1].split('#')[0];
      if (!target || /^(https?:|mailto:|#)/.test(target)) continue;
      const full=path.resolve(root,path.dirname(page),target);
      assert.ok(existsSync(full), page+' links to missing '+target);
      checked++;
    }
  }
  assert.ok(checked>=10, 'Unexpectedly few internal Markdown links');
});
