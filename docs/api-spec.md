# API Spec

API ทั้งหมดต้องยึดตาม `server-side-project-system.md`

**Deployment state, 2026-11-16:** The following Admin API contract was
verified on an **isolated disposable PostgreSQL**, but the active Dev
database was found (read-only) to lack `AdminBootstrapState` and
`AdminAuditLog`. Its Admin creation/status changes must not be
considered live-ready until the schema is migrated under an approved
rollout. The Dev container may hot reload application code independently
of database migrations. See `docs/docker-admin-setup.md`.

## Initial Admin setup (not an HTTP endpoint)

The first ADMIN is created ONLY by the trusted operator via
`npm run admin:bootstrap` in an interactive server terminal, and cannot
be created through public registration or an HTTP endpoint. The CLI's
one-time lock is stored in `AdminBootstrapState`. Existing legacy ADMINs
are recognized without resetting their credentials.

`POST /api/admin/users/admins` is **implemented in Phase 3** and
requires an existing active ADMIN session. It creates only *subsequent*
Admin accounts (requires permanent bootstrap marker). The Dashboard
creation form is implemented in Phase 4 at `/admin/users`. Public register always assigns
`USER`. Operator instructions: `docs/admin-bootstrap.md`.

## Authentication

| Method | Endpoint | Description | Access | Success |
| --- | --- | --- | --- | ---: |
| POST | `/api/auth/register` | สมัครสมาชิกและสร้าง session | Public | 201 |
| POST | `/api/auth/login` | Login และสร้าง session | Public | 200 |
| POST | `/api/auth/logout` | ล้าง session cookie | Public | 204 |
| GET | `/api/auth/me` | ดูข้อมูลผู้ใช้ที่ Login อยู่ | USER / ADMIN | 200 |

ระบบใช้ JWT ใน `httpOnly` cookie ชื่อ `ogtb_session` และรองรับ `Authorization: Bearer <token>` สำหรับการเรียก API โดยตรง

Role มีเพียง `USER` และ `ADMIN` โดย ADMIN ใช้ feature ปกติได้เหมือน USER

## Donation

| Method | Endpoint | Description | Access | Success |
| --- | --- | --- | --- | ---: |
| GET | `/api/donations` | ดูรายการ Donation ที่ไม่ถูกซ่อน | Public | 200 |
| GET | `/api/donations/nearby?lat=&lng=&radius=&category=` | ค้นหาจุดที่แสดงบน Map | Public | 200 |
| GET | `/api/donations/:id` | ดู Donation Detail พร้อมรูป | Public | 200 |
| POST | `/api/donations` | สร้าง Donation | USER / ADMIN | 201 |
| POST | `/api/donations/:id/images` | อัปโหลดรูป field `images` | Owner | 201 |
| PATCH | `/api/donations/:id` | แก้ไข Donation | Owner | 200 |
| PATCH | `/api/donations/:id/out-of-stock` | ระบุว่าของหมดแล้ว | Owner | 200 |
| DELETE | `/api/donations/:id/images/:imageId` | ลบรูป Donation | Owner | 204 |
| DELETE | `/api/donations/:id` | ลบ Donation | Owner | 204 |

ข้อมูลหลักของ Donation:

- `title`
- `description`
- `category`
- `quantity`
- `latitude`, `longitude`
- `address`
- `startDate`, `endDate`

เมื่อส่งค่าแบบ `YYYY-MM-DD` ระบบตีความเป็นวันตามเขตเวลา `Asia/Bangkok`: `startDate` เริ่ม 00:00:00 และ `endDate` สิ้นสุด 23:59:59.999 ของวันนั้น ก่อนแปลงเป็น UTC เพื่อเก็บในฐานข้อมูล

สถานะมี `AVAILABLE`, `OUT_OF_STOCK`, `EXPIRED`

### Donation Images

