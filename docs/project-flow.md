# Project Flow

ระบบยึดตาม `server-side-project-system.md` เท่านั้น

## Authentication

```text
Guest
  ↓
Map / Nearby Search / Donation Detail (Public)
  ├── ดูจุดบริจาคและรายละเอียดได้โดยไม่ต้อง Login
  └── เมื่อต้องทำ protected action → Register / Login
                                      ↓
                         Backend สร้าง JWT session ใน httpOnly cookie
                                      ↓
                               USER / ADMIN
```

การสร้าง Donation, แก้ไข/ลบโพสต์ของตัวเอง, อัปโหลดรูป และส่ง Report ต้อง Login ก่อน ส่วนหน้า Map, Nearby Search, Donation Detail และ Navigation เป็น public flow

`ADMIN` ยังใช้ระบบปกติเหมือน `USER` และมีปุ่ม Dashboard เพิ่ม

## Map / Nearby Search

```text
เปิดหน้า Map
    ↓
ขอ Location ปัจจุบัน
    ↓
กำหนดรัศมี + ประเภท (ถ้ามี)
    ↓
GET /api/donations/nearby
    ↓
Backend คัดเฉพาะ AVAILABLE + อยู่ในช่วงวันที่ + ไม่ถูกซ่อน
    ↓
คำนวณระยะทางจริง
    ↓
แสดง Marker บน Map
    ↓
กด Marker
    ↓
ดูข้อมูลเบื้องต้น
    ↓
เปิด Donation Detail
```

## Donation

```text
USER / ADMIN
    ↓
กด “+ บริจาค”
    ↓
กรอกข้อมูล + Location + วันที่
    ↓
POST /api/donations
    ↓
อัปโหลดรูป (ถ้ามี)
    ↓
Donation ถูกสร้าง
```
หากข้อมูล Donation ถูกบันทึกสำเร็จแล้วแต่การอัปโหลดรูปล้มเหลว ระบบจะแจ้งว่าโพสต์ถูกสร้าง/แก้ไขเรียบร้อยแล้วและให้ลองอัปโหลดเฉพาะรูปอีกครั้ง โดยไม่ยิง Create/PATCH ซ้ำ จึงไม่สร้าง Donation ซ้ำและไม่แสดง false failure ว่าข้อมูลหลักบันทึกไม่สำเร็จ

วันที่จากฟอร์มใช้เขตเวลา `Asia/Bangkok` โดยวันเริ่มเปิดบริจาคตั้งแต่ 00:00:00 และวันสิ้นสุดใช้งานได้ถึง 23:59:59.999 ของวันนั้น จากนั้น Backend แปลงเป็น UTC สำหรับเก็บและเปรียบเทียบเวลา

เจ้าของโพสต์สามารถแก้ไข ลบ เพิ่ม/ลบรูป และกด `ของหมดแล้ว`

สถานะ:

```text
AVAILABLE
  ├── เจ้าของกดของหมดแล้ว → OUT_OF_STOCK
  └── now > endDate          → EXPIRED
```

เฉพาะ `AVAILABLE` ที่อยู่ในช่วง `startDate` ถึง `endDate` และไม่ถูก Admin ซ่อนจึงแสดงบน Map

## Donation Images
```text
เจ้าของ Donation
    ↓
เลือกรูป JPG / PNG / WEBP
    ↓
POST /api/donations/:id/images
    ↓
Backend ตรวจ ownership + MIME + file signature + ขนาด
    ↓
ตรวจจำนวนรูปเดิม + รูปใหม่ ต้องไม่เกิน 5 รูปรวมต่อ Donation
    ↓
บันทึกไฟล์ + DonationImage
```

ถ้าเกิน 5 รูปรวม ระบบ reject ทั้ง request โดยไม่เพิ่มรูปบางส่วน เมื่อลบรูปจะลบทั้ง record และไฟล์จริง การลบ Donation จะลบรูปที่เกี่ยวข้องทั้งหมดด้วย
## Navigation

