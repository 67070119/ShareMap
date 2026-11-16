# OGTB Donation Map

Project วิชา Server-Side สำหรับลงจุดบริจาคบนแผนที่ ค้นหาจุดใกล้ตัว ดูรายละเอียด และนำทางไปยังจุดบริจาค โดยมี `USER` และ `ADMIN`

## Source of truth

Scope ระบบทั้งหมดต้องยึดตาม [`server-side-project-system.md`](./server-side-project-system.md) เท่านั้น ไม่เพิ่ม Claim, Reservation, Chat หรือขั้นตอนยืนยันการรับของนอกเหนือจาก spec

## Tech Stack

- Frontend: Next.js 16, React 19, React Leaflet, OpenStreetMap
- Backend: Node.js, Express.js 5
- Database: PostgreSQL + Prisma ORM
- Authentication: JWT ใน `httpOnly` cookie
- Routing: OSRM ผ่าน `ROUTING_BASE_URL`
- Image storage: local filesystem ที่ `backend/uploads/donations/`

## Project Structure

```text
server-side/
├── frontend/                 # Next.js
│   └── src/
│       ├── app/
│       ├── components/
│       └── lib/
├── backend/                  # Express.js
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── validators/
│   │   ├── utils/
│   │   └── config/
│   ├── prisma/
│   └── tests/
├── docs/
├── docker-compose.yml
├── .env.example
└── server-side-project-system.md
```

Backend flow หลักคือ `Request → Route → Middleware → Validator → Controller → Service → Prisma → PostgreSQL`

## Environment

สร้างไฟล์ `.env` ที่ root สำหรับ Docker Compose และคัดลอกไป `backend/.env` หากรัน Backend โดยตรง

```bash
cp .env.example .env
cp .env.example backend/.env
```

ค่าที่ Docker Compose อ่านจาก root `.env`:

- `FRONTEND_PORT` — host port ของ Frontend (ค่าเริ่มต้น `3000`)
- `BACKEND_PORT` — port ที่ Backend listen และ host publish (ค่าเริ่มต้น `4000`)
- `FRONTEND_URL` — origin ที่ Backend อนุญาตผ่าน CORS สำหรับกรณีเรียก Backend โดยตรง
- `NEXT_PUBLIC_API_URL` — optional; ปล่อยว่างเพื่อให้ browser เรียก `/api` และ `/uploads` ผ่าน Frontend แบบ same-origin ซึ่งเป็นค่าแนะนำ
- `JWT_SECRET`, `NODE_ENV`, `ROUTING_BASE_URL`, `SEED_USER_PASSWORD`

Docker Compose จะให้ Next.js proxy `/api/*` และ `/uploads/*` ไป Backend service ภายในที่ port เดียวกับ `BACKEND_PORT` (ค่าเริ่มต้น `http://backend:4000`) ดังนั้นการทดสอบผ่าน HTTPS tunnel ใช้ URL Frontend เพียงตัวเดียวและ session cookie ไม่ต้องข้าม origin ถ้าจำเป็นต้องเรียก Backend URL โดยตรงค่อยกำหนด `NEXT_PUBLIC_API_URL` เอง

ถ้าเปลี่ยน Frontend port ให้ปรับ `FRONTEND_URL` ให้สัมพันธ์กัน เช่น `FRONTEND_PORT=3100` → `FRONTEND_URL=http://localhost:3100`
`DATABASE_URL` ใน `.env.example` ใช้สำหรับการรัน Backend โดยตรงบน host ส่วน Docker Compose ใช้ PostgreSQL service ชื่อ `db` ภายใน network ของ Compose จึงไม่ใช้ค่า `localhost` จาก root `.env`

ควรกำหนด `JWT_SECRET` แบบสุ่มที่ปลอดภัย และ `SEED_USER_PASSWORD` เฉพาะกรณีใช้ Demo USER (ไม่มี Admin Seed อีกต่อไป) โดย production จะบังคับให้ `JWT_SECRET` มีความยาวอย่างน้อย 32 ตัวอักษร

## Current deployment caveat (read-only check, 2026-11-16)

**Important:** The currently running backend/frontend containers are Dev
runtimes with source bind mounts. Backend runs `node --watch`, so code edits
may be picked up without any manual Docker restart. This does **not** mean
the new database migration has been applied.

