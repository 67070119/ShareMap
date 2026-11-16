# Phase 6 — Docker Dev/Production Admin Bootstrap Integration QA

**Date:** 2026-11-16, Asia/Bangkok\
**Workspace:** `server-side` on `macmini`\
**Plan Phase:** P6 Docker Dev/Prod Bootstrap Integration\
**Status:** Code-level and isolated runtime QA complete; no live deployment.

## User-required commands (unchanged)

Development:

```bash
docker compose -f dokcer-compose.dev.yaml up -d
docker compose -f dokcer-compose.dev.yaml exec backend npm run admin:bootstrap
```

Production:

```bash
docker compose up -d
docker compose exec backend npm run admin:bootstrap
```

The misspelling `dokcer-compose.dev.yaml` is intentional and must remain
exactly as requested. Both files are complete, independent stacks with the
same project name and PostgreSQL volume. Never start both stacks
simultaneously against that persisted database.

## Validated runtime behavior

- Development `backend`: `npm install && npm run prisma:generate &&
  npm run db:deploy && npm run dev`, Node watch and bind-mounted backend.
- Production `backend`: `npm run db:deploy && npm run start` using a
  Docker-built production image and persistent `./backend/uploads` images.
- Development Frontend uses `next dev`; Production Frontend uses
  prebuilt `next build` and `next start`.
- Both Compose modes automatically execute `prisma migrate deploy`.
  This may adopt a pre-existing legacy ADMIN into `AdminBootstrapState`,
  but **never creates the initial Admin automatically**.
- Both compose commands **do not** invoke `db:seed` or
  `admin:bootstrap` at startup, and preserve the same `postgres_data`
  named volume; no `down -v` or live DB reset was run.
- `NODE_ENV` is pinned to `development` or `production` by its
  respective Compose service. JWT, Postgres, CORS and network caveats
  are in `docs/docker-admin-setup.md`.

## Production image hardening

Updated `backend/Dockerfile` to copy **only**
`scripts/bootstrap-admin.mjs` from `backend/scripts`, rather than
shipping all scripts including E2E fixtures. Added matching Docker build
context exclusions in `backend/.dockerignore`:

- `scripts/*.qa.*`
- `scripts/e2e-fixtures.mjs`

Built standalone test tags `ogtb-p6-backend-check:temporary` and
`ogtb-p6-frontend-check:temporary` without overwriting the images used
by running containers. The Backend runtime was inspected directly:
Prisma Schema, generated Prisma Client, npm `admin:bootstrap` script
and `bootstrap-admin.mjs` were present; QA/fixture scripts were absent.

Updated `backend/prisma/seed.js` to reject invocation if
`NODE_ENV=production`, enforcing its stated development-only contract.
A network-disabled execution of the production image returned
`DEMO_SEED_DISABLED_IN_PRODUCTION` and nonzero exit code as expected.
This seed still creates only a missing USER during explicit Dev use.

## Interactive Docker TTY QA — 8/8 passed

Added `backend/scripts/admin-docker-tty-isolated.qa.py`. The script
refuses to run without `OGTB_P6_DOCKER_QA=yes` and refuses to reuse
an existing test network/container. It creates a new bridge network,
auto-remove PostgreSQL with **tmpfs storage**, no published host ports,
and generates ephemeral credentials **in memory**, not in shell arguments.

It uses the built Production Backend Image and a Development-like
`node:24-alpine` runtime with a **read-only** backend bind mount.
For each runtime, it applies both migrations to a **fresh disposable DB**,
then drives actual interactive terminal input with Python's pseudo-TTY
for Name, Email, Password (hidden) and Confirm Password (hidden).

| Test | Production | Development-like runtime |
| --- | --- | --- |
| Isolated migration deployment | PASS | PASS |
| Create first ADMIN via real interactive CLI | PASS | PASS |
| Reject repeated initial bootstrap | PASS | PASS |
| Check DB contains Admin=1 / State=1 / Audit=1 | PASS | PASS |