```text
Donation Detail
    ↓
Frontend ตรวจว่า Donation ยัง AVAILABLE และอยู่ในช่วงวันที่
    ↓
กด “นำทางไปจุดบริจาค”
    ↓
อ่าน Location ปัจจุบัน
    ↓
GET /api/routes?donationId=&fromLat=&fromLng=
    ↓
Backend โหลด Donation จาก Database และตรวจ status / hidden / วันที่อีกครั้ง
    ↓
Backend ใช้พิกัดของ Donation จาก Database เป็นปลายทาง
    ↓
เรียก Routing Provider
    ↓
แสดงเส้นทาง + ระยะทาง + เวลาโดยประมาณบน Map
```

การเปิด URL `/donations/:id/navigate` ตรง ๆ จะไม่คำนวณเส้นทางถ้าเป็น `OUT_OF_STOCK`, `EXPIRED`, ยังไม่ถึงวันเริ่ม หรือเลยวันสิ้นสุด และ Backend จะตรวจซ้ำเพื่อไม่ให้ bypass ด้วยการเรียก API โดยตรง
ไม่มี Claim, Reservation และไม่มีขั้นตอนยืนยันหลังไปรับของ

## Report

```text
Donation Detail
    ↓
กด “รายงานโพสต์”
    ↓
Login (ถ้ายังไม่ได้ Login)
    ↓
เลือกเหตุผล + รายละเอียดเพิ่มเติม
    ↓
POST /api/donations/:id/reports
    ↓
สร้าง Report สถานะ PENDING
    ↓
รอ Admin ตรวจสอบ
```

### Runtime prerequisite (read-only snapshot, 2026-11-16)

The current Dev containers can hot reload code from bind mounts.
However, the active PostgreSQL database did not yet contain
`AdminBootstrapState` or `AdminAuditLog`. Before following the
new CLI/Dashboard Admin flow on that database, an operator must first
complete the approved backup and migration process. No live migration
or bootstrap was run in this documentation audit.

## First Admin Setup (Phase 2 — CLI implemented)

```text
Authorized server operator
    ↓
npm run admin:bootstrap (interactive TTY only)
    ↓
Transaction-level PostgreSQL advisory lock
    ↓
Check permanent AdminBootstrapState marker AND existing ADMIN rows
    ├── Marker exists → reject repeated bootstrap
    ├── Existing legacy ADMIN → adopt marker + audit, reject creation
    └── No marker and no ADMIN
          ↓
      Prompt for Name / Email / hidden Password / Confirm Password
          ↓
      Validate and hash password (bcrypt cost 12)
          ↓
      Lock + recheck marker/ADMIN under a new transaction
          ↓
      Atomic CREATE ADMIN + singleton marker + AuditLog
          ↓
      Commit / rollback as a unit
          ↓
      New first ADMIN can log in at /login
```

Password never appears in CLI arguments, environment configuration or output.
The first Admin is not created by public Registration, Docker up, migrations
or `db:seed`. The migration separately adopts existing ADMINs (even inactive)
without changing their credentials/role/status. `db:seed` now inserts only
a missing demo USER, without touching existing accounts.

**After initial setup:** further ADMIN accounts are created at
`/admin/users` → **+ เพิ่ม Admin** (Phase 4 UI), calling the authenticated,
ADMIN-only Phase 3 API. The first ADMIN still uses the CLI exclusively.
ดู `docs/admin-bootstrap.md` และ `docs/docker-admin-setup.md`
สำหรับคำสั่ง Dev/Prod, Migration, Error และการ Backup.
Phases 1–6 ไม่ได้รัน Migration หรือ Bootstrap กับฐานข้อมูลที่ใช้งานจริง
โดย PostgreSQL Integration ผ่านใน Phase 5 และการกรอกข้อมูลผ่าน Docker
Interactive TTY ผ่านใน Phase 6 (ดูรายงานที่เกี่ยวข้อง)

