# Docker Modes & First Admin Setup — OGTB Donation Map

**Phase 6 verification (2026-11-16):** both Compose files were rendered and
validated without starting/restarting the existing containers; independent
Production and Development Docker TTY bootstrap tests passed **8/8** using
disposable PostgreSQL. The active Compose database was **not** migrated.

## Active system readiness — read-only snapshot (2026-11-16)

At this snapshot, the running containers are **Development**:
`server-side-backend-1` uses `node --watch` with a read/write source
bind mount; the frontend also bind-mounts its code and runs Dev mode.
Therefore source edits can affect the running Dev runtime via hot reload
even when no `docker compose up`/restart/deploy command was executed.

A read-only query to the active PostgreSQL database returned **absent**
for both `AdminBootstrapState` and `AdminAuditLog`. These tables are
required before the new Admin Bootstrap, Add Admin, and Admin status
auditing functions can work. **Do not run Admin setup against the current
stack until migration readiness is reviewed and backed up.**
`prisma migrate deploy` runs at **Backend container startup**, not
automatically on each bind-mounted code change. These observations
are point-in-time only and can change after another operator's actions.

Before a controlled Dev/Prod rollout: check a restorable PostgreSQL backup,
confirm the intended DB, review `prisma migrate status` in a trusted
environment, plan downtime, verify secrets/ports, and ensure the legacy
Admin login remains available. The runtime change itself is **not part
of the Phase 7 documentation task**.

## Modes — exact commands

The development filename is intentionally `dokcer-compose.dev.yaml`.
It is a **standalone file**, not an override.

| Environment | Start | Backend process | Frontend process |
| --- | --- | --- | --- |
| Development | `docker compose -f dokcer-compose.dev.yaml up -d` | `npm install → prisma:generate → db:deploy → dev` (Node watch) | `next dev` |
| Production | `docker compose up -d` | `db:deploy → start` (Node without watch) | Prebuilt `next build` → `next start` |

**Both startup paths automatically run `prisma migrate deploy`**, which
applies pending SQL migrations and may **adopt a preexisting ADMIN** into the
durable `AdminBootstrapState` record. Neither startup path runs
`admin:bootstrap` or `db:seed`; applying migrations is **not** the same
as creating an initial Admin account.

Production Backend Image includes only the operator CLI
`scripts/bootstrap-admin.mjs` from the scripts directory. It intentionally
excludes E2E fixtures and PostgreSQL QA scripts. Dev bind mounts backend
source and uses its own Node modules volume.

Before any real deployment or migration, inspect the intended database,
back it up and validate recovery. Current Compose DB credentials are kept
for compatibility with the existing persisted volume but are **not safe
for an internet-exposed production database**. Configure a strong unique
`JWT_SECRET` in root `.env`, and add HTTPS/review network access before
public exposure.

## First Admin — manual command only

For a verified new database with the required tables migrated:

**Development:**

```bash
docker compose -f dokcer-compose.dev.yaml exec backend npm run admin:bootstrap
```

**Production:**

```bash
docker compose exec backend npm run admin:bootstrap
```

Run **from an interactive terminal** (Docker Compose `exec` allocates TTY by
default). Do **not** use `exec -T`, pipe credentials, set bootstrap
password environment variables, or pass password arguments. The CLI
prompts for Name, Email, Password and Confirm Password; the secret is hidden.
A successful first run creates exactly one ADMIN, a durable singleton
bootstrap state, and a matching audit event in one transaction.

If the database already contains any ADMIN, the migration/CLI recognizes
and preserves that account and **will not** create another initial ADMIN.
A repeated CLI invocation returns
`ADMIN_BOOTSTRAP_ALREADY_COMPLETED`. Never delete
`AdminBootstrapState` to bypass the one-time rule. All further Admins are
created at `/admin/users` using **+ เพิ่ม Admin**, and only by a logged-in
active ADMIN. Public registration still creates only USER.

## Optional demo USER seeding — development only

```bash
docker compose -f dokcer-compose.dev.yaml exec backend npm run db:seed
```

The seed creates `user@ogtb.local` as USER only when absent; it does not
modify an existing account or manage ADMIN. Seed now **fails closed** when
`NODE_ENV=production` and is never part of `docker compose up`.

## Data and service continuity

- Both Compose files share the same `server-side_postgres_data` named
  volume (actual name is project-dependent; verify with `docker volume ls`).
  Neither mode should delete it.
- Production persists photos via `./backend/uploads:/app/uploads`;
  Development mounts `./backend:/app`, including uploads.
- Do **not** run the Dev and Prod Compose stacks simultaneously for the same
  project/database. To switch modes during an approved maintenance window,
  stop the old stack using the **matching** `docker compose [-f ...] down`
  command **without `-v`**, then start the chosen mode. This causes downtime;
  it was **not executed** during Phase 6.
- The default Production Backend and PostgreSQL host ports bind to
  `127.0.0.1`; the Development Backend is published through its host port.
  Review firewall and credentials before external deployment.
- After production source changes, use `docker compose up -d --build`
  in an approved rollout. A dry-run `docker compose config` does not start
  anything.

## Verified safely during Phase 6

1. `docker compose config` and
   `docker compose -f dokcer-compose.dev.yaml config` rendered as distinct
   complete stacks with the same project, db volume and required process
   modes. No auto-Admin/seed commands were present.
2. Standalone Production Backend and Frontend Docker Images built successfully
   without replacing the images used by current running containers.
3. Production Image checked for Prisma Client, schema, CLI, and exclusion of
   QA scripts/fixtures.
4. Real interactive Terminal input was tested inside both Production and
   Development-like Node runtime containers on a **new isolated Docker
   Network + tmpfs PostgreSQL**, no published ports or persistent volumes.
   First bootstrap succeeded; second bootstrap was rejected; DB contained
   exactly one ADMIN, one marker and one bootstrap audit per mode (**8/8**).
5. The disposable Docker Network and PostgreSQL container were removed
   automatically; current Production/Development containers were never
   restarted or accessed for mutation.

Detailed Docker QA evidence: [`admin-phase6-docker-qa.md`](./admin-phase6-docker-qa.md).

Dated live-system readiness and documentation handoff:
[`admin-phase7-docs-review.md`](./admin-phase7-docs-review.md).

The full CLI's first-run behavior was verified with the disposable Docker
runtime. This is **not** proof that the current live DB has been migrated,
that a live Admin has been created, or that a production deployment is complete.

Detailed CLI validation, failures and recovery:
[`admin-bootstrap.md`](./admin-bootstrap.md).
PostgreSQL, migration and Browser QA:
[`admin-phase5-isolated-qa.md`](./admin-phase5-isolated-qa.md).

## Dependency security patch readiness (Phase 7 follow-up)

Source package manifests and Lockfiles were patched to Prisma 7.10.1,
Next.js 16.4.6 and compatible fixes. Isolated QA, full Backend
Regression, and production Docker image builds passed; both production
dependency `npm audit --omit=dev` checks now report zero vulnerabilities.
**Running Dev containers still have separate node_modules volumes**,
so source changes alone have **not applied these patches to runtime**.
The active database still needs a backed-up migration. Final Review
and deployment are separate, approved actions. Details:
`docs/admin-phase7-security-remediation.md`.
