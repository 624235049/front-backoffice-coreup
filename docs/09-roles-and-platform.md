# 09 — บทบาทผู้ใช้ และหลังบ้านของ CoreUp (Platform)

โมเดลธุรกิจ: **CoreUp เข้าไปเป็นที่ปรึกษา (consult) และขายระบบไปด้วย** ลูกค้าหนึ่งร้านจึงมี 2 อย่างผูกกันเสมอ

1. **งานที่ปรึกษา** (engagement) เช่น ออดิท 4 สัปดาห์, วางระบบ 3–6 เดือน
2. **การใช้ระบบ** (subscription) เช่น แพ็กเกจรายเดือนต่อสาขา

ระบบต้องให้ทีม CoreUp เห็นทั้งสองอย่างของทุกร้านในที่เดียว

---

## 1. บทบาททั้งหมด: 2 ชั้น รวม 9 บทบาท

### ชั้นที่ 1 — ฝั่ง CoreUp (Platform) 4 บทบาท

| Role | ใคร | เห็นอะไร | ทำอะไรได้ |
|---|---|---|---|
| `platform_owner` | เจ้าของ/ผู้บริหาร CoreUp | **ทุกร้าน ทุกรายงาน** ทั้งตัวเลขรวมของ CoreUp และรายงานของแต่ละร้าน | ทุกอย่าง + ตั้งค่าทีม CoreUp + ดูการเงินของ CoreUp |
| `platform_admin` | ทีมปฏิบัติการ / dev | ทุกร้าน (ข้อมูลระบบ) | เปิด/ปิดร้าน, แพ็กเกจ, template, คลังคำถาม, แก้ปัญหาระบบ |
| `platform_consultant` | ที่ปรึกษา | **เฉพาะร้านที่ได้รับมอบหมาย** | ออดิท, ให้คะแนน, รายงาน, ตั้งค่าระบบให้ร้าน, ดูรายงานของร้านนั้น |
| `platform_sales` | ทีมขาย | **ทุกร้าน** (เปิดดู/สร้างร้าน/ตั้งแพ็กเกจให้ร้านได้ — `platform:write` + `platform:impersonate`) + lead ทั้งหมด + ออดิท | CRM การขาย, เปลี่ยน lead เป็นร้าน, บันทึกค่าใช้จ่ายและผู้ติดต่อบัญชีบริษัท (`platform:expenses`) — **ไม่เห็นรายได้/ใบแจ้งหนี้ร้าน/กำไรขาดทุน/ภาษี/ทีม/นิยามแพ็กเกจ** (ไม่มี `platform:revenue` `billing` `manage` `accounting`) |

### ชั้นที่ 2 — ฝั่งร้านลูกค้า (Tenant) 5 บทบาทสำเร็จรูป

| Role | ใคร | เห็นอะไร |
|---|---|---|
| `owner` | เจ้าของร้าน | ทุกสาขาของร้านตัวเอง ทุกรายงาน (แบบสอบถามเห็นแค่ผลรวม) |
| `branch_manager` | หัวหน้าสาขา | สาขาที่ดูแล |
| `front_desk` | หน้าร้าน / แอดมิน | นัด ลูกค้า คิว ของสาขา |
| `practitioner` | คนให้บริการ (หมอ พยาบาล เทอราพิสต์ ช่าง) | งาน ลูกค้า รายได้ ของตัวเอง |
| `staff` | พนักงานทั่วไป (แม่บ้าน ผู้ช่วย) | กะ เช็กลิสต์ คู่มือ ของตัวเอง |

ร้านสร้าง role เพิ่มเองได้ (เช่น "ผู้จัดการเขต" ดูได้ 3 สาขา) โดยเลือก permission จากรายการใน 02 §4.2

> ทุกคนในร้าน ไม่ว่า role ไหน ตอบแบบสอบถามและแจ้งปัญหาแบบไม่ระบุชื่อได้เสมอ

---

