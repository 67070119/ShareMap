# Phase 5 — Isolated Admin Security, Migration & Regression QA

**Workspace:** `server-side` on `macmini`\
**Date:** 2026-11-16 (Asia/Bangkok)\
**Plan:** OGTB Donation Map — One-Time Admin Bootstrap & Dashboard Admin Management\
**Phase:** P5 — Isolated Security, Migration & Regression QA

## Isolation: verified, no real user database mutations

The existing Compose database and services remained running on ports **5432/4000/3000** and were **not restarted**. A NEW disposable PostgreSQL 17 Docker container was started separately:

- Name: `ogtb-p5-disposable-pg-20261116`, label `ogtb.purpose=isolated-admin-phase5-qa`.
- Exposed **only** on `127.0.0.1:32768`; no external interface.
- PostgreSQL data stored via `--tmpfs /var/lib/postgresql/data:rw,size=256m`, with **no mounted volumes**; `--rm` removes it on stop.
- Databases `ogtb_p5` (fresh), `ogtb_p5_legacy` (legacy adoption) and an unused transient `ogtb_p5_cli` (no production resources).
- All database-mutating commands used the unique isolated container name or an explicit `DATABASE_URL` pointing to `127.0.0.1:32768` and the `ogtb_p5*` database. The dedicated integration script refuses other hosts or database names and requires `OGTB_ISOLATED_PHASE5=true`.
- Backend full-suite tests ran from a separate temporary **working directory** (`backend/.p5-qa-runtime`) so image upload tests never touched the live `backend/uploads` tree.
- Real Browser→API QA used separate UI port **3109** and API port **41118** with temporary test credentials; it did **not** call the existing UI/API on 3000/4000.
- No `docker compose up/down`, persistent volume deletion, live DB migration, live bootstrap, deploy, commit or push.

## Finding fixed: Prisma cannot deserialize PostgreSQL void Advisory Lock

Initial real PostgreSQL attempt failed because the shared helper in
`backend/src/services/admin-bootstrap.service.js` used:

```js
await tx.$queryRaw`SELECT pg_advisory_xact_lock(${ADMIN_PRIVILEGE_LOCK_KEY}::bigint)`;
```

`pg_advisory_xact_lock` returns PostgreSQL `void`, which Prisma 7 / adapter-pg cannot deserialize from `$queryRaw`. This had been **missed by mock-based unit tests** and would have prevented first-admin CLI creation as well as additional-Admin API and Admin suspension.

**Fixed** by casting the result into a supported data type:

```js
await tx.$queryRaw`SELECT pg_advisory_xact_lock(${ADMIN_PRIVILEGE_LOCK_KEY}::bigint)::text AS locked`;
```

Lock acquisition, exclusivity and transaction lifetime remain unchanged. Added a regression assertion in `backend/tests/admin-bootstrap-service.test.js` requiring the cast. All following real PostgreSQL and HTTP tests passed with this fix.

## Isolated migration and legacy adoption verification

**Fresh database:** `npm run db:deploy` successfully applied both migration files:

1. `20260911032123_init`
2. `20261116040000_admin_bootstrap_audit_contracts`

**Legacy database:** Started from only the original `20260911032123_init` SQL, inserted two ADMIN users (oldest **inactive**, newer active) plus one inactive USER, registered the original migration as applied, then ran `prisma migrate deploy`.

Results:

- The new singleton `AdminBootstrapState` was inserted with
  `source=LEGACY_ADMIN`, `initialAdminId=legacy-inactive-admin`, and `id=1`.
- Exactly **one** `LEGACY_ADMIN_ADOPTION / SUCCESS` audit event was inserted.
- Both legacy ADMIN password hashes, roles and active flags remained byte-for-byte unchanged.
- The old inactive USER also preserved its role, active flag and password hash.
- Explicit `npm run db:seed` with dummy `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD` left all three legacy users untouched and created **no** new ADMIN.
- Bootstrap state is independent of User deletion.

## Actual PostgreSQL + Express Admin security tests

`backend/scripts/admin-postgres-isolated.qa.mjs` (requires **fresh, disposable database** and `OGTB_ISOLATED_PHASE5=true`) passed **11/11**:

- Fresh schema and bootstrap preflight.
- **Two simultaneous first-Admin bootstrap calls → exactly one Admin**, marker and one audit.
- Retry blocked permanently after deactivation of initial Admin.
- Public registration results in USER, not ADMIN.
- Real HTTP rejects Anonymous and USER, invalid body/Role, invalid password.
- Active ADMIN creates additional ADMIN through real HTTP; password hash excluded from DTO and audit actor/target correct.
- Concurrent duplicate email requests → one 201, one 409.
- Self-suspension denied/audited, admin suspension/reactivation succeeds, inactive actor denied.
- Trigger-injected audit write failure returns server error and rolls back new Admin User row. Test-only PostgreSQL trigger is removed after the test.
- Concurrent mutual Admin suspension preserves at least one active ADMIN.
- Deleting original Admins does not reset the permanent marker.