## Create additional ADMIN — Phase 3 Backend API

```text
Logged-in existing ADMIN
  ↓
POST /api/admin/users/admins (name, email, password)
  ↓
requireAuth → requireAdmin → validateAdditionalAdmin
  ↓
Shared DB transaction advisory lock + recheck actor is active ADMIN
  ↓
Require permanent bootstrap marker and unused normalized email
  ↓
Hash password, create ADMIN (server-owned role/isActive) + ADMIN_CREATED audit
  ↓
201 safe ADMIN response, no password/hash
```

An ordinary USER/Guest cannot call this API. Duplicate email, invalid
password or a missing initial-admin marker fails safely.
`PATCH /api/admin/users/:id/status` now serializes ADMIN state mutations
under the same lock, rejects self-suspension and last-active-Admin
suspension, and audits ADMIN privilege state changes. It does not affect
existing donation/map/report/navigation workflows.

**Phase 4 implemented:** `/admin/users` exposes an ADMIN-only
**+ เพิ่ม Admin** action. The form validates Name, Email, Password and
Confirm Password client-side, then shows a confirmation step containing
only Name/Email/ADMIN role (never the password). Confirmation sends only
`{name,email,password}` to the Backend; Backend assigns ADMIN, verifies
the permanent bootstrap marker and writes an audit event.
On success the UI refreshes the list, resets filters and displays success.
If list refresh fails **after** POST, it preserves the new row locally and
does not retry POST. API validation/duplicate/conflict/session errors appear
in the dialog; Escape/Cancel clears the secret fields. Guest/USER cannot
open the form, and Backend authorization prevents direct API bypass.

Phase 4 Browser QA ใช้ Mock API ส่วน Phase 5 ทดสอบ Browser→Express→
PostgreSQL จริง **บนฐานข้อมูลชั่วคราวที่แยกจาก Production** ผ่าน 3/3
โดยไม่ได้สร้าง Admin หรือเปลี่ยนข้อมูลบนฐานข้อมูลที่ใช้งานจริง

### Phase 5 verification

The implemented Add Admin UI completed the real isolated
Browser→Express→PostgreSQL flow (3/3). Bootstrap concurrency, legacy adoption,
seed and audit rollback also passed on disposable databases.
Full interactive Docker TTY input was subsequently verified for both
Prod and Dev-like runtimes (Phase 6: 8/8). See
`docs/admin-phase5-isolated-qa.md` and `docs/docker-admin-setup.md`.

## Admin Dashboard

```text
ADMIN
  ↓
หน้า Map เหมือน USER
  ↓
  ├── Users
  │    ├── ค้นหา/กรองบัญชี และระงับ/เปิดใช้งาน
  │    └── + เพิ่ม Admin → ฟอร์ม → ยืนยัน → POST /api/admin/users/admins
  ├── Donations
  │    ├── ดูรายละเอียดได้ทั้ง VISIBLE / HIDDEN
  │    ├── ดูรูป เจ้าของ และ Reports ที่เกี่ยวข้อง
  │    └── ซ่อน / แสดง / ลบ
  └── Reports
       ├── ดูรายละเอียด
       ├── RESOLVED
       ├── ซ่อน / ลบ Donation
       └── ระงับเจ้าของโพสต์
```

ทุก Admin endpoint ตรวจทั้ง Authentication และ Role ที่ Backend

## End-to-End Flow

```text
เข้าเว็บไซต์
    ↓
Map / Nearby Search (Public)
    ↓
Donation Detail
    ├── Navigation (Public)
    └── Protected actions → Register / Login
                              ├── USER / ADMIN: สร้าง Donation / Report / จัดการโพสต์ของตัวเอง
                              └── ADMIN: Dashboard / Admin Review
```

ระบบไม่มี workflow การจองของ ไม่มีการ claim สิ่งของ และไม่มี chat ตามขอบเขตของ source of truth
