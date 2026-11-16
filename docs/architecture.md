# Architecture

โปรเจกต์แยก Frontend และ Backend ชัดเจน โดยยึดโครงสร้างที่กำหนดไว้ตั้งแต่ต้น

```text
frontend/                 Next.js
backend/                  Express.js
  src/
    routes/
    controllers/
    services/
    middleware/
    validators/
    utils/
    config/
  prisma/
  tests/
docs/
```

## Backend Request Flow

```text
Request
  ↓
Route
  ↓
Middleware
  ↓
Validator
  ↓
Controller
  ↓
Service
  ↓
Prisma
  ↓
PostgreSQL
```

Controller รับ/ส่ง HTTP response ส่วน business logic หลักอยู่ใน Service และ Database access ผ่าน Prisma

## Frontend Routes

- `/` — Map + Nearby Search
- `/login`, `/register` — Authentication
- `/donations/new` — สร้าง Donation
- `/donations/[id]` — Donation Detail + owner actions
- `/donations/[id]/edit` — แก้ไข Donation / รูป
- `/donations/[id]/navigate` — Navigation
- `/donations/[id]/report` — Report
- `/admin` — Dashboard
- `/admin/users` — User management
- `/admin/donations` — Donation moderation
- `/admin/donations/[id]` — Admin Donation Detail + related reports/actions
- `/admin/reports` และ `/admin/reports/[id]` — Report review

## Map / Routing

Frontend ใช้ React Leaflet + OpenStreetMap สำหรับแผนที่

Nearby Search คำนวณรัศมีจาก Location ปัจจุบัน โดย Backend ใช้ bounding box เพื่อลดชุดข้อมูลเบื้องต้น แล้วคำนวณระยะจริงด้วย Haversine ก่อนตอบกลับ

Navigation เรียก Routing Provider จาก Backend ผ่าน `ROUTING_BASE_URL` และส่งกลับ route geometry, distance และ duration โดยไม่เก็บ route ลง Database

## Image Storage

รูป Donation เก็บ local ที่ `backend/uploads/donations/` และเก็บ URL ใน PostgreSQL ผ่าน `DonationImage`

สำหรับ scope ของวิชา Server-Side วิธีนี้เพียงพอ แต่หาก deploy แบบหลาย instance จะต้องเปลี่ยนไปใช้ shared/object storage ซึ่งไม่อยู่ใน scope ปัจจุบัน

## Docker / Environment

Docker Compose อ่าน root `.env` สำหรับ `FRONTEND_PORT`, `BACKEND_PORT`,
`FRONTEND_URL`, `NEXT_PUBLIC_API_URL`, `JWT_SECRET` และ
`ROUTING_BASE_URL`; เฉพาะ Dev ยังรองรับ `SEED_USER_PASSWORD`.
Dev/Prod กำหนด `NODE_ENV` ใน Compose โดยตรง ไม่ใช้ค่าจาก root `.env`.
`SEED_ADMIN_PASSWORD` ไม่รองรับอีกต่อไป. Default ports: Frontend
`3000` / Backend `4000`.
ค่าแนะนำคือปล่อย `NEXT_PUBLIC_API_URL` ว่าง เพื่อให้ browser เรียก `/api/*` และ `/uploads/*` แบบ same-origin ผ่าน Next.js rewrite จากนั้น Frontend container จะ proxy ไปยัง `http://backend:${BACKEND_PORT:-4000}` ภายใน Compose network จึงใช้ port เดียวกับ Backend service เสมอ วิธีนี้ทำให้ session cookie ทำงานกับ HTTPS tunnel โดยไม่ต้องพึ่ง cross-origin cookie
ถ้าเปลี่ยน Frontend host port ให้เปลี่ยน `FRONTEND_URL` ให้เป็น origin เดียวกัน ส่วน `DATABASE_URL` สำหรับ Docker ถูกกำหนดเป็น PostgreSQL service `db` ภายใน Compose network; ค่า `DATABASE_URL` แบบ `localhost` ใน `.env.example` ใช้ตอนรัน Backend บน host โดยตรง
Development (`docker compose -f dokcer-compose.dev.yaml up -d`) ใช้
Source Bind Mount + Named Volumes สำหรับ Backend/Frontend node_modules
และ Frontend .next เพื่อรองรับ Hot Reload. Production
(`docker compose up -d`) ใช้ Image ที่ Build แล้ว ไม่ Mount Source Code
ยกเว้น `./backend/uploads:/app/uploads`. ทั้งสองใช้ `postgres_data`
ร่วมกัน ห้ามรันพร้อมกันหรือสั่ง `down -v` โดยไม่ตั้งใจ. Backend
ทั้งสองโหมดเรียก `prisma migrate deploy` เมื่อเริ่ม แต่ไม่สร้าง
Admin หรือ Seed อัตโนมัติ. ดู `docs/docker-admin-setup.md`.
## Authentication / Authorization

