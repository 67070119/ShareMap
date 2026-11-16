# First Admin Setup — CLI-Only Bootstrap (OGTB Donation Map)

**Status:** Phase 6 Docker integration verified using disposable
PostgreSQL, Production Image and Development-like Node runtime (**8/8 real
Docker TTY checks passed**). Phase 3 added the protected API, Phase 4
the Dashboard UI, and Phase 5 verified actual PostgreSQL/Browser flows.
**No live database migration or bootstrap was executed in this work.**

## Rules

- Only a trusted server operator, using a real interactive terminal, may create
  the **first** ADMIN. There is no public bootstrap API or web setup page.
- The CLI is **one-time per database**. Its persistent `AdminBootstrapState`
  marker survives disabling or deleting the first ADMIN.
- All subsequent Admin accounts will be created by an authenticated ADMIN from
  `/admin/users` via the Phase 4 Add Admin form; do **not** work around
  the lock by deleting the marker or promoting users via SQL.
- Public `/register` always registers USER.
- Bootstrap requires Name (2–80 characters), email (valid, ≤254 characters),
  and password (8–72 characters, at most 72 UTF-8 bytes). Password confirmation
  must match. Inputs are prompted without putting credentials in process args,
  environment variables, logs, shell history, or response DTOs.
- SQL migration automatically marks legacy ADMINs (including suspended ADMINs)
  as `LEGACY_ADMIN` and records the adoption; no password/status/role changes.
  If the marker is missing but an ADMIN exists, the CLI safely adopts the
  existing ADMIN and refuses to create a second one.

**Deployment readiness snapshot (2026-11-16):** the currently running
Dev database did not yet contain the `AdminBootstrapState` and
`AdminAuditLog` tables in a read-only check. The current Dev Backend
uses `node --watch` with source bind mounts, so code can hot reload
without Prisma migrations running. Complete an approved backed-up
migration **before** attempting this CLI on the active database.
No live migration or bootstrap was performed by the docs audit.
See `docs/docker-admin-setup.md`.

## Prerequisite — migration and backup

Before any migration or bootstrap:

1. Verify you are connected to the **correct intended database**. Back up the
   PostgreSQL volume and document a tested recovery plan.
2. Apply `backend/prisma/migrations/20261116040000_admin_bootstrap_audit_contracts`
   first **in a disposable test database** and confirm compatibility with
   existing User/Donation/Report data; only then approve applying it in your
   real environment. **Do not run it on the current unknown/live DB as part
   of the implementation task.**
3. `prisma generate` must have been run for the added models. The production
   Docker image generates Prisma Client during its build; Dev Compose generates
   it during container startup.
4. Use a TTY with an authorized OS account. Never pipe passwords or pass
   `--password`/name/email arguments. Do not share the setup terminal.

Both normal Docker `up` modes **automatically execute `prisma migrate deploy`**.
Migrations can adopt an existing ADMIN into the permanent bootstrap marker
without modifying the account. Neither mode automatically creates an initial
ADMIN or runs `db:seed`; only an explicit interactive CLI invocation creates
the initial Admin. Back up the intended DB **before starting the new stack**
because migrations are executed during startup.

For Docker mode switching and operational safety, see
[`docker-admin-setup.md`](./docker-admin-setup.md). The production image
ships **only** the operator bootstrap CLI; QA/fixture scripts are excluded.

## Commands — choose one environment

**Development** (Compose filename intentionally spelled `dokcer`):

```bash
docker compose -f dokcer-compose.dev.yaml up -d
docker compose -f dokcer-compose.dev.yaml exec backend npm run admin:bootstrap
```

**Production:**

```bash
docker compose up -d
docker compose exec backend npm run admin:bootstrap
```

**Host (Node.js direct, with a configured backend DATABASE_URL):**

```bash
cd backend
npm run prisma:generate
npm run admin:bootstrap
```

The CLI asks for Name, Email, Password (hidden) and Confirm Password (hidden).
Successful output is `FIRST_ADMIN_CREATED`, with no password in stdout.
You can then log into `/login` with that email/password.

## Existing seeded Admin

If a database already contains `admin@ogtb.local` or another account with
`role=ADMIN`, the migration adopts an ADMIN and locks first-time setup.
When invoked again, the CLI displays:

```text
ADMIN_BOOTSTRAP_ALREADY_COMPLETED: Create further Admins via Dashboard.
```

If the migration's marker was absent, the CLI records existing legacy Admin
state and returns:

```text
LEGACY_ADMIN_ADOPTED: An Admin already existed. CLI is now permanently locked.
```

**Neither message indicates failure of your existing Admin account.** Log in
with its established credentials. Use the Phase 4 Dashboard Add Admin form for further Admins;
the protected Backend Admin-create API was implemented in Phase 3. Do not remove the marker or reset seed to force a second first-Admin.

## Errors and recovery

| Code | Meaning / action |
| --- | --- |
| `INTERACTIVE_TERMINAL_REQUIRED` | Use a direct terminal / Docker `exec -it`; no pipe |
| `CLI_ARGUMENTS_DISABLED` | Remove credentials from command line arguments |
| `INVALID_NAME`, `INVALID_EMAIL`, `INVALID_PASSWORD` | Check the stated length/format rules |
| `PASSWORD_MISMATCH` | Retry with matching secret and confirmation |
| `EMAIL_ALREADY_EXISTS` | Choose an unused email; existing USER is never promoted |
| `ADMIN_BOOTSTRAP_ALREADY_COMPLETED` | Initial Admin already exists or was set up; use Dashboard later |
| `LEGACY_ADMIN_ADOPTED` | Previously created Admin recognized safely; use existing login |
| `ADMIN_SCHEMA_NOT_READY` | Migration is missing; verify target DB and migration safely |
| `ADMIN_BOOTSTRAP_FAILED` | Verify DB connectivity/migration with admin assistance; no secrets logged |

The bootstrap audit event has `actorUserId = null` because a server CLI
operator is not an authenticated application User. `targetUserId` identifies the
new Admin. Later Dashboard actions will record their authenticated actor ID.

Transaction design: same PostgreSQL **transaction-level advisory lock**
(`ADMIN_PRIVILEGE_LOCK_KEY`) is used in both CLI status preflight and
creation. The script rechecks marker + all ADMIN role holders *after* taking
the lock, then writes ADMIN User, singleton marker and success audit within
one Prisma transaction. If any write fails, the whole transaction rolls
back. The protected additional-Admin API and Admin status service implemented in
Phase 3 now use this same lock to serialize privileged mutations.

## Seed behavior (now USER-only)

`npm run db:seed` **never creates, upgrades, enables, or changes** an
ADMIN. It only creates `user@ogtb.local` as Role USER if that email does
not already exist; it leaves any existing account with that email unchanged,
regardless of its role/status/password. `SEED_USER_PASSWORD` is optional.
`SEED_ADMIN_PASSWORD` is obsolete, ignored by seed, and should be removed
from local config.

**Phase 5:** Real PostgreSQL concurrency and audit rollback, legacy migration,
USER-only seed, and Dashboard→API→DB passed in an isolated disposable stack.
The Prisma advisory-lock return type bug was fixed. Interactive Docker TTY
input was verified in Phase 6 (8/8 Dev/Prod isolated checks), but live
deployment is not verified. See `docs/admin-phase5-isolated-qa.md` and
`docs/docker-admin-setup.md`.

## Security and verification

- Bootstrap is not part of `docker compose up`, migration deployment or
  demo seeding.
- CLI creation and audit are a single transaction; no plaintext password
  is persisted, output or included in args.
- Unit and mocked transaction tests cover lock/order, duplicates, legacy
  adoption, concurrent calls, rollback and CLI non-TTY rejection.
- **Phase 5:** actual concurrent PostgreSQL/Prisma service integration
  and legacy migrations passed on a disposable DB. **Phase 6:** complete
  real TTY first-Admin creation, retry refusal and Admin/Audit/State counts
  passed for both Docker runtimes (8/8); this was isolated from live services.
  See `docs/docker-admin-setup.md` and `docs/admin-phase6-docker-qa.md`
  for reproducible test commands and evidence.
- Last-active-Admin and self-suspension protection is implemented in Phase 3;
  the Dashboard Add Admin interface is implemented in Phase 4.
  Browser QA completed both Mock API and isolated real API→PostgreSQL
  integration; production rollout and real-environment credentials/HTTPS
  remain separate operational requirements.
