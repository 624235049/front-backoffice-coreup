# 06 — ลำดับงาน (dev 1 คน)

หลัก: **ทำของที่ร้านนำร่องใช้ได้จริงก่อน** ทุก milestone จบด้วยสิ่งที่ deploy บน staging แล้วคนในทีมลองได้ · 1 milestone ≈ 2–3 สัปดาห์ · รวม ~8 เดือน

ใช้ checkbox ในไฟล์นี้เป็น task list (หรือแปลงเป็น GitHub Issues ทีละข้อ)

---

## M0 — ฐานระบบ (สัปดาห์ 1–2)

- [ ] สร้าง monorepo: pnpm + Turborepo + Biome + tsconfig ร่วม
- [ ] `infra/docker-compose.dev.yml`: postgres 16, redis, minio, mailpit
- [ ] `packages/db`: เขียน Drizzle schema ให้ตรงกับ `docs/12-database-ddl.sql` ทุกคอลัมน์/constraint (ส่วน core ก่อน) แล้ว diff SQL ที่ generate กับ DDL อ้างอิง
- [ ] `packages/db`: Drizzle config, migration แรก (extensions, roles, core tables: users, tenants, branches, positions, roles, memberships, invites, plans, tenant_modules, audit_logs, outbox_events, idempotency_keys, files)
- [ ] RLS helper + test ตรวจว่าทุกตารางที่มี tenant_id เปิด RLS
- [ ] `packages/schema`: errors, pagination, core entities
- [ ] `apps/api`: Hono + env + middleware ครบชุด (requestId, logger, rateLimit, session, tenant, branchScope, permission, moduleGuard, idempotency, error handler) + `/healthz` `/readyz`
- [ ] Auth: อีเมล/รหัสผ่าน + LINE Login + `/v1/me` + invites
- [ ] OpenAPI + `packages/api-client` generate อัตโนมัติ
- [ ] `apps/app`: Vite + Router + Query + shadcn/ui + i18n + AppShell + sign-in + select-tenant + permission/module/terminology helpers
- [ ] `packages/ui`: Tailwind preset สีแบรนด์ (ใช้ร่วม app/web)
- [ ] `packages/templates`: `generic`, `clinic`, `spa`, `salon` (เวอร์ชันแรก) + seed
- [ ] Railway: staging (postgres, redis, api, app) + GitHub Actions CI
- [ ] Sentry ทุก app

**Done เมื่อ:** ล็อกอินบน staging ได้ทั้งอีเมลและ LINE, เห็นเมนูตามสิทธิ์, test tenancy isolation ผ่าน

## M1 — Landing page (สัปดาห์ 3–4)

- [ ] `apps/web` Nuxt + Tailwind preset + ฟอนต์ + i18n + SEO module
- [ ] หน้า `/`, `/platform`, `/pricing`, `/industries/[slug]`, `/how-we-work`, `/about`, `/contact`, `/privacy`, `/terms`
- [ ] Content: `industries/*.yml` (clinic, spa, salon), `pricing.yml`, `faq.yml`
- [ ] เครื่องคิดเงินรั่ว (`packages/domain/leak.ts` + section บนหน้าแรก + `/leak-check`) (13 §12)
- [ ] Lead form + Turnstile → `POST /v1/public/leads` → ตาราง `leads` → แจ้งทีมขาย
- [ ] Cookie consent + GA4 + Meta Pixel + conversion events
- [ ] Deploy `web` บน Railway + โดเมนจริง

**Done เมื่อ:** ทีมขายได้แจ้งเตือนเมื่อมีคนกรอกฟอร์มจริง, Lighthouse ≥ 90

## M2 — CRM + นัด (สัปดาห์ 5–7)

- [ ] ตาราง: customers, services, categories, package_products, customer_packages, appointments, appointment_events, followups
- [ ] `packages/domain`: state machine นัด, availability, rebook due, followup plan (unit test)
- [ ] API: customers, services, packages, appointments, availability, today-board, followups
- [ ] หน้า: `/today`, `/calendar`, ลงนัด, `/customers` + โปรไฟล์ + timeline, `/followups`, `/services`
- [ ] Import CSV ลูกค้า/บริการ
- [ ] Settings: ร้าน สาขา ห้อง ตำแหน่ง terminology
- [ ] `GET /calendar` รวมทุกชั้น (นัด กะ ลา พัก วันหยุด) + มุมมองวัน/ตามคน/ตามห้อง (ดู 08 §3)
- [ ] "ข้อควรรู้" ลูกค้า (ไม่ใช่ข้อมูลการรักษา) + สลับผู้ใช้ด้วย PIN บน iPad ร่วม
- [ ] โหมดร้านเล็ก `uiMode = simple` (08 §8)
- [ ] `impact_events` + แถบ "ระบบช่วยวันนี้" บน `/today` (13 §0–1)
- [ ] `POST /appointments/:id/complete` หนึ่งแตะหลายงาน + กล่อง "ระบบจะทำต่อให้" (13 §3)
- [ ] `baselines`: เริ่มเก็บตัวเลขฐาน 14 วันแรกของทุกร้าน
- [ ] `member_skills` (ตารางทักษะ) + ผู้ดูแลหลัก/สำรองของลูกค้า

