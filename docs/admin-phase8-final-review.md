# Phase 8 — Final Diff Review (security gate not passed)

**Date:** 2026-11-16 (Asia/Bangkok)\
**Workspace:** `server-side` on `macmini`\
**Plan:** OGTB Donation Map — One-Time Admin Bootstrap & Dashboard Admin Management\
**Review scope:** Entire task diff from Phases 1–7 (15 tracked files modified, 29 untracked files added; total **44**).
**Outcome:** **BLOCKED / passed=false** due to current dependency security advisories. The application design and isolated feature tests are substantially complete, but final security acceptance is not met. The Active Plan should remain active.

## Scope and code-diff findings

1. **First Admin:** `backend/scripts/bootstrap-admin.mjs` only runs when invoked interactively by a server operator; no public first-admin API, arguments, piped password, or automatic seed. `AdminBootstrapState(id=1)` permanently records completion, with PostgreSQL transaction advisory lock and atomic Audit Log.
2. **Legacy adoption:** Additive Prisma migration recognizes existing ADMIN accounts (including inactive), does not reset a password or change a role/status, and records a durable audit event.
3. **Admin authorization:** `POST /api/admin/users/admins` is behind `requireAuth` and `requireAdmin` with transaction-time active actor recheck. Frontend `/admin/users` uses a two-step form and sends only name, email and password; Backend fixes role/isActive and returns no hash. Role USER and Guest cannot create ADMIN. Email conflicts and audit failure rollback tested.
4. **Last-active Admin:** Admin status mutation takes the same lock, protects self-suspension and concurrent cross-suspension, and writes success/denial audit events as appropriate.
5. **Docker:** Exact requested commands preserved: Dev `docker compose -f dokcer-compose.dev.yaml up -d`, Prod `docker compose up -d`. Both execute Prisma migration on Backend startup but neither runs Admin Bootstrap nor Seed. Production image includes the explicit operator bootstrap CLI, not QA fixtures/scripts. `db:seed` is USER-only and blocks Production.
6. **Scope:** 44 changed/new files were enumerated and reviewed; all map to Admin design, migration, Docker, QA or documentation. Pattern scan found no accidentally embedded private keys, OpenAI keys, or GitHub token forms. No scope-external paths identified.

## Prior isolated functional evidence and current safe checks

- Phase 5: disposable PostgreSQL fresh/legacy migrations, first-Admin concurrency, transaction rollback, ADMIN API, and last-active protections **11/11**.
- Phase 5: full Backend regression on isolated DB **107/107**, actual Browser→isolated Express→PostgreSQL **3/3**.
- Phase 6: interactive Docker TTY and first-Admin repeat protection on isolated DB in Prod/Dev-like runtime **8/8**.
- Phase 7/8: current safe/Mock/Admin/Docs Backend **49/49**, Frontend Unit **20/20**, ESLint, Next.js production build, Prisma Validate and Dev/Prod Docker Compose config **PASS**.
- Final `git diff --check` passed in Phase 7 and at the beginning of Phase 8. A later redundant invocation was denied by the tool's safety guard; do not claim that blocked invocation passed.
- No live Postgres write/migration, Docker restart, Bootstrap, Seed, git commit or deployment was performed during this review.

## New blocking security findings — current npm audit

Ran `npm audit --omit=dev --json` against installed dependencies and Lockfiles (2026-11-16). Both audits returned nonzero status:

| Package tree | Critical | High | Moderate | Total |
| --- | ---: | ---: | ---: | ---: |
| Backend | **1** | **6** | 3 | 10 |
| Frontend | **1** | **2** | 0 | 3 |

### Backend

- `proxy-addr@2.0.7` — **critical** IP-spoofing issue involving IPv4-mapped IPv6 trust subnets; audit suggests `2.0.8`.
- `multer@2.3.0` — **high** request teardown/file-filter DoS; audit suggests `2.5.0`.
- `body-parser@2.3.0` — **high** compressed request body DoS; audit suggests `2.4.0`.
- `prisma@7.10.0` and transitive `@prisma/config`, `deepmerge-ts`, `mysql2` — high advisories, including deep merge stack exhaustion and dependent MySQL concerns. Dry-run suggests `prisma@7.10.1`, `deepmerge-ts@8.0.2`, `mysql2@3.24.4`.
- Additional moderate dependencies: `fast-uri`, `ip-address`, `qs`.

### Frontend