- รองรับ JPG, PNG, WEBP
- จำกัด 5 MB ต่อรูป
- สูงสุด 5 รูปรวมต่อ Donation และสูงสุด 5 รูปต่อ request
- ถ้า `จำนวนรูปเดิม + รูปใหม่ > 5` ตอบ `400 TOO_MANY_DONATION_IMAGES` โดยไม่เพิ่มรูปบางส่วน
- ตรวจทั้ง MIME type และ file signature
- URL เปิดอ่านผ่าน `/uploads/donations/<filename>`
- เพิ่ม/ลบรูปได้เฉพาะเจ้าของ Donation

### Nearby Search

`GET /api/donations/nearby` รับ:

- `lat` — latitude ปัจจุบัน
- `lng` — longitude ปัจจุบัน
- `radius` — กิโลเมตร ค่าเริ่มต้น 5 สูงสุด 500
- `category` — optional, case-insensitive

ผลลัพธ์ต้องผ่าน:

```text
status = AVAILABLE
isHidden = false
startDate <= now <= endDate
อยู่ภายใน radius
```

Response มี `distanceKm` เพิ่มสำหรับหน้า Map

## Navigation

| Method | Endpoint | Description | Access | Success |
| --- | --- | --- | --- | ---: |
| GET | `/api/routes?donationId=&fromLat=&fromLng=` | คำนวณเส้นทางจากตำแหน่งปัจจุบันไป Donation ที่ยังรับของได้ | Public | 200 |

Backend ใช้ `donationId` เป็น source of truth สำหรับปลายทาง โดยอ่าน `latitude/longitude` ของ Donation จาก Database เอง ไม่รับปลายทางจาก client

ก่อนเรียก Routing Provider ต้องผ่านทุกเงื่อนไข:

- `status = AVAILABLE`
- `isHidden = false`
- `startDate <= now <= endDate`

ถ้า Donation หมด, หมดอายุ หรือยังไม่ถึงวันเริ่ม จะตอบ `409 DONATION_NOT_AVAILABLE`; ถ้าถูกซ่อนหรือไม่มี Donation จะตอบ `404 DONATION_NOT_FOUND`

Response หลัก:

- `distanceMeters`
- `durationSeconds`
- `geometry` — GeoJSON LineString
- `steps`

Backend เรียก Routing Provider ผ่าน `ROUTING_BASE_URL` ค่าเริ่มต้นคือ OSRM public service และไม่เก็บ route ลง Database

| Method | Endpoint | Description | Access | Success |
| --- | --- | --- | --- | ---: |
| POST | `/api/donations/:id/reports` | ส่ง Report ให้ Admin ตรวจสอบ | USER / ADMIN | 201 |

Reason:

- `ILLEGAL_ITEM`
- `DANGEROUS_ITEM`
- `FRAUD`
- `INAPPROPRIATE_CONTENT`
- `OTHER`

`description` เป็น optional สูงสุด 1000 ตัวอักษร และ Report ใหม่เป็น `PENDING`

## Admin

ทุก endpoint ใต้ `/api/admin` ต้องผ่าน Authentication และ `ADMIN` role

| Method | Endpoint | Description | Access | Success |
| --- | --- | --- | --- | ---: |
| GET | `/api/admin/users` | ดู Users ทั้งหมด | ADMIN | 200 |
| POST | `/api/admin/users/admins` | สร้าง ADMIN คนต่อไป (หลัง CLI bootstrap) | ADMIN | 201 |
| PATCH | `/api/admin/users/:id/status` | ระงับ/เปิดบัญชีด้วย `isActive` | ADMIN | 200 |
| GET | `/api/admin/donations` | ดู Donations ทั้งหมดรวมโพสต์ซ่อน | ADMIN | 200 |
| GET | `/api/admin/donations/:id` | ดู Donation Detail สำหรับ Admin รวมโพสต์ที่ถูกซ่อนและ Reports | ADMIN | 200 |
| PATCH | `/api/admin/donations/:id/visibility` | ซ่อน/แสดง Donation | ADMIN | 200 |
| DELETE | `/api/admin/donations/:id` | ลบ Donation | ADMIN | 204 |
| GET | `/api/admin/reports` | ดู Reports ทั้งหมด | ADMIN | 200 |
| GET | `/api/admin/reports/:id` | ดู Report Detail | ADMIN | 200 |
| PATCH | `/api/admin/reports/:id` | เปลี่ยน `PENDING` / `RESOLVED` | ADMIN | 200 |