## 2. `platform_owner` ดูรายงานทั้งหมดได้ไหม — ได้ แต่มีชั้น

| ชั้นข้อมูล | platform_owner เห็นไหม | วิธีเห็น |
|---|---|---|
| ตัวเลขรวมของ CoreUp (จำนวนร้าน ลูกค้า รายได้) | ✅ ทันที | `/platform` dashboard |
| รายงานของแต่ละร้าน (KPI, ปิดวัน, สรุปเดือน, คะแนนสุขภาพ) | ✅ ทันที แบบอ่านอย่างเดียว | `/platform/tenants/:id/reports` |
| ข้อมูลรายคนในร้าน (ชื่อลูกค้า เบอร์ ประวัตินัด, รายได้รายคนของพนักงาน) | ✅ แต่ต้อง **เข้าดูแทนร้าน (impersonate)** พร้อมกรอกเหตุผล | ระบบบันทึกทุกครั้ง ร้านเห็นประวัติได้ |
| คำตอบแบบสอบถามรายคน / ตัวตนผู้แจ้งปัญหา | ❌ ไม่มีใครเห็น รวมถึง CoreUp | ระบบออกแบบให้ไม่มีข้อมูลนี้ |

เหตุผล: ร้านไว้ใจให้ CoreUp ดูข้อมูลเพื่อช่วยงาน แต่ต้องตรวจสอบย้อนหลังได้ และพนักงานต้องมั่นใจว่าไม่มีใครรู้ว่าใครตอบอะไร (หัวใจของงานที่ปรึกษา)

---

## 3. Platform dashboard (`/platform`) — "ตอนนี้มีลูกค้ากี่คนใช้งานอยู่"

### 3.1 ตัวเลขหลัก (ทุกตัวกดดูรายละเอียดได้)

| ตัวเลข | นิยาม |
|---|---|
| **ร้านที่ใช้งานอยู่ (active tenants)** | `tenants.status = 'active'` และมีคนล็อกอินใน 14 วันล่าสุด |
| ร้านทั้งหมดแยกสถานะ | trial · active · paused · closed |
| สาขาที่ใช้งาน | จำนวน branch ของร้าน active |
| ผู้ใช้ที่ใช้งาน (พนักงานร้าน) | member ที่ล็อกอินใน 7 / 30 วัน |
| ลูกค้าของร้านทั้งหมดในระบบ | จำนวน customers (ไม่ลบ) รวมทุกร้าน |
| ลูกค้าที่ผูก LINE แล้ว | `line_user_id is not null` |
| นัดที่ผ่านระบบ | สัปดาห์นี้ / เดือนนี้ |
| ข้อความ LINE ที่ส่ง | เดือนนี้ |
| **รายได้ CoreUp** | ค่าระบบรายเดือนรวม (MRR) + รายได้งานที่ปรึกษาเดือนนี้ |
| ร้านเสี่ยงเลิกใช้ | ใช้งานลดลง > 50% จาก 4 สัปดาห์ก่อน หรือไม่มีนัดใหม่ 7 วัน |

### 3.2 ตารางร้าน (`/platform/tenants`)

คอลัมน์: ร้าน · ธุรกิจ · สาขา · แพ็กเกจ · งานที่ปรึกษาปัจจุบัน + วันจบ · ที่ปรึกษาที่ดูแล · ผู้ใช้ active · นัดสัปดาห์นี้ · คะแนนสุขภาพล่าสุด · no-show เดือนนี้ · **สถานะการใช้งาน** (ดี / ลดลง / เสี่ยง) · ต่ออายุเมื่อไร

### 3.3 หน้าร้าน (`/platform/tenants/:id`)

แท็บ: ภาพรวม · งานที่ปรึกษา (ออดิท, แผน 90 วัน, ความคืบหน้า) · การใช้ระบบ (ใครใช้ ใช้อะไร) · รายงานของร้าน · การเงิน (ใบแจ้งหนี้, ชำระแล้ว/ค้าง) · ประวัติการเข้าดู (audit log) · บันทึกทีม