- `next@16.3.8` — **critical** advisories for RCE in specific image optimization and `use cache` conditions, plus App Router Server Actions DoS; dry-run suggests `next@16.4.6`.
- `sharp@0.35.4` — **high**, linked to librsvg dependency; dry-run suggests `0.35.5`.
- `source-map-js@1.2.1` — **high** event-loop DoS; dry-run suggests `1.2.2`.

These are **dependency advisories**, not proof that all attack preconditions are present in this application. Nevertheless, the active packages contain vulnerabilities rated Critical/High; the Phase 8 security gate cannot be certified as passed without remediation/verification. `npm audit fix --dry-run --omit=dev --json` demonstrated potential same-Major version updates (including a transitive `deepmerge-ts` major version update), but **no `npm audit fix`, package upgrade, lockfile edit or unreviewed dependency change was applied**. Blindly forcing upgrades is not appropriate without regression, rebuild and isolated security tests.

## Active deployment/readiness blockers

- Read-only PostgreSQL check in Phase 7: currently running DB **lacks** `AdminBootstrapState` and `AdminAuditLog`. Admin features are not production-ready until approved backup and migration.
- Current containers remain **Development**, source bind mounted with backend `node --watch`; code may hot reload without a deliberate restart.
- Existing live Dev containers expose ports **3000, 4000 and 5432 on `0.0.0.0`**. Production Compose source binds DB/Backend only to loopback, but applying it would require an approved mode transition and downtime; the active running deployment was not changed.
- Compose source preserves known, weak `ogtb` PostgreSQL credentials for backward compatibility with the existing volume. **Rotate database credentials safely and review firewall/TLS before public rollout**; changing only `POSTGRES_PASSWORD` does not rotate credentials in an already initialized Postgres volume.
- Production requires appropriate `JWT_SECRET` and verified backup/restore procedure.

## Required remediation for passing Phase 8

1. **Dependency security:** Review and update `next`, `sharp`, `source-map-js`, `proxy-addr`, `multer`, `body-parser`, Prisma and affected transitive dependencies to nonvulnerable supported releases. Prefer targeted compatible updates with explicit Lockfile review, **no unreviewed `npm audit fix --force`**. Re-run audits, unit/lint/build, Docker builds and isolated PostgreSQL/browser regressions. If an advisory cannot be eliminated without scope/major changes, document the affected attack path and a responsible, approved mitigation.
2. **Deployment separate from code review:** Back up and test restore for current PostgreSQL, assess exposed ports and secrets, rotate default credentials with an actual DB role update, approve scheduled migration/rollout, verify live schema and Admin login. Do not do these steps automatically.
3. Repeat final git diff review after security remediation (including changed manifests/Lockfiles) and make explicit `review.passed=true` only if blocking findings are closed.

## Active Plan behavior after failed review

The workspace recorded `complete_workspace_phase(phaseId=8, review.passed=false)`
with the blocking findings above. The Active Plan advanced its revision to
**9**, remains `active`, and automatically **reopened Phase 7
(`fix_review`, `in_progress`)** for remediation; Phase 8
(`review_diff`) returned to `pending`. This is the actual workspace
status after the failed security gate, not completion of Phase 8.
Dependency remediation is the next work item before reattempting review.

## Later Phase 7 remediation (historical follow-up)

This report describes the **original failed Phase 8 review**. Phase 7
subsequently patched source/Lockfiles: both Production
`npm audit --omit=dev` checks are now **0 vulnerabilities**;
Backend full audit 0; Frontend full audit has **7 Moderate in dev-only
typescript-eslint/minimatch**. Regression passed: 117/117 Backend,
11/11 PostgreSQL, 3/3 real Browser, 20/20 Frontend; Docker builds
passed. A **new Phase 8 review is still required**; the old review
decision is preserved. The running Dev containers and unmigrated
database have not been updated. Details:
`docs/admin-phase7-security-remediation.md`.

## Decision

**Review failed / BLOCKED** on newly confirmed Critical/High dependency advisories; do not close the Active Plan as passed. Keep Phase 8 active or failed-with-findings according to workspace review semantics. No commit/push/deployment.

## Final re-review result (subsequent Phase 8 pass)

A separate Phase 8 re-review after Phase 7 security remediation
**passed the scoped source-code/isolated-QA acceptance**. This
original failed review remains intact as historical evidence.
See `docs/admin-phase8-final-review-rerun.md` for current security
audit results, remaining 7 Moderate dev-tool findings and
**not-production-ready** caveats. The real Dev runtime and DB
remain unchanged by final review.