- JWT เก็บใน `httpOnly` cookie ชื่อ `ogtb_session`
- JWT มี issuer, audience และวันหมดอายุ
- Protected endpoint อ่าน User จาก Database ทุกครั้ง
- User ที่ `isActive = false` ใช้ session เดิมต่อไม่ได้
- Ownership ของ Donation/Image ตรวจที่ Backend
- `/api/admin/*` ตรวจทั้ง Authentication และ `ADMIN` role
- Admin ไม่สามารถระงับบัญชีตัวเอง

### Running environment — 2026-11-16 snapshot

Active backend/frontend containers are **Dev**, with source bind mounts;
backend uses `node --watch`. Source changes can therefore be loaded
automatically even when containers are not explicitly restarted.
The active database lacks both new Admin tables (read-only
`to_regclass` query). Dev hot reload does **not** apply migration SQL;
`prisma migrate deploy` runs at Backend container startup.
The Admin flow is implemented and independently tested, but not
operationally ready against the active DB without a backed-up migration.
See `docs/docker-admin-setup.md`.

## Admin Bootstrap Architecture (Phase 3 protected Admin API implemented)

**Target flow:** the first ADMIN is created once by an explicitly invoked
server CLI in Phase 2. Every later ADMIN is created only through the
authenticated ADMIN Dashboard (Phase 4) and a protected API (Phase 3). Public
registration stays `USER`; no `SUPER_ADMIN` role or public bootstrap route.

**Implemented in Phase 1–3:**
- `AdminBootstrapState` singleton `id=1` persists the initialization
  state even if the original Admin account is deleted/disabled.
- Additive SQL migration adopts pre-existing `ADMIN` users, including
  inactive accounts, without changing credentials/status/role.
- `AdminAuditLog` holds actor/target ID snapshots and privilege-event
  outcomes, with no cascading FK and no credentials.
- This migration is in source control only, **not yet run on live DB**.

**Phase 2/3 concurrency and privileges implemented:**
1. The CLI takes a DB-level exclusive transaction lock; while locked it
   rechecks both singleton state and ANY existing ADMIN, not only active ones.
2. The first ADMIN User, singleton and SUCCESS audit commit atomically.
   Concurrent first-admin attempts must fail closed.
3. `POST /api/admin/users/admins` enforces both `requireAuth`
   and `requireAdmin`; client cannot set arbitrary role.
4. Last-active-Admin and self-suspension protection is enforced inside
   the serialized transaction, including concurrent requests.
5. Audit creation + role/state mutation commits atomically; secrets never
   enter audit rows, logs or response DTOs.
6. Phase 2 `db:seed` is USER-only, with create-if-missing behavior;
   existing USER and ADMIN accounts are never modified.
7. CLI was implemented in Phase 2; protected additional-Admin API
   is implemented in Phase 3; Dashboard creation UI is implemented in Phase 4.
Do not apply the migration or run mutating tests on unknown/production DB;
first verify and use an isolated disposable test database.

### First Admin command and safety

CLI: `backend/scripts/bootstrap-admin.mjs`, invoked via
`npm run admin:bootstrap` only from an interactive TTY.
Its preflight checks the singleton and existing ADMINs under the shared
`ADMIN_PRIVILEGE_LOCK_KEY`, adopting a legacy Admin when appropriate.
Creation **rechecks after the prompt** under the same DB lock, hashes the
password with bcrypt (12 rounds), and writes User + marker + audit in the
same transaction. Rollback protects against partial bootstrap. The CLI
does not accept passwords from command-line arguments or stdin pipes, and
the terminal runs in no-echo raw input mode for secrets. The Admin API and last-active-Admin guard are implemented in Phase 3.