**Done เมื่อ:** หน้าร้านลงนัด/เช็กอิน/ปิดงานบน iPad ได้, ระบบสร้างงานติดตามหลังทำเอง

## M3 — LINE OA + LIFF (สัปดาห์ 8–10) ← ร้านนำร่องเริ่มใช้

- [ ] `packages/channels` + provider LINE (push, flex, quota, verify signature)
- [ ] ตาราง: channel_accounts, line_followers, message_templates, message_plans, message_jobs, message_logs
- [ ] หน้า settings เชื่อม LINE OA ของร้าน (ใส่ channel id/secret/token, แสดง webhook URL)
- [ ] Worker: outbox, messages (quiet hours, consent, cancel เมื่อเลื่อน/ยกเลิก), line-webhook, followups cron
- [ ] Postback ยืนยัน/ขอเลื่อน, คำเฝ้าระวังอาการ → งานด่วน
- [ ] LIFF: link, appointments (ยืนยัน/เลื่อน/ยกเลิก), packages, feedback, consent
- [ ] หน้า message templates/plans + preview
- [ ] Production environment บน Railway

**Done เมื่อ:** ร้านนำร่อง 1 ร้านใช้ส่งเตือนนัดจริงครบ 1 สัปดาห์โดยไม่มีข้อความผิด

## M4 — กะ เช็กลิสต์ คู่มือ (สัปดาห์ 11–13)

- [ ] ตาราง shifts, templates, swaps, checklists, runs, sops, acknowledgements
- [ ] หน้า `/shifts` (ตารางเวร), `/me/today`, `/me/schedule`, `/checklists`, `/sops`, `/me/sops`
- [ ] รูปถ่ายในเช็กลิสต์ (upload R2), แจ้งเตือนเช็กลิสต์ค้าง
- [ ] PWA: manifest, install prompt, web push
- [ ] Template: เช็กลิสต์/หน้าที่ต่อกะ ของ clinic/spa/salon
- [ ] ลา + ปฏิทินแจ้งนัดที่กระทบ + เสนอคนแทน (08 §7 ข้อ 1)
- [ ] ปิดวัน + ส่งเวร + สรุปปิดวันเข้า LINE เจ้าของ (08 §5)
- [ ] กล่องอนุมัติ (ลา แลกเวร) + อนุมัติจาก LINE
- [ ] รายงาน "เช้านี้ต้องรู้" + "สรุปปิดวัน" (08 §6) — report definition + subscriptions
- [ ] การ์ดพนักงาน `/me/today` พร้อมรายได้วันนี้และ "ลูกค้าขอคุณ" (13 §4)
- [ ] ความเสี่ยงคนสำคัญ `/team/risk` + what-if + ผู้ดูแลสำรองอัตโนมัติ (13 §5)
- [ ] ขั้นตอนลาออก + ส่งต่อลูกค้าในนามร้าน (13 §6)

**Done เมื่อ:** พนักงานร้านนำร่องใช้มือถือติ๊กเช็กลิสต์ทุกวัน, หัวหน้าเห็นว่าใครทำครบ

## M5 — เสียงพนักงาน + ออดิท (สัปดาห์ 14–17)

- [ ] ตาราง question_bank, surveys, survey_tokens, survey_responses, health_scores, anon_reports, messages
- [ ] คลังคำถาม 7 ด้าน (จากทีมที่ปรึกษา) + wording ตามธุรกิจ
- [ ] หน้าตอบแบบสอบถาม `/s/:token` (ไม่ระบุตัว), แจ้งปัญหา `/r/*`
- [ ] Health score engine (domain) + หน้า `/health`, `/surveys/:id`
- [ ] Anonymity threshold บังคับใน API + test
- [ ] เคสร้องเรียนลูกค้า (รับเรื่อง → คนรับผิดชอบ → ปิด)
- [x] Platform: `/platform/tenants`, impersonate, `/platform/audits` (rubric, findings, action plan), PDF report (worker + Playwright)
- [x] Platform: `/platform/leads` kanban
- [x] Platform: role `platform_owner`, `engagements`, `usage_daily`, `/platform` dashboard (ร้าน active, ลูกค้าในระบบ, ร้านเสี่ยง), รายงานของร้านแบบอ่านอย่างเดียว (09)

**Done เมื่อ:** ออดิทร้านนำร่องได้ครบในระบบ ไม่ใช้ Google Sheets