**Exception during test** was intentionally induced by the temporary audit-trigger failure and is not an unresolved failing test. All 11 cases passed.

## Full backend regression on disposable PostgreSQL

Ran **all 14 backend `*.test.js` files** from an isolated runtime/uploads directory with a dedicated test-only JWT secret:

- **107/107 passed**, 0 failures.
- Covered Auth, Admin HTTP, Admin permissions, Donation CRUD and HTTP, image upload/delete and limits, Map/Nearby, Reports, Navigation, Security, complete HTTP system flow, date handling and Admin-bootstrap mocks.
- The first run was blocked by missing `JWT_SECRET` in isolated scratch cwd. Passing a **test-only JWT_SECRET** resolved the test configuration; the subsequent complete run passed. No application change was required.

## Actual Dashboard → isolated API → PostgreSQL (not Mock API)

Ran the Next.js frontend and Express backend on **3109 / 41118** (not the live service), intercepted Browser `/api/*` requests only to forward to the isolated Express API, and used a genuine HttpOnly login cookie.

`frontend/e2e/phase5-live-isolated-admin-qa.mjs` passed **3/3**:

1. Real ADMIN login → `/admin/users` → Add Admin form → confirmation → real `POST /api/admin/users/admins` → PostgreSQL → real `GET /api/admin/users` refresh. Exactly one POST, no password in confirmation, request keys only `name,email,password`.
2. Duplicate Email from actual Dashboard receives and displays Backend 409 without duplicate creation.
3. Real registered USER cannot view the Admin page or Add Admin action.

Queried the disposable database after the Browser run; the newly created Admin existed and had exactly one matching `ADMIN_CREATED / SUCCESS` audit event. Browser QA can be re-run with unique randomized emails.

**Mock Browser QA kept from P4:** 13/13 Add Admin browser scenarios and 27/27 pre-existing Admin browser regression scenarios passed in P4; they are not a substitute for this real DB check.

## Remaining checks and limitations

- This phase does **not** mean the production/live database has been migrated. No deployment, live CLI command or data mutation occurred in the real services.
- The first-Admin **service** ran against actual PostgreSQL including concurrent calls; the interactive TTY prompt itself was previously tested for rejecting non-TTY/argument inputs. An automated **full interactive TTY provisioning session was not completed**.
- PostgreSQL concurrency tests cover the intended service lock; out-of-band manual SQL privilege manipulation is outside application-level lock guarantees.
- Live production configuration, external OSRM availability, camera/GPS devices and long-running production monitoring are **not** certified.
- Avoid running the test script against a persistent database. `backend/scripts/admin-postgres-isolated.qa.mjs` intentionally requires a **fresh**, disposable `ogtb_p5` database; running it twice without resetting the disposable database is not supported. `frontend/e2e/phase5-live-isolated-admin-qa.mjs` uses unique emails and can be re-run while the isolated services are active.
- If the isolated test stack cannot be verified in a future run, do not skip safety checks or point tests at the active Compose database.

## Artifacts

- `backend/scripts/admin-postgres-isolated.qa.mjs` — explicit opt-in, disposable-DB PostgreSQL test suite.
- `frontend/e2e/phase5-live-isolated-admin-qa.mjs` — real Browser→API→DB QA runner.
- `frontend/playwright-report/phase5-postgres-integration/results.json` and PNG screenshots (ignored QA outputs).
- This report: `docs/admin-phase5-isolated-qa.md`.
- Permanent regression fix: `backend/src/services/admin-bootstrap.service.js` and `backend/tests/admin-bootstrap-service.test.js`.

## Test resource cleanup — verified

After all QA finished, stopped **only** the dedicated test backend/frontend
processes on ports **41118/3109**, removed
`backend/.p5-qa-runtime`, and stopped
`ogtb-p5-disposable-pg-20261116`. Its `--rm` / `tmpfs` configuration
removed the disposable data. Verified ports 41118, 3109 and 32768 closed,
the scratch folder absent, and all existing Compose services still running
on 4000 / 3000 / 5432. All persistent project volumes were left intact.
No test containers or background QA processes remain.

**P5 overall:** The migration, backend, Browser and security checks passed within disposable isolated test resources. Full TTY terminal automation and deployment checks remain unverified; they are not required to apply or manipulate the real DB in this phase.

## Follow-up after Phase 5 (Phase 6 verification)

At the time of Phase 5, complete interactive TTY input was not automated.
**Phase 6 later completed it:** 8/8 isolated Docker TTY checks passed
with disposable PostgreSQL in both Production Image and Development-like
Node runtime. This does not change the original Phase 5 findings or imply
live database migration. See `docs/admin-phase6-docker-qa.md`.