Operator instructions and exact Docker commands:
`docs/admin-bootstrap.md`. Unit mocks/test cases have passed; live
transaction testing was completed in Phase 5 on an isolated DB; Docker
TTY entry was verified in Phase 6. No live bootstrap or migration was
executed during either QA phase.

### Additional ADMIN API — Phase 3

- `POST /api/admin/users/admins`: the existing `adminRouter` requires
  `requireAuth` + `requireAdmin`; the controller invokes
  `validateAdditionalAdmin` and `createAdditionalAdmin`.
  Only name/email/password are accepted, with the same password rules as
  initial CLI (bcrypt 12 and 72 UTF-8 byte cap). The backend chooses
  `role=ADMIN` and `isActive=true`, never accepting client role/status.
- The creator is checked a second time *inside* a PostgreSQL
  transaction-level advisory lock; `AdminBootstrapState` must exist,
  ensuring the API cannot be used to create the first Admin.
- User creation and `AdminAuditLog(ADMIN_CREATED/SUCCESS)` commit or roll
  back together; API response uses an explicit safe selection (no hash).
  Duplicate email and schema/validation conflicts fail closed.
- `setUserActive` now takes the **same** lock and re-verifies the actor.
  ADMIN suspension/reactivation and its success audit are atomic.
  A last-active-Admin or self-suspension denial is audited as
  `ADMIN_SUSPENDED/DENIED` then returned as 409 or 400. This intentional
  return-after-commit keeps the denial event while preserving Admin status.
  No-op requests do not generate status-change audit entries.
- Existing USER suspension endpoint behavior remains, with userStatus DTO
  unchanged. Out-of-band SQL role/status changes are outside the lock:
  production policies should prohibit unreviewed privilege modification.
- **Phase 4 implemented:** `/admin/users` exposes the Add Admin
  button only after AuthProvider confirms an ADMIN session. The responsive
  dialog uses `validateAdminForm` and has Name/Email/Password/confirmation,
  error handling, a separate non-secret confirmation step, and disables
  duplicate submissions. After success, it clears secrets and refreshes
  GET `/api/admin/users`, keeping the created row if refresh fails.
  Non-ADMIN users are redirected and have no Add Admin action; Backend
  authorization remains the security boundary.
- **Phase 5 completed:** Real PostgreSQL migration, race/rollback, and
  Browser→isolated API→database integration passed on a disposable DB.
  **Phase 6 completed:** first-Admin interactive Docker TTY setup passed in
  both production and development-like runtimes (8/8) on isolated PostgreSQL.
  Existing Compose services were not restarted or migrated. See
  `docs/docker-admin-setup.md` and `docs/admin-phase5-isolated-qa.md`.
  No live migration, bootstrap or mutation was executed for Phase 3.

### Phase 5 real PostgreSQL QA

The shared advisory-lock query now selects `::text` to avoid Prisma's
inability to deserialize PostgreSQL `void`. Real parallel bootstrap/API
operations, rollback and Browser→API→DB were tested on a disposable database;
no live data was changed. See `docs/admin-phase5-isolated-qa.md`.

## Validation & Security

- `httpOnly`, `SameSite=Lax` cookie และ `Secure` เมื่อ production
- Production บังคับ `JWT_SECRET` อย่างน้อย 32 ตัวอักษร
- CORS อนุญาตตาม `FRONTEND_URL`
- Helmet security headers และปิด `X-Powered-By`
- Global API rate limit + limit เฉพาะ Auth และ Report
- JSON body สูงสุด 1 MB
- malformed JSON → `400 INVALID_JSON`
- payload ใหญ่เกิน → `413 PAYLOAD_TOO_LARGE`
- rate limit เกิน → `429 TOO_MANY_REQUESTS`
- Donation validation ครอบคลุมข้อความ จำนวน พิกัด ช่วงวันที่ และวันที่ปฏิทินจริง
- Upload จำกัด JPG/PNG/WEBP, ไม่เกิน 5 MB/รูป, สูงสุด 5 รูปต่อ request และสูงสุด 5 รูปรวมต่อ Donation พร้อมตรวจ file signature
- Unexpected error ไม่ส่ง stack trace กลับ client