A read-only check of the active database found **no**
`AdminBootstrapState` or `AdminAuditLog` tables. Admin bootstrap,
Admin creation and Admin state-change APIs require these tables.
**Do not attempt to use the new Admin management flow in the running
environment before an approved, backed-up migration/rollout.**
No live migration/restart was performed in this documentation phase.
This observation is a dated snapshot, not a continuous health check.

See `docs/docker-admin-setup.md` for backup, migration-on-startup,
legacy Admin adoption, Dev/Prod switching and manual CLI setup.

## Run with Docker Compose

Docker Compose has **two separate, standalone configurations**. They use the same project name
and `postgres_data` volume, so **do not start both configurations simultaneously**.
Switch modes by stopping the current containers first, **without using `-v`**.

### Development — hot reload

```bash
docker compose -f dokcer-compose.dev.yaml up -d
```

This explicitly uses `dokcer-compose.dev.yaml` (the filename is intentionally spelled
exactly as shown in the command), running `next dev` and `node --watch` with bind mounts.

### Production — default

```bash
docker compose up -d
```

This uses the default `docker-compose.yml` and **builds the production images**
automatically on first run. The production Backend image contains only the
operator-triggered `bootstrap-admin.mjs` from `backend/scripts`, not QA or
E2E fixture scripts. Frontend runs `next build` during image construction and
`next start` in the container; Backend runs `prisma migrate deploy` followed by
`node src/server.js`, without watch mode or source-code mounts.
After changing application code, run `docker compose up -d --build` to rebuild images.

Production requires a strong `JWT_SECRET` in root `.env` (at least 32 characters).
Do not use demo credentials or a development JWT secret on a publicly accessible server.
`NODE_ENV` is pinned inside each Compose file, regardless of root `.env`.
Only the Frontend port is published to the network by default: Backend and PostgreSQL
are published to host loopback only. The existing `postgres_data` volume and
`./backend/uploads` images are preserved in both modes.

**Switch modes safely** (do not run `down -v` because that deletes the database volume):

```bash
# From development to production
docker compose -f dokcer-compose.dev.yaml down
docker compose up -d

# From production to development
docker compose down
docker compose -f dokcer-compose.dev.yaml up -d
```

On an existing database, `prisma migrate deploy` runs automatically before Backend startup.
Never use `docker compose down -v` unless intentionally deleting all data.
For production with real users, set up proper database credential rotation,
backups and HTTPS before public exposure. The current Compose retains the existing
local `ogtb` database credentials for compatibility with the current persisted volume;
**those default database credentials are not suitable for public production**.

### Demo Seed — USER only (Development)

`npm run db:seed` now creates **only** a demo USER if absent.
Running it with `NODE_ENV=production` is explicitly blocked.
It never creates ADMIN, promotes/demotes an existing account,
reactivates existing accounts, or updates passwords. `SEED_ADMIN_PASSWORD`
is obsolete and ignored. Development demo USER setup (optional):

```bash
docker compose -f dokcer-compose.dev.yaml exec backend npm run db:seed
```

### First ADMIN — explicit, one-time CLI

Before running this command, review/back up the correct database and ensure
the `AdminBootstrapState` migration is present. **Both Docker Compose startup
modes automatically run `prisma migrate deploy`**; the new schema was verified
on a disposable test database in Phase 5. Startup may adopt an existing legacy
ADMIN but **never creates the first ADMIN account automatically**. The first
ADMIN requires an explicit operator command in an interactive terminal.

```bash
# Development:
docker compose -f dokcer-compose.dev.yaml exec backend npm run admin:bootstrap

# Production:
docker compose exec backend npm run admin:bootstrap
```

The CLI prompts for name/email/password with secret input hidden, requires
an interactive TTY, and creates the first ADMIN **only once**. If a legacy
ADMIN already exists (even disabled), the CLI preserves that account and
will not create another first Admin. The Backend now supports the protected
`POST /api/admin/users/admins` endpoint for subsequent Admin accounts:
only an existing active ADMIN with a valid session may invoke it. The
`/admin/users` **+ เพิ่ม Admin** UI is implemented in Phase 4.
The responsive two-step form validates name/email/password/confirmation, then
asks for confirmation **without displaying the password**. It sends only
`name/email/password` to the Backend; role/status are server-owned.
After a successful POST, the user list refreshes. A failed refresh never
retries the POST, and the created account stays visible in the list.
The API returns no passwords or hashes and creates a permanent audit record.

