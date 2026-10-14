# front-backoffice-coreup

> Repo นี้เป็น 1 ใน 4 repo ของระบบ CoreUp (ดู `docs/README.md` และ README ของโฟลเดอร์แม่)

## ขอบเขต repo

หลังบ้านทีม CoreUp (React 19 + Vite + TanStack Router/Query + shadcn/ui) ที่ `team.coreup.xxx` สำหรับ role `platform_owner | platform_admin | platform_consultant | platform_sales` เท่านั้น: `/platform` (dashboard), `/platform/tenants`, `/platform/leads`, `/platform/engagements`, `/platform/audits`, `/platform/invoices`, `/platform/revenue`, `/platform/team` และบัญชีบริษัท CoreUp เอง `/accounting/*` (สิทธิ์ `platform:accounting`) เป็น repo อิสระ **ไม่ import โค้ด backend** — type ของ API มาจาก `openapi.json` → `pnpm gen:api` → `src/lib/api-client/openapi.d.ts` (ห้ามประกาศ type ของ API ซ้ำเอง) ไม่ทำหน้าของร้าน (อยู่ใน `front-backoffice-shop`) — "เข้าดูแทนร้าน" เปิด `APP_URL` ของหลังบ้านร้านพร้อม token 60 นาที (`POST /v1/platform/tenants/:id/impersonate`)

ทุกหน้าส่ง `X-Tenant-Id` = tenant `coreup` (membership ของทีม CoreUp); สิทธิ์ใช้ `platform:*` และ role (ดู `docs/09-roles-and-platform.md`): revenue/ทีม เฉพาะ `platform_owner`, ที่ปรึกษาเห็นเฉพาะร้านที่ได้รับมอบหมาย

กฎในส่วนล่างที่พูดถึง `packages/*`, DB, worker ใช้กับ repo `coreup-api`; ที่ใช้ที่นี่คือ: i18n th/en ทุกข้อความ, เงินเป็นสตางค์, ทุกหน้ามี loading/empty/error, feature folder ตาม `docs/04-backoffice.md` §2

---

# AGENTS.md — คำสั่งสำหรับ AI ที่ช่วยเขียนโค้ดใน repo นี้ (กฎกลางของทั้งระบบ)

> วางไฟล์นี้ที่ root ของ repo (ถ้าใช้ Claude Code ให้ copy เป็น `CLAUDE.md` ด้วย) และวางเอกสาร spec ทั้งหมดไว้ที่ `docs/`

## ก่อนเริ่มงานทุกครั้ง

1. อ่าน `docs/README.md` และไฟล์ spec ที่เกี่ยวกับงาน (API → `docs/02-api.md` + `docs/03-database.md`, หน้าบ้าน → `docs/04-backoffice.md`, landing → `docs/01-landing.md`)
2. อ่าน `docs/05-extensibility.md` §10 (checklist) ก่อนออกแบบฟีเจอร์ใหม่
3. ดูว่างานอยู่ใน milestone ไหนใน `docs/06-roadmap.md` — อย่าทำของ milestone ถัดไปถ้าไม่ได้ถูกขอ

## Stack (ห้ามเปลี่ยนโดยไม่ถาม)

TypeScript strict · pnpm + Turborepo · Biome · API: Hono + Zod + `@hono/zod-openapi` · DB: PostgreSQL 16 + Drizzle · Queue: BullMQ + Redis · Auth: Better Auth + LINE Login · หลังบ้าน: React 19 + Vite + TanStack Router/Query/Table + Zustand + React Hook Form + shadcn/ui + Tailwind + i18next · Landing/LIFF: Nuxt + Nuxt Content + Tailwind · Test: Vitest + Playwright · Deploy: Railway

## บริบทธุรกิจ (อ่านก่อนออกแบบอะไร)

CoreUp เป็นบริษัทที่ปรึกษา ระบบคือเครื่องมือที่ทิ้งไว้ให้ร้าน ทุกฟังก์ชันต้องผ่าน checklist ใน `docs/13-feature-specs.md` §13 (ลดงานจริง · เห็นว่าช่วยอะไร · เทียบ baseline · ≤ 3 แตะ · พนักงานได้ประโยชน์)

## Schema

`docs/12-database-ddl.sql` คือแหล่งความจริงของฐานข้อมูล Drizzle schema ต้องตรงทุกคอลัมน์และ constraint (composite FK `(tenant_id, id)`, CHECK, exclusion, unique) ถ้าต้องเปลี่ยน schema ให้แก้ DDL อ้างอิงใน PR เดียวกัน