### POST /api/admin/users/admins — Protected additional Admin creation

- **Request JSON:** `{"name":"Admin Name","email":"new-admin@example.org","password":"choose-a-strong-password"}`.
  Fields other than `name`, `email`, and `password` are **rejected**;
  clients cannot set `role`, `isActive`, ID or password hash.
- **Validation:** Name 2–80 characters; syntactically valid email at most
  254 characters, normalized to lowercase; password 8–72 characters and
  at most 72 UTF-8 bytes (bcrypt 12 rounds), no control characters.
  Email has a DB unique constraint. Response is safe DTO:
  `id/name/email/role/isActive/createdAt/updatedAt/_count`,
  **never** `passwordHash` or plaintext password.
- `201` new Admin created, `400 VALIDATION_ERROR` for malformed/forbidden
  fields, `401 UNAUTHORIZED`/`INVALID_SESSION` for no session,
  `403 FORBIDDEN` for USER, `403 ADMIN_ACCESS_REVOKED` if actor
  stopped being an active ADMIN, `409 EMAIL_ALREADY_EXISTS` for collisions,
  `409 ADMIN_BOOTSTRAP_REQUIRED` when the first-admin CLI state is absent.
- Internals: `requireAuth` + `requireAdmin` on all `/api/admin` routes.
  Service revalidates actor and checks `AdminBootstrapState` under the
  same PostgreSQL transaction advisory lock as first-admin CLI.
  User creation and `AdminAuditLog(ADMIN_CREATED/SUCCESS)` are atomic.
- **No public admin-creation endpoint.** Phase 4 added the Dashboard UI,
  which first validates and confirms without showing the secret,
  then sends only name/email/password and refreshes the user list.
  The API remains accessible only to authenticated ADMINs and requires
  the one-time CLI marker, once the migration is safely installed.

### PATCH /api/admin/users/:id/status — ADMIN safety

- Existing `{"isActive": boolean}` contract and User/ADMIN response are preserved.
- ADMIN-target suspension/reactivation uses the shared transaction advisory
  lock, rechecks acting ADMIN within the transaction and logs successful
  state changes (`ADMIN_SUSPENDED` / `ADMIN_REACTIVATED`).
- `400 CANNOT_SUSPEND_SELF`: cannot suspend own ADMIN session.
  `409 LAST_ACTIVE_ADMIN`: cannot suspend the final active ADMIN.
  Denied attempts write `ADMIN_SUSPENDED/DENIED` audit atomically
  before the error is returned.
- Role USER status changes keep their existing endpoint semantics.
  Idempotent status requests produce no extra audit event or timestamp change.
- Non-existent target: `404 USER_NOT_FOUND`. Actor no longer active ADMIN:
  `403 ADMIN_ACCESS_REVOKED`.
- No password or hash is present in Admin API responses.

ก่อนตอบข้อมูล Admin ที่มี Donation ระบบจะ refresh โพสต์ `AVAILABLE` ที่เลย `endDate` ให้เป็น `EXPIRED` เพื่อให้ Dashboard แสดงสถานะล่าสุด


## Error / Security Behavior

- Validation ผิด → `400`
- malformed JSON → `400 INVALID_JSON`
- ไม่มี/หมดอายุ session → `401`
- role หรือ ownership ไม่ถูกต้อง → `403`
- resource ไม่พบ → `404`
- payload เกิน 1 MB → `413 PAYLOAD_TOO_LARGE`
- rate limit เกิน → `429 TOO_MANY_REQUESTS`
- Routing Provider มีปัญหา → `502 ROUTING_UNAVAILABLE`
- Routing Provider timeout หลัง retry → `504 ROUTING_TIMEOUT`
- Internal error → `500` โดยไม่ส่ง stack trace กลับ client

ระบบไม่มี Claim / Reservation endpoint ตาม source of truth
