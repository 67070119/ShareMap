# Server-Side Project — ระบบแผนที่สำหรับบริจาคสิ่งของ

## ภาพรวมระบบ

ระบบเป็นเว็บแผนที่สำหรับให้ผู้ใช้นำสิ่งของมาลงเป็นจุดบริจาค และให้ผู้ที่ต้องการสามารถค้นหาจุดบริจาคใกล้ตัว ดูรายละเอียด และนำทางไปยังจุดนั้นได้โดยตรง

ระบบมี 2 Role คือ `USER` และ `ADMIN` โดย `ADMIN` สามารถใช้งานระบบได้เหมือน `USER` ทุกอย่าง และมีสิทธิ์เข้า Dashboard เพื่อจัดการข้อมูลในระบบเพิ่มเติม

## 1. Authentication
- สมัครสมาชิก
- Login
- Logout
- ตรวจสอบข้อมูลผู้ใช้ที่ Login อยู่
- แยก Role เป็น `USER` และ `ADMIN`

## 2. Map
- แสดงแผนที่แบบเต็มหน้าจอ
- ขอ Location ปัจจุบันของผู้ใช้
- แสดงจุดบริจาคเป็น Marker บนแผนที่
- ปรับรัศมีค้นหาจุดบริจาคได้
- กด Marker เพื่อดูรายละเอียดเบื้องต้น
- กดเข้าไปดูรายละเอียดของจุดบริจาคได้

## 3. Donation
ข้อมูลหลักของโพสต์บริจาค ได้แก่ ชื่อสิ่งของ รายละเอียด ประเภท จำนวน รูปภาพ จุดรับของ Latitude / Longitude วันที่เริ่มบริจาค วันที่สิ้นสุด และสถานะของบริจาค

ผู้ใช้สามารถเพิ่มของบริจาค แก้ไขโพสต์ของตัวเอง ลบโพสต์ของตัวเอง และกดว่า `ของหมดแล้ว`

## 4. Donation Status
- `AVAILABLE` — ของยังมีอยู่และอยู่ในช่วงวันที่เปิดบริจาค แสดงบน Map และนำทางได้
- `OUT_OF_STOCK` — ของหมดแล้ว ไม่แสดงบน Map
- `EXPIRED` — เลยวันที่สิ้นสุดการบริจาคแล้ว ไม่แสดงบน Map

เงื่อนไขการแสดงบน Map:

```text
status = AVAILABLE
และ
วันที่ปัจจุบันอยู่ระหว่าง วันที่เริ่มบริจาค → วันที่สิ้นสุด
```

## 5. Search / Filter
- ค้นหาจุดบริจาคใกล้ Location ปัจจุบัน
- ปรับรัศมีค้นหา
- Filter ตามประเภทของบริจาค
- แสดงเฉพาะโพสต์ที่ยัง `AVAILABLE`

## 6. Navigation
- กดนำทางจาก Donation Detail
- อ่าน Location ปัจจุบัน
- คำนวณ Route
- แสดงเส้นทางบน Map
- แสดงระยะทางและเวลาเดินทางโดยประมาณ
- ไม่มีระบบจองของ และไม่มีขั้นตอนยืนยันหลังจากไปรับของ

## 7. Report
ผู้ใช้สามารถรายงานโพสต์กรณีสิ่งของผิดกฎหมาย ของอันตราย ข้อมูลหลอกลวง รูปหรือเนื้อหาไม่เหมาะสม หรือเหตุผลอื่น ๆ โดยเลือกเหตุผล กรอกรายละเอียด และส่งให้ Admin ตรวจสอบ

## 8. Admin Dashboard
`ADMIN` ใช้งานระบบหน้า Map ได้เหมือน `USER` ทุกอย่าง แต่มีปุ่ม `Dashboard` เพิ่มขึ้นมา

ภายใน Dashboard สามารถ:
- ดู Users ทั้งหมด
- ดู Donations ทั้งหมด
- ดู Reports ทั้งหมด
- ดูรายละเอียด Report
- ซ่อนโพสต์
- ลบโพสต์
- จัดการ User ที่มีปัญหา

### Deployment status (ตรวจแบบอ่านอย่างเดียว 16 พ.ย. 2026)

ระบบที่กำลังรันอยู่เป็น Development แบบ Bind Mount / Hot Reload
ทั้ง Backend และ Frontend และฐานข้อมูลปัจจุบันยังไม่มีตาราง
`AdminBootstrapState` และ `AdminAuditLog`. ดังนั้นแม้โค้ด
Admin CLI/API/Dashboard จะผ่านการทดสอบบน Database แยกแล้ว ก็ยัง
ต้องทำ Backup และ Migration ของระบบจริงก่อนเริ่มใช้งานฟีเจอร์นี้.
การตรวจ/แก้เอกสารนี้ไม่ได้รัน Migration หรือสร้างบัญชี Admin จริง.
เอกสารตรวจสอบและส่งมอบ: `docs/admin-phase7-docs-review.md`.

## 9. Admin Bootstrap & Admin Management (Phase 4 Dashboard UI)

- ADMIN คนแรกต้องสร้างผ่าน CLI Script ที่ผู้ดูแล Server สั่งเองเพียงครั้งเดียว
  ไม่อนุญาต Public API, การสมัครทั่วไป หรือการสร้าง Admin อัตโนมัติเมื่อ Docker เริ่ม