## กฎที่ห้ามละเมิด

1. **ทุกตารางข้อมูลร้านต้องมี `tenant_id` + เปิด RLS + policy** และเพิ่มเข้า test tenancy
2. **ทุก DB access ใน request ต้องอยู่ใน `withTenantTx()`** ห้ามใช้ `db` ตรง ๆ ใน handler
3. **API ต่อ DB ด้วย role `coreup_app` เท่านั้น** ห้ามใช้ superuser ใน runtime
4. **ทุก route ต้องประกาศ `permission` และ `module`** (ยกเว้น public/liff/webhook ที่ประกาศ `public: true`)
5. **ห้าม hardcode คำเฉพาะธุรกิจ** ("คนไข้", "หัตถการ", "เทอราพิสต์", "นวด") ในโค้ด UI/ข้อความ ใช้ terminology + template + i18n
6. **ตรรกะคำนวณอยู่ใน `packages/domain`** เป็น pure function + unit test (คิว, ค่ามือ, คะแนน, KPI, availability, เวลาส่งข้อความ)
7. **เงินเป็น integer หน่วยสตางค์** ห้ามใช้ float
8. **เวลาเก็บ UTC** คำนวณ/แสดงตาม `tenant.timezone` ด้วย date-fns-tz
9. **แบบสอบถามและแจ้งปัญหาต้องไม่ระบุตัวตนจริง** ห้ามเชื่อม response กับ membership/user, ห้ามเก็บ IP, เคารพ anonymity threshold
10. **ข้อมูลอ่อนไหว** (เบอร์ อีเมลลูกค้า token LINE) เข้ารหัสด้วย `encrypt/decrypt/hmac` จาก `@coreup/db` (`packages/db/src/crypto.ts`) ห้ามเก็บข้อมูลการรักษา
11. **ข้อความถึงลูกค้าต้องผ่าน worker** + ตรวจ consent + quiet hours + idempotency ห้ามส่ง LINE จาก request handler ตรง ๆ
12. **การเปลี่ยนข้อมูลที่คนอื่นสนใจ ต้อง emit outbox event** ใน transaction เดียวกัน
13. **กติกาที่ร้านต่างกันได้ = ข้อมูล (rule_sets / templates)** ไม่ใช่ `if (industry === 'spa')`
14. Schema request/response อยู่ใน `packages/schema` ใช้ร่วม API + หน้าบ้าน ห้ามประกาศ type ซ้ำ
15. **งานที่ระบบทำแทนคนต้องบันทึก `impact_events`** (ใน transaction เดียวกัน) เพื่อแสดง "ระบบช่วยอะไรไปแล้ว"
16. **ข้อมูลเงินและประวัติเป็น append-only** (`commission_ledger`, `appointment_events`, `audit_logs`) แก้ด้วยรายการปรับ ไม่ update/delete แถวเดิม

## รูปแบบโค้ด

- API module: `routes.ts` → `service.ts` → `repo.ts`
- ชื่อ: ตาราง `snake_case` พหูพจน์, JSON `camelCase`, event `entity.past_tense`, permission `resource:action`
- Error: throw `AppError(code, httpStatus, details)` ด้วย code จาก `packages/schema/src/errors.ts`
- หน้าบ้าน: feature folder ตาม `docs/04-backoffice.md` §2, hook ข้อมูลอยู่ใน `features/<x>/api.ts`
- ทุกหน้ามี loading / empty / error state
- Migration: `pnpm db:generate` แล้ว **แสดง SQL ที่สร้างให้ผู้ใช้ดูก่อน** ห้ามแก้ migration ที่ merge แล้ว

## ก่อนบอกว่างานเสร็จ

```bash
pnpm biome check --write
pnpm typecheck
pnpm test
```

- ถ้าแก้ API: อัปเดต OpenAPI snapshot + `docs/02-api.md` ถ้า endpoint เปลี่ยน
- ถ้าแก้ DB: อัปเดต `docs/03-database.md`
- สรุปให้ผู้ใช้: ทำอะไร, ไฟล์ไหน, migration อะไร, ต้องตั้ง env อะไรเพิ่ม, test อะไรที่ยังไม่มี

## สิ่งที่ต้องถามผู้ใช้ก่อนทำ

- เพิ่ม dependency ใหม่ที่ไม่อยู่ใน stack
- เปลี่ยน schema ที่ลบ/เปลี่ยนชื่อคอลัมน์
- อะไรก็ตามที่แตะ RLS, auth, การเข้ารหัส, การคำนวณเงิน, การไม่ระบุตัวตน
- deploy production

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
