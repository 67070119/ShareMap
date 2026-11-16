# Phase 7 — Security Dependency Remediation After Failed Final Review

**Date:** 2026-11-16 (Asia/Bangkok)\
**Workspace:** `server-side` — `macmini`\
**Active Plan:** Phase 7 reopened by the failed P8 security review (revision 9).\
**Goal:** Remove current production Critical/High dependencies with compatible upgrades, verify all user and Admin workflows against disposable infrastructure, then retry Phase 8. **No real production deployment, database migration, secret rotation or commit is authorized by this phase.**

## Before remediation

The Phase 8 audit found:

| Dependency tree | Critical | High | Moderate |
| --- | ---: | ---: | ---: |
| Backend `npm audit --omit=dev` | 1 | 6 | 3 |
| Frontend `npm audit --omit=dev` | 1 | 2 | 0 |

Major findings included the `proxy-addr` IPv4-mapped IPv6 trust/subnet issue, Multer/body-parser request DoS, Prisma CLI transitive advisories, Next.js image optimization and caching RCE advisories, `sharp`, and `source-map-js`.

## Updates applied — no direct dependency Major upgrade

**Backend**

- Updated `backend/package.json` and `backend/package-lock.json`; Prisma CLI, `@prisma/client` and `@prisma/adapter-pg` constraints aligned at `^7.10.1` (Prisma Major 7 retained).
- Resolved `prisma` to 7.10.1, `multer` to 2.5.0, `proxy-addr` to 2.0.8, `body-parser` to 2.4.0, `mysql2` to 3.24.4, and `deepmerge-ts` to 8.0.2 through the reviewed supported dependency tree.
- Used `npm audit fix` without `--force`, then explicitly aligned Prisma packages; no application ORM schema/API/algorithm changes were required.
- Regenerated and validated Prisma Client (7.10.1) from the existing schema.

**Frontend**

- Updated `frontend/package.json` and `frontend/package-lock.json`; `next` and `eslint-config-next` now use compatible `^16.4.6`.
- Lockfile resolves Next.js 16.4.6, `sharp` 0.35.5, `source-map-js` 1.2.2.
- Reproduced the updated tree with `npm ci`; `npm run lint`, unit tests and Next.js production build passed on the new tree.

**Package manager note:** npm reported blocked lifecycle install scripts for Prisma engines and `unrs-resolver`. The Prisma client generated successfully and Next.js built successfully. Do not globally approve package lifecycle scripts without examining package origin and exact scope.

## Post-fix audit results

| Audit command | Critical | High | Moderate | Low | Outcome |
| --- | ---: | ---: | ---: | ---: | --- |
| Backend `npm audit` | 0 | 0 | 0 | 0 | PASS |
| Backend `npm audit --omit=dev` | 0 | 0 | 0 | 0 | PASS |
| Frontend `npm audit --omit=dev` | 0 | 0 | 0 | 0 | PASS |
| Frontend `npm audit` | 0 | 0 | **7** | 0 | Open, development-only |

The seven remaining **Moderate** findings arise from the dev-only
`typescript-eslint` / `@typescript-eslint/*` / `minimatch` chain used
by `eslint-config-next`. The latest `typescript-eslint` returned by
the npm registry during this review was 8.72.2 and still pulled vulnerable
`minimatch` 10.2.6. There was no compatible non-major fix offered by
`npm audit fix --package-lock-only`. These are **not in the
`--omit=dev` production dependency tree**; record them as residual
development-tool risk and monitor upstream instead of forcing an
untested dependency override.

These `npm audit` findings reflect the state of the **dependency
Lockfiles**, not an independent penetration test or proof that every
affected attack precondition exists. Re-audit before deployment.

## Isolation and Regression

The disposable PostgreSQL container `ogtb-p7-isolated-pg` was created
using `--rm`, `tmpfs`, and `127.0.0.1:32768`, with a unique test
database and test-only credentials, **not** the Compose database
on port 5432. The approved additive schema migrations applied cleanly.
`backend/scripts/admin-postgres-isolated.qa.mjs` passed **11/11**
on Prisma 7.10.1 (concurrency, audit rollback, auth boundaries and
last-active-Admin protection). The full Backend suite ran in an
independent `backend/.p7-qa-runtime` with its own Uploads folder:
**117/117 tests passed**, including Admin, User, Donation, Image, Map,
Reports, Navigation and HTTP end-to-end.

The updated Next.js 16.4.6 UI launched on isolated port 3109 with
the isolated Backend on port 41118. Actual authenticated
Browser→Express→PostgreSQL Add Admin scenarios passed **3/3**:
new Admin persisted, duplicate-email rejection and USER denied.
Frontend unit tests **20/20**, ESLint (zero warnings) and Production
Next.js build passed.

**Final verification:** After aligning Prisma CLI/Client/Adapter at
7.10.1, real isolated PostgreSQL Admin QA passed **11/11 again**, and
Backend Regression passed **117/117 again**. Both production Docker
Images built successfully using patched Lockfiles without replacing live
images. Inspection inside the images confirmed Prisma CLI/Client/Adapter
7.10.1, Multer 2.5.0, proxy-addr 2.0.8, Next.js 16.4.6, sharp 0.35.5
and source-map-js 1.2.2. Backend image includes the Bootstrap CLI but
excludes mutating QA fixture scripts. Images used temporary QA tags.

## Final verification and cleanup

- Aligned Prisma 7.10.1 client/CLI/adapter: **11/11** actual
  PostgreSQL admin integration checks passed after the final alignment.
- Full Backend suite after alignment: **117/117 passed** against the
  isolated database, with uploads in a separate scratch directory.
- Patched Next.js Browser→isolated Backend→PostgreSQL: **3/3 passed**.
- Frontend Unit **20/20**, lint (zero warnings), and Next.js 16.4.6
  production build **PASS**.
- Production Backend and Frontend Docker Images **both built and were
  inspected**; expected runtime dependency versions and the CLI
  script-only production scope were confirmed.
- After QA, the specially labeled tmpfs PostgreSQL container
  `ogtb-p7-isolated-pg`, both temporary Docker QA image tags and the
  isolated backend scratch/Uploads folder were **removed**.
  No Compose container was stopped or restarted, and no real
  database/volume was modified by these QA tests.
- Dependency audit after the changes: Backend full + Production
  **0 vulnerabilities**; Frontend Production **0 vulnerabilities**;
  Frontend full **7 Moderate development-tool advisories**.

## Required operational controls (NOT applied)

- The active `server-side` containers remain **Development** and
  have their own container-managed `node_modules` volumes. They are
  **not automatically patched** by changing host Lockfiles; the
  running Next.js instance was last observed at 16.3.8. An approved
  rebuild / rollout is required before live runtime vulnerabilities
  can be called fixed.
- The current active database has not yet applied
  `AdminBootstrapState` / `AdminAuditLog` migrations.
- Current Dev ports 3000/4000/5432 are exposed on all interfaces;
  default PostgreSQL credentials are present in the historical Compose
  configuration. Firewall, HTTPS, live credential rotation, DB backup
  and approved migration remain separate deployment prerequisites.
- **Do not** run a full DB test or `db:deploy` against the running
  Compose database from this security remediation work.
- All source edits and dependencies remain uncommitted, unpushed
  and undeployed.

## Review disposition

Production dependency vulnerability blocker from the previous P8
review **is remediated at the source/Lockfile level**. The new P8
review must verify final Docker builds, any residual findings and
scope/safety before closing the Active Plan. Seven moderate
development-only advisories should be disclosed, monitored and not
misrepresented as zero full-tree findings.