## Testing

Backend ใช้ Node.js built-in test runner และรันแบบ `--test-concurrency=1` เพื่อไม่ให้ integration tests ที่ใช้ Database เดียวกันชนกัน

```bash
cd backend
npm test
npm run test:coverage
```

Coverage gate:

- Lines ≥ 80%
- Functions ≥ 80%
- Branches ≥ 60%

**ข้อควรระวัง:** `npm test` และ `npm run test:coverage` มี
Integration Tests ที่สร้าง/แก้/ลบข้อมูลใน Database ตาม `DATABASE_URL`
และอาจจัดการรูปภาพใน Working Directory. ห้ามสั่งกับ Database
ที่กำลังให้บริการ ต้องตรวจฐานข้อมูลชั่วคราวที่แยกออกจริงก่อนรัน
และแยก Uploads/Working Directory. หากไม่สามารถยืนยันสภาพแวดล้อมได้
ให้รันเฉพาะ Unit/Mock Tests และรายงาน Integration เป็น BLOCKED.

Snapshot ผลทดสอบ: Phase 5 Backend 107/107 บนฐานข้อมูลชั่วคราว;
Phase 6 Safe Backend 43/43. ตัวเลขนี้ไม่ใช่จำนวน Tests ตายตัว
ให้ดู `docs/admin-phase5-isolated-qa.md` และ
`docs/admin-phase6-docker-qa.md` ประกอบ.

System-flow test ครอบคลุม `Register → Donation → Nearby Search → Report → Admin Review → Hide Donation → Suspend User`

Frontend ใช้ ESLint flat config + `eslint-config-next`, รัน
`npm run lint` ด้วย `--max-warnings=0` แล้วตรวจ `npm run build`.
ก่อน Deploy ให้รัน `npm audit` ใหม่ทั้งสองแพ็กเกจ; ผล Audit เก่า
ไม่ใช่หลักฐานความปลอดภัยปัจจุบัน.

## Dependency Audit Note

Dependency security advisories เปลี่ยนแปลงตามเวลา.
บันทึกเก่าที่ระบุจำนวน/ระดับความรุนแรงไม่ได้ยืนยันความเสี่ยงล่าสุด.
ก่อน Deploy ต้องรัน `npm audit` บน Lockfiles ปัจจุบันทั้ง Backend
และ Frontend แล้วทบทวนผล. ไม่ใช้ `npm audit fix --force` อัตโนมัติ
หากอาจทำให้ Prisma Major Version เปลี่ยนหรือกระทบ Database Contracts
โดยไม่มี Regression Tests รองรับ.

## Final Scope Review

ตรวจ implementation เทียบ `server-side-project-system.md` แล้ว:

- Authentication ✅
- Map ✅
- Donation + Status ✅
- Search / Filter ✅
- Navigation ✅
- Report ✅
- Admin Dashboard ✅
- USER / ADMIN role ✅
- ไม่มี Claim / Reservation / Chat / Pickup Confirmation ✅

ไฟล์ `backend/src/routes/user.routes.js` และ `backend/src/controllers/user.controller.js` ถูกคงไว้ตามโครงสร้างโปรเจกต์ที่กำหนด แต่ไม่ได้ mount endpoint เพิ่ม เพราะ source of truth ใช้ `/api/auth/me` สำหรับข้อมูลผู้ใช้ปัจจุบันและไม่ได้กำหนด User/Profile module แยก

### Reopened Phase 7 dependency remediation

Compatible patches (Prisma 7.10.1, Multer 2.5.0, proxy-addr 2.0.8,
Next.js 16.4.6 and transitives) resolved the previous Critical/High
production Lockfile advisories. Backend full `npm audit` and both
Production `npm audit --omit=dev` trees report **0 vulnerabilities**.
Frontend full audit retains **7 Moderate dev-only ESLint/TypeScript
toolchain findings**; these are not in the production tree. Avoid
unreviewed Major overrides. Current Dev containers have separate
node_modules volumes and have **not** received the patches; a
separately approved deploy/migration is still required.
See `docs/admin-phase7-security-remediation.md`.