- ADMIN คนต่อไปต้องสร้างผ่าน Dashboard `/admin/users` ด้วย ADMIN ที่ Login แล้ว
  เท่านั้น ผ่านปุ่ม **+ เพิ่ม Admin** ที่ Implement ใน Phase 4
  และ Backend Protected API ที่ Implement ใน Phase 3
- Register ทั่วไปได้ Role `USER` เสมอ ไม่มี Role SUPER_ADMIN
- `AdminBootstrapState` singleton เก็บว่าระบบถูก Bootstrap แล้ว;
  ลบหรือระงับ ADMIN เดิมก็ไม่ปลดล็อกการ Bootstrap ใหม่
- `AdminAuditLog` เก็บ actor, target, action, outcome, timestamp โดยไม่เก็บ Secret
- Migration แบบ additive ต้องรู้จัก ADMIN เดิม (รวม inactive) โดยไม่เปลี่ยน
  Role, รหัสผ่าน หรือสถานะ และต้องกันการ Bootstrap พร้อมกันหลายคำสั่ง
- ระบบต้องห้ามระงับ ADMIN ที่ Active คนสุดท้าย (รวมการแข่งขันพร้อมกัน)
- **Phase 3 status:** CLI Bootstrap แบบ TTY, Protected Admin-create API
  `POST /api/admin/users/admins` พร้อม Role Check, Validation, Audit Log
  และ Transaction Lock ถูก Implement แล้ว
- **Phase 4 status:** หน้า `/admin/users` มีปุ่มเพิ่ม Admin เฉพาะ
  Admin ที่ Login, ฟอร์ม Name/Email/Password/Confirm Password,
  Validation, Confirmation ไม่แสดงรหัสผ่าน, Loading/Error/Success,
  การล้างข้อมูลลับเมื่อยกเลิก และ Refresh รายชื่อหลังสร้างสำเร็จ
- ถ้า POST สร้างสำเร็จแต่ GET Refresh ล้มเหลว ต้องไม่ส่ง POST ซ้ำ
  ให้รักษารายการ Admin ใหม่ไว้ใน Local State และแจ้งสถานะจริง
- UI เป็นเพียงตัวตรวจข้อมูลเพิ่มเติม Backend ต้องบังคับ Role และสิทธิ์จริง
  และ Browser Mock QA ไม่ใช่การรับรอง DB Production
- API ต้องรับเพียง name/email/password, กำหนด Role ADMIN ฝั่ง Backend
  และไม่ส่ง Password Hash ออก; ปฏิเสธ Guest, USER และ Admin ที่ถูกระงับ
- การระงับ/เปิดใช้ Admin ต้องตรวจ Acting Admin ซ้ำใน Transaction เดียวกับ
  การเปลี่ยนสถานะ พร้อม Audit SUCCESS หรือ DENIED และห้ามระงับตนเอง
  หรือ ADMIN คนสุดท้ายที่ Active
- `db:seed` ปรับแล้วให้สร้างเฉพาะบัญชี USER ตัวอย่างที่ยังไม่มี
  และห้ามเปลี่ยนสิทธิ์หรือรหัสผ่านของบัญชีเดิม (รวม ADMIN)
- การรัน SQL migration และ destructive tests ต้องทำเฉพาะหลังตรวจ
  Test Database ที่แยกจากฐานข้อมูลจริงก่อน

### Phase 5 QA (ระบบทดสอบแยก)

Migration ทั้ง Fresh/Legacy, Bootstrap Concurrent, Admin API, Seed Safety,
Audit Rollback และ Dashboard→API→DB ผ่านบน PostgreSQL ชั่วคราว:
Backend 107/107, Admin DB 11/11, Browser 3/3. พบและแก้ Prisma
Advisory Lock คืนค่า `void` แล้ว ระบบจริงไม่ได้ถูก Migration หรือแก้ข้อมูล
Phase 5 ยังไม่ครอบคลุม TTY แต่ Phase 6 ได้ทดสอบ Interactive Docker TTY
ทั้ง Dev/Prod ผ่าน 8/8 บนฐานข้อมูลชั่วคราวแล้ว ไม่มีการ Deploy จริง
ดู `docs/admin-phase5-isolated-qa.md` และ `docs/docker-admin-setup.md`.
ผล Docker CLI 8/8 อยู่ที่ `docs/admin-phase6-docker-qa.md`.

## User Flow หลัก

```text
เข้าเว็บไซต์
    ↓
Register / Login
    ↓
หน้า Map
    ↓
ดูของบริจาค / ลงของบริจาค / Report
    ↓
ดูรายละเอียด / นำทาง
```

สำหรับ `ADMIN`:

```text
ADMIN
  ↓
หน้า Map
  ↓
ใช้งานได้เหมือน USER
  ↓
มีปุ่ม Dashboard เพิ่ม
  ↓
จัดการ Users / Donations / Reports
```

## ระบบหลักของโปรเจกต์

```text
Authentication
    ↓
Map
    ↓
Donation
    ↓
Search / Filter
    ↓
Navigation
    ↓
Report
    ↓
Admin Dashboard
```

> ไฟล์นี้เป็น source of truth ของ scope โปรเจกต์ ห้ามเพิ่มระบบนอกเหนือจากนี้โดยไม่แก้ spec ก่อน