The Admin account management API rejects unauthenticated/USER callers,
duplicate emails, forbidden role/status fields, self-suspension and
last-active-Admin suspension. Admin status changes are serialized with CLI
bootstrap under the same PostgreSQL advisory transaction lock and audited.
PostgreSQL security and migration tests were completed on a disposable
test DB in Phase 5. Phase 6 additionally verified the **real interactive
Docker CLI** in Dev-like and Production image runtimes (8/8 passed).
The active Compose DB was not migrated or bootstrapped by this QA work.

Detailed security, migration, recovery and error guidance:
[`docs/admin-bootstrap.md`](./docs/admin-bootstrap.md).

Default Frontend URL is `http://localhost:3000`; Backend health endpoint is
`http://localhost:4000/health` on the host machine.

## Run without Docker

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
npm run prisma:generate
npm run db:migrate
npm run dev
```

ต้องมี PostgreSQL ที่ตรงกับ `DATABASE_URL` เปิดอยู่ก่อน

## Main Features

- Register / Login / Logout และ Role `USER`, `ADMIN`
- Full-screen Map, current location, radius search และ category filter
- Donation CRUD, วันที่เปิด-ปิดตาม `Asia/Bangkok`, `AVAILABLE`, `OUT_OF_STOCK`, `EXPIRED`
- Upload / delete รูปภาพของ Donation สูงสุด 5 รูปรวมต่อโพสต์
- Navigation พร้อม route, ระยะทาง และเวลาโดยประมาณ โดย Backend ตรวจ Donation จาก Database และอนุญาตเฉพาะ `AVAILABLE` ที่อยู่ในช่วงวันที่
- Report Donation
- Admin Dashboard สำหรับ Users, Donations และ Reports รวม Donation Detail ที่เปิดดูโพสต์ซ่อนได้เฉพาะ Admin
- Admin คนแรก: CLI ครั้งเดียว; Admin คนต่อไป: ปุ่ม + เพิ่ม Admin ใน `/admin/users` พร้อมยืนยันและ Audit Log

### Phase 5 isolated Admin verification

Fresh/legacy migrations, Admin concurrency, audit rollback and the real
Dashboard→API→PostgreSQL flow were verified on a **disposable** PostgreSQL
container: backend **107/107**, real Admin database **11/11**, real browser
**3/3**. The Prisma advisory-lock `void` result bug was fixed by a `::text`
cast. Live databases/services were not modified. See
[`docs/admin-phase5-isolated-qa.md`](./docs/admin-phase5-isolated-qa.md).

## Testing

Backend — **Integration Tests อาจเขียนข้อมูลลง PostgreSQL
และระบบไฟล์ภาพ**. ต้องยืนยัน `DATABASE_URL` เป็นฐานข้อมูลทดสอบ
ที่แยกจาก DB จริง และแยก Working Directory สำหรับ Uploads ก่อนรัน:

```bash
cd backend
# ตรวจ DATABASE_URL และแหล่งจัดเก็บไฟล์ก่อนรันทดสอบทุกครั้ง
npm test
npm run test:coverage
```

หากยังไม่มีฐานข้อมูลทดสอบที่แยกและตรวจสอบแล้ว ให้รันเฉพาะ
Unit/Mock Tests หรือระบุว่า Integration Tests ยังไม่สามารถตรวจได้.
ตัวอย่าง Isolation และหลักฐานอยู่ที่
[`docs/admin-phase5-isolated-qa.md`](./docs/admin-phase5-isolated-qa.md).

Coverage gate:

- Lines ≥ 80%
- Functions ≥ 80%
- Branches ≥ 60%

Frontend:

```bash
cd frontend
npm test
npm run lint
npm run build
npm audit
```

Frontend ใช้ ESLint flat config (`eslint.config.mjs`) ร่วมกับ `eslint-config-next` และตั้ง `--max-warnings=0` เพื่อให้ lint เป็น quality gate จริงก่อน build
Frontend unit tests ครอบคลุม create/edit Donation กรณีข้อมูลหลักบันทึกสำเร็จแต่ image upload ล้มเหลว เพื่อยืนยันว่า retry จะอัปโหลดเฉพาะรูปและไม่สร้าง/แก้ข้อมูลซ้ำ
## Documentation

- [`docs/api-spec.md`](./docs/api-spec.md) — API endpoints และ validation behavior
- [`docs/database.md`](./docs/database.md) — Models, relations และสถานะ
- [`docs/project-flow.md`](./docs/project-flow.md) — User/Admin flows
- [`docs/architecture.md`](./docs/architecture.md) — Architecture, security และ testing
- [`docs/admin-bootstrap.md`](./docs/admin-bootstrap.md) — First Admin CLI setup, legacy migration, security and recovery
- [`docs/docker-admin-setup.md`](./docs/docker-admin-setup.md) — Docker Dev/Prod startup, manual CLI, data safety and Phase 6 evidence
- [`docs/admin-phase6-docker-qa.md`](./docs/admin-phase6-docker-qa.md) — Docker runtime/bootstrap test evidence (8/8)
- [`docs/admin-phase7-docs-review.md`](./docs/admin-phase7-docs-review.md) — Documentation sync, runtime readiness finding, findings and handoff to Phase 8
- [`docs/admin-phase8-final-review.md`](./docs/admin-phase8-final-review.md) — Historical failed security review
- [`docs/admin-phase8-final-review-rerun.md`](./docs/admin-phase8-final-review-rerun.md) — Final re-review passed for source/isolated QA; deployment prerequisites remain
- [`docs/admin-phase7-security-remediation.md`](./docs/admin-phase7-security-remediation.md) — Patched Dependencies, updated security audit and regression report
- [`docs/admin-phase5-isolated-qa.md`](./docs/admin-phase5-isolated-qa.md) — PostgreSQL migration/security QA and rollback evidence

## Project Status

ขอบเขตหลักของ OGTB Donation Map ยึดตาม `server-side-project-system.md`
และไม่มี Claim / Reservation / Chat เพิ่มเข้ามานอก Spec.

**Admin Bootstrap / Dashboard Management:** Implementation และ
Isolated QA (Phases 1–6) ผ่านแล้ว; Phase 7 ตรวจและปรับเอกสาร
ครบพร้อม Documentation Contract Tests. ผลตรวจแบบอ่านอย่างเดียวพบว่า
ฐานข้อมูลที่กำลังใช้งานยังไม่มี Admin Tables ใหม่.
Phase 8 เดิมถูก BLOCKED ด้าน Security จึงกลับมาแก้ Phase 7.
**ตอนนี้ `npm audit --omit=dev` Backend/Frontend เหลือ 0 Vulnerabilities
ใน Source/Lockfiles**; Backend Full Audit 0, Frontend Full Audit
เหลือ 7 Moderate เฉพาะ Development Toolchain.
PostgreSQL Admin 11/11, Backend Full 117/117, Browser→DB 3/3,
Frontend Unit 20/20 และ Production Docker Images ผ่าน.
**Phase 8 Final Review รอบใหม่ผ่านระดับ Source/Isolated QA**;
ยังเหลือ 7 Moderate ใน Frontend Dev Toolchain และไม่ถือว่า
Production พร้อม Deploy. **Containers ที่กำลังรันอยู่
ยังไม่ได้อัปเดต Dependency Patch** (Next.js 16.3.8 / Prisma 7.10.0)
และฐานข้อมูลยังไม่มี Admin Tables ใหม่. ดู
`docs/admin-phase8-final-review-rerun.md` และ
`docs/admin-phase7-security-remediation.md`.
**ยังไม่ Commit/Deploy/สั่ง Restart
หรือ Apply Migration กับฐานข้อมูลจริง**. เนื่องจากเป็น Dev Bind Mount
โค้ดบางส่วนอาจถูก Hot Reload โดยอัตโนมัติ. ผลทดสอบทั้งหมดมาจากสภาพแวดล้อมแยก.
ดู `docs/admin-phase5-isolated-qa.md` และ
`docs/admin-phase6-docker-qa.md` ก่อน Rollout.