Total **8/8 passed**, repeated after the final Production Dockerfile
hardening. The test specifically checks that secret input is **not
echoed** in terminal output. After execution, the script automatically
stops/removes the disposable PostgreSQL container and Docker network.

**Limit:** The Dev runtime is a standalone container reproducing the
backend source bind mount and Node image, not an actual `docker compose exec`
command against the currently running development service.
The live Compose state was intentionally left untouched.
The Production runtime is the actual freshly built Docker Image.
This test confirms manual operator CLI readiness in equivalent
isolated container conditions, not a production deployment.

## Regression and documentation changes

New `backend/tests/docker-admin-contract.test.js` enforces the
no-auto-bootstrap/seed contract, retained storage mappings, environment
modes, operator CLI presence, production image script isolation and
production seed restriction. `backend/tests/admin-bootstrap-contract.test.js`
also confirms USER-only seed and no ADMIN upsert.

Updated:
- `backend/Dockerfile` and `backend/.dockerignore`
- `backend/prisma/seed.js`
- `.env.example`, `README.md`, `docs/admin-bootstrap.md`
- `docs/docker-admin-setup.md` (new detailed operator runbook)
- `docs/architecture.md`, `docs/database.md`,
  `docs/project-flow.md`, `server-side-project-system.md`

## Final QA gates and cleanup

- Real interactive Docker TTY + isolated PostgreSQL: **8/8 PASS** (after the
  final Dockerfile hardening and production seed restriction).
- New Docker Admin static contracts plus safe Bootstrap/Admin/Security backend
  regressions: **43/43 PASS**.
- Frontend unit tests: **20/20 PASS**; Frontend ESLint: **PASS**.
- Prisma Schema validation: **PASS**.
- Both effective Compose configurations: **PASS**.
- Production Backend and Frontend Image builds: **PASS**.
- Intentional Production `db:seed` rejection: **PASS**
  (`DEMO_SEED_DISABLED_IN_PRODUCTION`, nonzero process exit).
- `git diff --check`: **PASS**.
- The isolated PostgreSQL container and dedicated Docker network were
  stopped/removed automatically; verified absent afterward.
- Both temporary test image tags were removed **only after verifying
  no containers referenced them**. Existing running Docker Compose
  containers were rechecked and remained intact on ports 3000/4000/5432.
- Persistent PostgreSQL volume and host image uploads were unchanged.

To rerun the P6 TTY QA, rebuild the temporary Backend Image tag locally
first (without changing running containers), then invoke
`OGTB_P6_DOCKER_QA=yes python3 backend/scripts/admin-docker-tty-isolated.qa.py`
from the repository root. The script creates and removes only its own
disposable Docker network and database; never use it with production
credentials or production database volumes.

## Safety and remaining limitations

- Existing `server-side-db-1`, `server-side-backend-1`, and
  `server-side-frontend-1` were **not restarted**, disconnected
  or migrated. Their real database, photos and named volumes were
  untouched.
- No `docker compose up/down`, no live CLI bootstrap, seed,
  migration, commit, push or deployment was executed.
- Production database credentials remain inherited from the
  existing configuration for compatibility with the current
  persisted volume; rotating them, setting up backups/HTTPS
  and an approved rollout are operational prerequisites.
- P5 separately verified the real Prisma/PostgreSQL race, rollback
  and real Browser→API→DB workflow (11/11 + 3/3), but on disposable
  infrastructure, not on the current running database.
- The final P7 Documentation Sync and P8 Review Diff remain pending.

**Phase 6 disposition:** Implementation and isolated verification complete;
the next Active Plan phase is P7 Documentation Sync / Findings Fixes.

## Follow-up: Phase 7 documentation reconciliation

Phase 7 subsequently synchronized operator instructions and current
deployment-readiness caveats across README, Database, Architecture, Project
Flow, API Spec and System Scope. This report remains the historical
evidence for Phase 6. See `docs/admin-phase7-docs-review.md`.