## M6 — คิว + ค่าตอบแทน (สัปดาห์ 18–22)

- [ ] ตาราง rule_sets, queue_assignments, queue_state, service_records, commission_ledger, payout_periods, statements
- [ ] Domain: queue engine, compensation engine + explain (test ครบทุกตัวอย่างสูตรจากทีมหน้างาน)
- [ ] หน้า `/queue`, `/service-records`, `/rules/*` (ฟอร์ม + ตัวจำลอง), `/payouts`, `/me/earnings`
- [ ] ปิดงวด → statement PDF
- [ ] Waitlist walk-in + จอคิว (`/board/:token`) + SSE อัปเดตสด (08 §4)
- [ ] ส่วนลดต้องมีเหตุผล + เกินเพดานขออนุมัติ
- [ ] นำเข้ายอดรายวันจาก POS เดิม (CSV + column mapping) + จับคู่กับบริการ (11 §3 ระดับ 1–2)
- [ ] โมดูล `checkout` POS-lite: บิลจากนัด/คิว, PromptPay QR, หลายวิธีจ่าย, ใบเสร็จทาง LINE, ลิ้นชักเงิน, void/refund ต้องอนุมัติ (11 §4)
- [ ] 2FA สำหรับ owner/platform

**Done เมื่อ:** ร้านนำร่องปิดงวดค่ามือด้วยระบบ ตัวเลขตรงกับที่คิดมือ 100%

## M7 — KPI + ขายได้ (สัปดาห์ 23–27)

- [ ] KPI catalog + worker คำนวณรายคืน + `kpi_snapshots`
- [ ] หน้า `/kpi` + เทียบสาขา + export PDF/CSV
- [ ] รายงานสัปดาห์/เดือน/พนักงาน/ลูกค้า/การใช้ห้อง (08 §6.2) ส่งเข้า LINE ตาม subscription
- [ ] หน้าแรกตาม role — หน้าเจ้าของเทียบ baseline + impact เดือนนี้ (13 §9)
- [ ] ทดสอบลาพักร้อน + ใบรับรองผล PDF (13 §10)
- [ ] ส่งออกคู่มือร้าน (13 §11)
- [x] Platform: `invoices` (ค่าระบบ + ค่าที่ปรึกษา), `/platform/revenue` (owner เท่านั้น), รายงาน CoreUp ประจำสัปดาห์เข้า LINE
- [ ] Plans/limits + ชำระเงิน (Omise หรือ 2C2P, PromptPay/บัตร) + ใบเสร็จ
- [ ] PDPA: export/erase ลูกค้า, retention job, หน้า privacy ในระบบ
- [ ] Onboarding ร้านใหม่ด้วยตัวเอง (wizard: ธุรกิจ → สาขา → เชิญทีม → เชื่อม LINE)
- [ ] Load test (k6) today-board/calendar/availability, security review (OWASP ASVS L1)

**Done เมื่อ:** เปิดร้านใหม่ได้เองใน 1 วัน และเก็บเงินค่าแพ็กเกจได้

## M8+ — หลังเปิดขาย (เลือกตามความต้องการจริง)

- [ ] Template เพิ่ม: dental, massage, restaurant, nail
- [ ] Booking ออนไลน์เต็มรูปแบบใน LIFF
- [ ] Connector โปรแกรมคลินิก/POS ที่ร้านใช้มากที่สุด
- [ ] โมดูล `ai`: สรุปคำตอบแบบสอบถาม, ร่างรายงาน (ผ่านการตรวจโดยที่ปรึกษา)
- [ ] Public API + outbound webhooks
- [ ] Benchmark ข้ามร้าน
- [ ] Attendance (ลงเวลาเข้างาน)

---

## กติกาการทำงานของ dev คนเดียว

1. **สัปดาห์ละ 1 รอบวางแผน** (จันทร์) กับทีม: เลือกงานจากไฟล์นี้ + bug ที่ส่งมา
2. **ตอบเรื่องทั่วไปวันละ 2 รอบ** 11:00 / 17:00 เรื่องด่วนเท่านั้นที่ขัดได้ (ระบบล่ม, ข้อความผิดถึงลูกค้า)
3. **ใช้ของสำเร็จรูปให้มากที่สุด**: shadcn/ui, Better Auth, BullMQ, Railway managed services
4. **Test เฉพาะที่เสียหายแพง**: tenancy, เงิน, ข้อความถึงลูกค้า, ความไม่ระบุตัวตน — ส่วนอื่น E2E flow หลักพอ
5. **Release staging ทุกวันศุกร์** + changelog สั้น ๆ ในกลุ่มทีม
6. **ใช้ AI ช่วยเขียนโค้ด** โดยให้อ่าน `AGENTS.md` + เอกสารชุดนี้ก่อนทุกครั้ง แล้ว review ทุก diff ที่แตะ RLS, เงิน, auth
