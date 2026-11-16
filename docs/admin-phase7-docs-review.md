# Phase 7 — Documentation Sync & Findings Fixes

**Workspace:** `server-side` on `macmini`\
**Date:** 2026-11-16 (Asia/Bangkok)\
**Scope:** Reconcile the Admin Bootstrap / Dashboard changes from Phases
1–6 with the OGTB project documents, confirm Docker/Prisma/API contracts,
fix inconsistent guidance, and hand off to Phase 8 final diff review.

## Documents examined and reconciled

| File | Reconciliation |
| --- | --- |
| `README.md` | Correct Dev/Prod Compose, manual first-Admin CLI, USER-only Dev seed, migration-on-startup, DB-test safety, project status and runtime caveats |
| `.env.example` | Dev/Prod exact commands, environment notes, no Admin password seed, and JWT security warnings |
| `docs/api-spec.md` | Protected additional-Admin endpoint, validation, error codes, Admin state updates, prerequisites and runtime readiness |
| `docs/architecture.md` | Actual Dev bind mounts vs Prod images; root env and NODE_ENV; explicit migration behavior; accurate Admin security/QA status; no stale test-count or unverified npm-audit claims |
| `docs/database.md` | Singleton Bootstrap State, audit schema, legacy adoption, Dev-only seed, safe migration/testing instructions, completed isolated DB tests and current DB prerequisites |
| `docs/project-flow.md` | Removed duplicated Donation/Admin Dashboard lines; aligned CLI vs Dashboard flow, UI retry behavior, real vs mocked QA and migration prerequisites |
| `server-side-project-system.md` | Source-of-truth Admin scope, legacy/USER/ADMIN permission boundary and dated active-system readiness note |
| `docs/admin-bootstrap.md` | Correct real Docker TTY test status, operator CLI/legacy recovery, Dev/Prod setup, seed restrictions and required DB backup/migration |
| `docs/docker-admin-setup.md` | Dedicated Dev/Prod runbook, exact CLI commands, safe switching, storage, initial Admin flow and current runtime risks |
| `docs/admin-phase5-isolated-qa.md` | Preserved Phase 5 evidence, added later Phase 6 TTY follow-up without rewriting historical findings |
| `docs/admin-phase6-docker-qa.md` | Preserved Phase 6 evidence; linked this Phase 7 reconciliation |
| `docs/admin-phase7-docs-review.md` | This detailed handoff and outstanding prerequisites |

## Key facts verified directly against source and runtime

1. **First ADMIN only via explicit interactive CLI**:
   `npm run admin:bootstrap` (`backend/scripts/bootstrap-admin.mjs`).
   A durable `AdminBootstrapState(id=1)` prevents repeated creation.
   Prior legacy ADMINs, including inactive accounts, are adopted.
2. **Subsequent ADMINs**: authenticated active ADMIN uses the
   `/admin/users` Dashboard → `POST /api/admin/users/admins`.
   Backend chooses `role=ADMIN`, hashes passwords, creates Audit Log;
   public registration always creates USER.
3. **Admin suspension**: self-suspension and last-active-Admin protection,
   privilege transaction lock and audit success/denial semantics are documented.
4. **Dev startup**:
   `docker compose -f dokcer-compose.dev.yaml up -d`.
   Hot reload and source bind mounts.
5. **Prod startup**: `docker compose up -d`.
   Production images, no Dev watch, no general scripts/QA in Backend image.
6. Both startup modes automatically run `prisma migrate deploy` at
   Backend startup; **neither automatically runs Admin Bootstrap or Seed**.
   `db:seed` creates only a missing demo USER and refuses Production.
7. Both modes share the `postgres_data` volume and preserve donation
   photos; switching modes may involve downtime. No `down -v`.
8. Actual P5/P6 isolated QA: PostgreSQL Admin 11/11, Backend full
   regression 107/107, real Browser→API→PostgreSQL 3/3, Docker
   interactive bootstrap 8/8. These results are **isolated**, not
   evidence that the live stack has been upgraded.

## Active-system finding (read-only, point-in-time)

The running containers were inspected **without restart**:

- `server-side-backend-1`: `node:24-alpine`, source bind mounted into
  `/app`, running `node --watch src/server.js`.
- `server-side-frontend-1`: `node:24-alpine`, source bind mounted,
  Next.js Dev runtime.
- Active database read-only `to_regclass` lookup returned **false** for
  `AdminBootstrapState` and **false** for `AdminAuditLog`.

**Implication:** Source edits may already be hot-reloaded into Dev containers
without an explicit restart; however, new Prisma migrations do NOT run on
each source change. The new Admin creation/bootstrap/status-audit functions
cannot be considered ready on this live DB until a backed-up, approved
migration is applied. Do not infer "not deployed" just from the absence of
a manual Docker restart.

No live migration, Admin creation, seed, status change, production rollout,
container restart, commit or push was carried out in this phase.
No existing database rows or donation files were changed by this audit.

## Documentation findings fixed

- Replaced outdated "Phase 5 integration pending" statements with
  verified P5 and P6 results and correct historical distinctions.
- Removed duplicate Donation instructions and duplicate Admin Donations
  branch in Project Flow.
- Corrected Architecture's incorrect claim that both Dev and Prod use
  Node-module bind/Named Volumes.
- Removed unsupported frozen count of "77 backend tests" and outdated
  dependency `npm audit` status claims. Security audit must be rerun
  against the then-current Lockfiles before rollout.
- Clarified that `npm test` / `npm run test:coverage` can mutate
  database and upload test artifacts; full integration must run only
  against a verified disposable database with isolated Working Directory.
- Clarified root `.env` versus Compose-pinned `NODE_ENV`,
  development-only `SEED_USER_PASSWORD`, and obsolete Admin Seed variable.
- Added runtime-specific warning that active Dev containers hot reload while
  current DB does not contain the required Admin tables.

## Quality controls

A new safe, no-database documentation regression suite exists:
`backend/tests/admin-documentation-contract.test.js`. It verifies
the four exact Docker/CLI commands, authenticated/Admin-only contracts,
no automatic Bootstrap/Seed, current isolation/security guidance,
absence of known stale text, and relative Markdown link integrity.

**Phase 7 final QA (all PASS):**

| Check | Outcome |
| --- | --- |
| Documentation Contract Tests | **6/6 passed** (included in 49 backend tests) |
| Backend safe/Mock/Admin/Docs regression | **49/49 passed**, no live database mutation |
| Frontend Unit Tests | **20/20 passed** |
| Frontend ESLint (zero warnings) | **PASS** |
| Frontend production `npm run build` | **PASS** |
| Prisma `prisma validate` | **PASS** |
| Production `docker compose config --quiet` | **PASS** |
| Development `docker compose -f dokcer-compose.dev.yaml config --quiet` | **PASS** |
| `git diff --check` | **PASS** |
| Relative Markdown links | **All references resolved** |

Full PostgreSQL integration is **not** rerun against the live database
in Phase 7. The isolated PostgreSQL/browser/TTY results from Phase 5–6
remain the basis for DB-level verification. `npm audit` was **not**
re-run in Phase 7 and must be performed with current Lockfiles before
a production rollout.

## Handoff to Phase 8 — Final diff review

Phase 8 should review **the entire uncommitted diff** against the Active
Plan's scope and constraints, including:

- CLI one-time semantics, permanent marker, migration adoption/backfill
  and concurrency lock (`::text` result compatibility with Prisma).
- Admin API/Dashboard permissions, role/status guard, secret avoidance,
  idempotency, AuditLog atomicity and last-active-Admin enforcement.
- Docker Dev/Prod exact commands, Production Image contents,
  Production Seed fail-closed and shared storage behavior.
- No accidental test/QA artifacts, plaintext credentials, out-of-scope
  changes or obsolete documentation.
- Rollout prerequisites and backup/restore plan for the **currently
  unmigrated live DB**; do not apply a migration in Final Review
  without a separate explicit operator request.

**Do not commit, push, deploy, restart Docker or update the live database
from the Phase 7 / Phase 8 review workflow without authorization.**