### 3.4 รายงานของ CoreUp เอง (ส่ง LINE ให้ platform_owner ทุกจันทร์)

ร้านใหม่ · ร้านเลิก · MRR · งานที่ปรึกษาที่จะจบใน 30 วัน (โอกาสขายต่อ) · ร้านเสี่ยง 5 อันดับ · lead ในแต่ละขั้น

---

## 4. ข้อมูลที่ต้องเพิ่ม (เติมจาก 03)

**`engagements`** — งานที่ปรึกษา
`id, tenant_id, type ('health_check'|'reset'|'small_shop_setup'|'workshop'|'retainer'), status ('proposed'|'active'|'completed'|'cancelled'), starts_on, ends_on, fee_minor, billing ('one_time'|'monthly'), lead_consultant_user_id, sold_by_user_id, audit_id, notes`

**`invoices`** — ใบแจ้งหนี้ของ CoreUp ถึงร้าน
`id, tenant_id, source ('subscription'|'engagement'), source_id, number, amount_minor, vat_minor, issued_on, due_on, paid_at, status, file_id`

**`usage_daily`** — สรุปการใช้งานรายวันต่อร้าน (worker คำนวณทุกคืน ใช้ทำ dashboard เร็ว)
`tenant_id, date, active_members, logins, appointments_created, appointments_completed, messages_sent, checklists_done, customers_total, customers_line_linked`

**`platform_assignments`** มีแล้ว (ที่ปรึกษา/เซล ↔ ร้าน)

ปรับ `leads.converted_tenant_id` + สร้าง `engagements` แรกตอน convert → ทีมขายเห็นว่าดีลไหนกลายเป็นงานและรายได้เท่าไร

---

## 5. API เพิ่ม (prefix `/v1/platform`)

| Method | Path | role |
|---|---|---|
| GET | `/platform/overview` | owner, admin (consultant/sales ได้เฉพาะตัวเลขของร้านที่ดูแล) |
| GET | `/platform/tenants?status=&health=&consultant=` | owner, admin, consultant (เฉพาะที่ดูแล) |
| GET | `/platform/tenants/:id/summary` | ตามสิทธิ์ข้างบน |
| GET | `/platform/tenants/:id/reports/:key?period=` | owner, admin, consultant ที่ดูแล |
| GET | `/platform/tenants/:id/usage?from=&to=` | owner, admin, consultant |
| GET/POST/PATCH | `/platform/engagements` | owner, consultant, sales |
| GET/POST/PATCH | `/platform/invoices` | owner, admin |
| GET | `/platform/revenue?from=&to=` | **owner เท่านั้น** |
| GET/POST/PATCH | `/platform/team` | owner — จัดการทีม CoreUp และ role |

การอ่านรายงานของร้านผ่าน platform ใช้ role DB `coreup_platform` (ข้าม RLS) **เฉพาะใน service `platform/reports`** และบันทึก `audit_logs` (`actor_type = 'platform'`, ไม่ต้องกรอกเหตุผลสำหรับรายงานสรุป, ต้องกรอกเหตุผลเมื่อ impersonate)

---

## 6. ร้านเห็นอะไรเกี่ยวกับ CoreUp

ในเว็บหลังบ้านของร้าน เมนู **"CoreUp"** (เฉพาะ owner):

- งานที่ปรึกษาปัจจุบัน + แผน 90 วัน + ความคืบหน้า
- ที่ปรึกษาที่ดูแล + ช่องทางติดต่อ
- แพ็กเกจระบบ + ใบแจ้งหนี้
- **ประวัติว่าทีม CoreUp เข้าดูข้อมูลร้านเมื่อไร ใคร เพราะอะไร** (สร้างความไว้ใจ)
- ปุ่มปิดการเข้าถึงของ CoreUp ชั่วคราว (ยกเว้นข้อมูลที่ต้องใช้คิดค่าบริการ)
