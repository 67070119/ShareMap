# Phase 8 — Final Diff Review (Re-review after Security Remediation)

**Date:** 2026-11-16 (Asia/Bangkok)\
**Workspace:** `server-side` / `macmini`\
**Active Plan revision before review:** 10\
**Review scope:** OGTB Donation Map one-time Admin Bootstrap & Dashboard management, Docker Dev/Prod split, tests and documentation.\
**Disposition:** **PASS — source-code/isolated-QA acceptance only**. **NOT approved for production deployment or use of the new Admin features against the currently running database.**

This is a NEW review after Phase 7 security remediation. The historical failed review is retained in `docs/admin-phase8-final-review.md`.

## Changed-file scope and code safety

- Examined **49 changed/new workspace files**: **18 tracked modifications** and **31 new files** (including both package manifests and Lockfiles).
- All files are within the agreed Admin, Prisma, Docker, tests, QA reporting or documentation scope. No outside-scope file paths; no apparent committed private-key/token patterns; no accidental database truncate/drop scripts in the diff.
- The original USER signup/login/session, map, donations, image upload, reports and navigation paths were not intentionally redesigned.
- The final `git diff --check` passed (0 errors). File changes remain **uncommitted**.

### Admin security and correctness contracts

1. Initial Admin is created **only by explicit interactive CLI**, with hidden password input, no CLI password argument or public bootstrap endpoint, bcrypt, and an immutable one-time `AdminBootstrapState` singleton. Concurrent attempts serialize using the PostgreSQL advisory transaction lock, including atomic audit insertion.
2. The legacy migration is additive and recognizes existing ADMIN accounts even when inactive; preserves their roles, status and password hashes; and writes the adoption audit.
3. `db:seed` creates USER only when absent, does not promote/reset ADMIN, and is blocked in Production.
4. Later ADMINs are created through the protected `POST /api/admin/users/admins` (live ADMIN actor rechecked inside transaction), using a restricted DTO and audit. USER/anonymous requests are denied; existing email yields conflict; rollback protects against lost audit.
5. Self-suspension, last active ADMIN and concurrent cross-suspension restrictions use the same lock. Authorization remains in Backend, not merely UI.
6. `/admin/users` exposes the two-step responsive Add Admin UI only to ADMIN. Password is absent from confirmation and response; the UI guards double submit and does not repeat POST if list refresh fails.

### Docker contract

- Exact standalone commands: **Development** `docker compose -f dokcer-compose.dev.yaml up -d`, **Production** `docker compose up -d`. Both configurations render successfully.
- Backend calls `prisma migrate deploy` at container startup; it does **not** automatically call Admin Bootstrap or Seed.
- Production image builds from checked Lockfile, includes operator-only `bootstrap-admin.mjs` and excludes mutating QA fixtures; Dev uses code bind mount and watch mode.
- Both modes preserve the same PostgreSQL volume and donation photo storage; no `down -v` or live rollout was run.

## Dependency security review (current source/Lockfiles)

Re-ran all four `npm audit` modes after the Phase 7 patches:

| Audit | Critical | High | Moderate | Low | Review |
| --- | ---: | ---: | ---: | ---: | --- |
| Backend — production-only | 0 | 0 | 0 | 0 | PASS |
| Frontend — production-only | 0 | 0 | 0 | 0 | PASS |
| Backend — all dependencies | 0 | 0 | 0 | 0 | PASS |
| Frontend — all dependencies | 0 | 0 | **7** | 0 | Nonblocking documented dev-tool risk |

Frontend's seven remaining Moderate advisories are in the `typescript-eslint` / `minimatch` development toolchain. No Critical or High findings remain in the new Lockfiles. Production frontend Docker image currently uses `npm ci` and therefore **includes devDependencies in its image**, even though these tools are not needed in its running Next.js service. Consequently do not interpret `--omit=dev` audit as proving the entire built image is free of vulnerable packages; image hardening and upstream updates are recommended as post-review follow-up. Do not forcibly override transitive Major Versions without compatibility testing.

Current source Lockfiles resolve **Prisma CLI/Client/Adapter 7.10.1**, **Multer 2.5.0**, **proxy-addr 2.0.8**, **body-parser 2.4.0**, **Next.js 16.4.6**, **sharp 0.35.5**, and **source-map-js 1.2.2**.

## Test evidence

| QA checkpoint | Outcome |
| --- | --- |
| Backend safe/Admin/Documentation regression during this review | **49/49 PASS** |
| Frontend unit tests during this review | **20/20 PASS** |
| Frontend lint (zero warnings) | PASS |
| Next.js 16.4.6 production build | PASS |
| Prisma Schema validation | PASS |
| Dev/Prod effective Compose configuration | PASS |
| Git diff whitespace check | PASS |
| Phase 7 disposable PostgreSQL Admin concurrency/rollback | **11/11 PASS** |
| Phase 7 full Backend regression on disposable PostgreSQL | **117/117 PASS** |
| Phase 7 actual browser → isolated API → PostgreSQL | **3/3 PASS** |
| Phase 6 isolated interactive Docker Admin CLI | **8/8 PASS** |
| Phase 7 clean Backend and Frontend Docker Image builds | BOTH PASS |

Phase 7's disposable PostgreSQL and QA runtimes have been removed. No database-mutating integration tests were run in this read-only final review.

## Active environment verification (read-only)

The actual running stack is **still Development**, not the new standalone Production images:

- `server-side-frontend-1`: **Next.js 16.3.8**, despite new source Lockfile 16.4.6.
- `server-side-backend-1`: **Prisma Client 7.10.0**, despite new source Lockfile 7.10.1.
- `server-side-db-1`: `to_regclass` reads **false** for both `AdminBootstrapState` and `AdminAuditLog`.
- Existing Dev frontend/backend/database ports **3000, 4000, 5432** are published on all host interfaces.

This means **the patched source is not the active runtime**, and the Admin feature is **not live-ready**. Live operation is blocked pending a separately approved deployment/migration sequence; this is a distinct operational gate, not grounds to misreport the source-code diff as failing.

## Required before any production/public rollout

1. Back up PostgreSQL and **test restore**; determine whether legacy ADMINs exist and confirm intended target database. Obtain authorization for downtime/controlled `prisma migrate deploy` and verify the resulting Admin tables before any Bootstrap attempt.
2. Plan controlled Dev→Prod switching/rebuild; validate running Next.js/Prisma versions **inside the actual new containers**, not only the new Lockfiles.
3. Restrict exposed services (especially PostgreSQL 5432 and Backend 4000), configure firewall/TLS and appropriate reverse proxy; use a strong `JWT_SECRET`. Replace predictable DB role credentials **in PostgreSQL itself**, not merely by changing Compose environment variables.
4. Re-run vulnerability and container-image scans before deployment, track 7 remaining dev-tool Moderate advisories and consider excluding devDependencies from the final image via a tested multi-stage production build.
5. Verify the existing USER/auth/donation/map/reports flows and the one-time Admin CLI/Dashboard against the actual migrated environment only after approval.

**No Commit/Push/Deploy, no Docker restart, no live migration/seed/bootstrap, no user/data changes were performed by this final review.**

## Formal Phase 8 conclusion

**review.passed=true is justified for the scoped implementation and isolated QA**, with the seven Moderate development-tool advisories and all real-deployment prerequisites disclosed above. **Production readiness is explicitly NOT granted.** If an operator later requests rollout, treat it as a separately authorized task with backups and security checks, not an automatic consequence of closing this Active Plan.
