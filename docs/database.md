# Database

Database ใช้ PostgreSQL และ Prisma ORM โดย schema หลักอยู่ที่ `backend/prisma/schema.prisma`

## Relations

```text
User
 ├── Donation[]
 └── Report[]

Donation
 ├── owner -> User
 ├── DonationImage[]
 └── Report[]

Report
 ├── reporter -> User
 └── donation -> Donation
```

## User

ข้อมูลหลัก:

- `id`
- `name`
- `email` — unique
- `passwordHash`
- `role` — `USER` หรือ `ADMIN`
- `isActive` — ใช้ระงับ/เปิดบัญชี
- `createdAt`, `updatedAt`

`ADMIN` ใช้หน้า Map และ feature ปกติเหมือน `USER` แต่มีสิทธิ์เข้า Admin Dashboard เพิ่ม

### Current database readiness (2026-11-16, read-only snapshot)

The active Dev PostgreSQL database currently has **neither**
`AdminBootstrapState` nor `AdminAuditLog` (checked using
`to_regclass` without modifying data). Migration files exist in the
workspace and passed isolated tests; they have **not** been applied by
this task to the active database. Backend Dev mode hot reloads source
files, but `prisma migrate deploy` runs only at container startup.
New Admin functions require an approved, backed-up schema rollout.
See `docs/docker-admin-setup.md`.

## Admin Bootstrap / Audit (Phase 3 protected Admin creation API implemented)

Two additive models: `AdminBootstrapState` and `AdminAuditLog`.
No existing User, Donation or Report data is altered by these models.

### AdminBootstrapState
- `id` is a singleton integer **1** (SQL primary key and CHECK constraint).
- `source` is `CLI` or `LEGACY_ADMIN`.
- `initialAdminId` is the original Admin ID snapshot (no User FK, surviving deletion).
- `initializedAt` is the first initialization timestamp.

Migration `20261116040000_admin_bootstrap_audit_contracts` adds tables,
enums and indexes. If existing Users have `role=ADMIN`, including inactive
Admins, the oldest by `createdAt,id` is adopted and one singleton row is
inserted; passwords, role and active status are **not modified**. If no
Admin exists, the marker remains absent. A missing marker alone is NOT
sufficient to bootstrap: Phase 2 CLI must check existing Admin rows too.

### AdminAuditLog
- `actorUserId` and `targetUserId` are nullable ID snapshots with no User FK.
- `action`: `INITIAL_ADMIN_BOOTSTRAP`, `LEGACY_ADMIN_ADOPTION`,
  `ADMIN_CREATED`, `ADMIN_SUSPENDED`, `ADMIN_REACTIVATED`.
- `outcome`: `SUCCESS` or `DENIED`.
- `createdAt` and indexed actor/target IDs support auditing.
- Audit contains **no password or secret**. Phase 2/3 privileged changes
  and their success audit are written within the same transaction.

### Race safety and rollout
- The one-time CLI in Phase 2 serializes transactions (PostgreSQL advisory
  transaction lock), re-checks marker and any ADMIN before
  creating first Admin, and atomically inserts User + marker + audit.
- Removing or suspending an Admin must **never** clear the marker.
- Schema and migration exist in code, but Phase 1 and Phase 2 did **not** run
  SQL migrations against an active/unknown database. Isolated DB validation is
  mandatory before deployment.
- Phase 2 CLI and Phase 3 protected Admin creation API are implemented;
  the Phase 4 Dashboard Add Admin UI is now implemented (see
  `docs/project-flow.md`). Database-backed E2E verification passed on a
  disposable PostgreSQL DB in Phase 5 (see `docs/admin-phase5-isolated-qa.md`).
- `db:seed` is now **USER-only** and will not create, promote, suspend,
  reactivate or update any existing ADMIN/USER. First ADMIN uses CLI only.

### Phase 5 migration verification

Fresh migrations and legacy adoption were confirmed on disposable PostgreSQL,
preserving existing roles, hashes and account states. Admin locking uses
`pg_advisory_xact_lock(...)::text` for Prisma compatibility. See
`docs/admin-phase5-isolated-qa.md`. Production migration not applied.

## Donation

ข้อมูลหลัก:

- `ownerId`
- `title`
- `description`
- `category`
- `quantity`
- `latitude`, `longitude`
- `address`
- `startDate`, `endDate`
- `status`
- `isHidden` — moderation state สำหรับ Admin
- `createdAt`, `updatedAt`

ค่า `startDate` / `endDate` ที่รับจากฟอร์มแบบ `YYYY-MM-DD` ใช้ขอบเขตวันของ `Asia/Bangkok` แล้วเก็บเป็น UTC: วันเริ่ม = 00:00:00 เวลาไทย และวันสิ้นสุด = 23:59:59.999 เวลาไทย

### Donation Status

- `AVAILABLE` — ของยังมีอยู่
- `OUT_OF_STOCK` — เจ้าของระบุว่าของหมดแล้ว
- `EXPIRED` — เลย `endDate`

โพสต์ที่แสดงบน Map ต้องผ่านทุกเงื่อนไข:

```text
status = AVAILABLE
isHidden = false
startDate <= now <= endDate
อยู่ภายในรัศมีที่ค้นหา
```

`isHidden` แยกจาก `status` เพื่อไม่ปะปนสถานะของบริจาคกับสถานะ moderation

## DonationImage

ข้อมูลหลัก:

- `donationId`
- `imageUrl`
- `createdAt`

ไฟล์จริงเก็บใน `backend/uploads/donations/` และ Database เก็บ URL ใน `DonationImage.imageUrl`

เมื่อลบรูปจะลบทั้ง record และไฟล์จริง เมื่อ Donation ถูกลบ relation จะลบ DonationImage/Report ที่เกี่ยวข้อง และ backend ลบไฟล์รูปออกจาก filesystem ด้วย

## Report

ข้อมูลหลัก:

- `reporterId`
- `donationId`
- `reason`
- `description`
- `status`
- `createdAt`, `updatedAt`

### Report Reason

- `ILLEGAL_ITEM`
- `DANGEROUS_ITEM`
- `FRAUD`
- `INAPPROPRIATE_CONTENT`
- `OTHER`

### Report Status

- `PENDING`
- `RESOLVED`

## Migration / Seed

Migration อยู่ที่ `backend/prisma/migrations/` โดยทั้งสอง Docker Compose
configurations เรียก `npm run db:deploy` (`prisma migrate deploy`) ตอน Backend
เริ่มทำงาน จึงต้อง Backup และตรวจฐานข้อมูลเป้าหมาย **ก่อน** `docker compose up -d`
ทุกครั้งที่มี Migration ใหม่ อย่าชี้คำสั่งทดสอบหรือ Seed ไปที่ Database ที่ใช้งานจริง

สำหรับการพัฒนาแบบไม่ใช้ Docker และ **เฉพาะฐานข้อมูลทดสอบที่ตรวจสอบแล้ว**:

```bash
cd backend
npm run prisma:generate
npm run db:migrate
# optional: สร้างเฉพาะ demo USER หากยังไม่มีบัญชีนั้น
npm run db:seed
```

`db:seed` ไม่สร้างหรือแก้ไข ADMIN ไม่เปลี่ยนบัญชี USER เดิม และปฏิเสธการทำงาน
เมื่อ `NODE_ENV=production`. การสร้าง ADMIN คนแรกต้องใช้
`npm run admin:bootstrap` ผ่าน Interactive TTY **โดยตั้งใจสั่งเองเพียงครั้งเดียว**
หรือใช้คำสั่ง Docker `exec` ที่ระบุใน `docs/docker-admin-setup.md`.
ผู้ดูแลคนต่อไปสร้างผ่าน `/admin/users` เท่านั้น


### Phase 2 CLI bootstrap transaction

`backend/src/services/admin-bootstrap.service.js` uses the same reserved
PostgreSQL transaction-level advisory key for preflight and creation.
The first ADMIN User, `AdminBootstrapState` marker and
`AdminAuditLog(INITIAL_ADMIN_BOOTSTRAP/SUCCESS)` are in a **single Prisma
transaction**, after obtaining the lock and re-reading marker and all
ADMIN users (including inactive). Existing legacy ADMIN with missing marker
is adopted atomically instead of creating a second Admin. Failed audit or
marker write rolls back all related writes.

CLI source: `backend/scripts/bootstrap-admin.mjs`. Password validation
matches registration length (8–72 characters) with an additional 72-byte
bcrypt UTF-8 bound; passwords use bcrypt cost 12. Admin creation is NOT
run on startup or by `db:seed`.

**Note:** The current running database was **not migrated or modified** as
part of Phase 2. Only in-memory transaction simulations were run; PostgreSQL
integration/race tests passed on a disposable DB in Phase 5, and the
interactive Docker CLI was verified with a separate disposable PostgreSQL
in Phase 6. See `docs/docker-admin-setup.md`.


### Phase 3 privileged Admin creation and status changes

`backend/src/services/admin-account.service.js` exposes the guarded
`createAdditionalAdmin` service. Only an active existing ADMIN can call
`POST /api/admin/users/admins` (with `requireAuth` and `requireAdmin`).
Inside the shared `ADMIN_PRIVILEGE_LOCK_KEY` transaction the service:

1. Rechecks actor Role=ADMIN and `isActive=true`, and requires singleton
   `AdminBootstrapState(id=1)`; **no first Admin may be created via API**.
2. Rejects duplicate email (unique index remains authoritative), hashes
   password using bcrypt cost 12, creates the additional ADMIN with
   `isActive=true`, and inserts an `ADMIN_CREATED/SUCCESS` audit.
3. Commits User and Audit atomically, returning only
   `id/name/email/role/isActive/createdAt/updatedAt/_count` (no hash).

`backend/src/services/admin.service.js` also uses the same transaction
lock for `PATCH /api/admin/users/:id/status`. ADMIN status changes create
`ADMIN_SUSPENDED/SUCCESS` or `ADMIN_REACTIVATED/SUCCESS` audits.
Attempted self-suspension or last-active-Admin suspension is rejected and
recorded as `ADMIN_SUSPENDED/DENIED`. Successful USER status changes
retain existing behavior. No-op status calls do not write change audits.
Concurrent ADMIN creation/suspension is serialized by the transaction
advisory lock; out-of-band SQL actions must not bypass this contract.

**Verification (Phases 5–6):** Transaction, concurrency, rollback,
legacy migration, authenticated HTTP API และ Browser→API→PostgreSQL ผ่านบน
ฐานข้อมูลชั่วคราวที่แยกจากระบบจริง; Docker Interactive TTY ทั้งสองโหมด
ผ่าน 8/8 เช่นกัน ไม่มีการรัน Migration หรือ Bootstrap กับฐานข้อมูลปัจจุบัน
ดู `docs/admin-phase5-isolated-qa.md` และ `docs/admin-phase6-docker-qa.md`.
