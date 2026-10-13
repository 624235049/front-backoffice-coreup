# 04 — เว็บหลังบ้าน (`apps/app`)

React 19 + Vite · SPA + PWA · ใช้ทั้ง **หลังบ้านร้าน** และ **Backoffice ทีม CoreUp** ในแอปเดียว แยกด้วยสิทธิ์

URL: `https://app.coreup.xxx`

---

## 1. Stack

| เรื่อง | ใช้ | หมายเหตุ |
|---|---|---|
| Build | Vite | |
| Routing | TanStack Router (file-based, type-safe search params) | |
| Server state | TanStack Query | cache, optimistic update, retry |
| Client state | Zustand | tenant/branch ปัจจุบัน, UI prefs |
| ฟอร์ม | React Hook Form + `@hookform/resolvers/zod` | schema จาก `packages/schema` |
| UI | Tailwind + shadcn/ui (Radix) | ปรับสีจาก `packages/ui` |
| ตาราง | TanStack Table | sort/filter/pagination ฝั่ง server |
| ปฏิทิน | FullCalendar (resource timeline) หรือเขียนเองบน CSS grid | ตัดสินใน M1 ดูความเร็วบน iPad |
| กราฟ | Recharts | KPI |
| Editor | TipTap หรือ textarea + markdown preview | SOP |
| วันเวลา | `date-fns` + `date-fns-tz` | แสดงตาม timezone ร้าน ไม่ใช่เครื่อง |
| i18n | `i18next` + `react-i18next` | `th` default, `en` |
| API client | `openapi-fetch` + type จาก `packages/api-client` | |
| PWA | `vite-plugin-pwa` | ติดตั้งได้, cache app shell, web push |
| Error | Sentry browser | |
| Test | Vitest + Testing Library, Playwright | |

---

## 2. โครงโฟลเดอร์

```
apps/app/src/
├─ main.tsx
├─ router.tsx
├─ routes/                      # file-based routes (ดู §3)
├─ features/                    # แยกตามโมดูล ตรงกับ API
│  ├─ auth/
│  ├─ tenant/                   # ตั้งค่าร้าน สาขา terminology
│  ├─ members/
│  ├─ customers/
│  ├─ appointments/
│  ├─ followups/
│  ├─ messages/
│  ├─ shifts/
│  ├─ checklists/
│  ├─ sops/
│  ├─ surveys/
│  ├─ anon-reports/
│  ├─ payouts/
│  ├─ kpi/
│  └─ platform/                 # ทีม CoreUp
│     each feature/
│       ├─ api.ts               # query/mutation hooks (useCustomers, useCreateAppointment)
│       ├─ components/
│       ├─ forms/
│       └─ pages/
├─ components/                  # ร่วมทุก feature: DataTable, PageHeader, EmptyState, ConfirmDialog, ...
├─ lib/
│  ├─ api.ts                    # openapi-fetch instance + header X-Tenant-Id/X-Branch-Id
│  ├─ permissions.ts            # can(), <Can>, useCan()
│  ├─ modules.ts                # hasModule(), <ModuleGate>
│  ├─ terminology.ts            # useTerm('customer') → "คนไข้"
│  ├─ format.ts                 # money, date ตาม tenant
│  └─ custom-fields.tsx         # render/form ของ custom fields
├─ stores/session.ts            # tenantId, branchId (persist localStorage แบบ try/catch)
├─ i18n/{th,en}.json
└─ pwa/
```

### 2.1 ข้อตกลงที่ implement แล้ว (M0) — ฟีเจอร์ใหม่ต้องทำตามนี้

- **เมนู**: แต่ละ feature มี `features/<x>/nav.ts` export `navItems: NavItem[]` (`{ to, labelKey: 'nav:xxx', icon, permission?, anyPermission?, module?, section?, order?, advanced? }`) ระบบรวมให้อัตโนมัติด้วย `import.meta.glob` ไม่ต้องแก้ไฟล์กลาง · `advanced: true` = ซ่อนในโหมดร้านเล็ก (08 §8) · แท็บในหน้า `/settings/*` เพิ่มด้วย `features/<x>/settings-tabs.ts` (`settingsTabs: NavItem[]`)
- **i18n**: ไฟล์ `src/locales/{th,en}/<namespace>.json` (ชื่อไฟล์ = namespace, โหลดอัตโนมัติ) ใช้ `const { t } = useT('ns')` จาก `lib/terminology` — `t()` ใส่ตัวแปร `{{customer}} {{appointment}} …` จาก terminology ให้เองเสมอ
- **Route**: ไฟล์บาง ๆ ใน `src/routes/_app/...` ที่ import หน้าจาก `features/<x>/pages` · หลังเพิ่ม route รัน `pnpm --filter @coreup/app gen:routes` (หรือ `typecheck`/`dev`) เพื่อ regenerate `routeTree.gen.ts`
- **Data**: hook อยู่ใน `features/<x>/api.ts` ใช้ `useTenantQuery([part…], () => unwrap(api.GET(...)))` (key = `[tenantId, …]`) และ `useApiMutation` (toast error อัตโนมัติ) + `useInvalidate()('part')` · response เดี่ยวเป็น `{ data }` ใช้ `unwrapData` · ประเภทข้อมูลดึงจาก OpenAPI ผ่าน `ApiData/ApiBody/ApiItem/ListItem` ใน `lib/api.ts` (แอปนี้ห้าม import `@coreup/schema` หรือ package หลังบ้านอื่น)
- **หน้าจอ**: ใช้ `<QueryState>` (loading / error+retry+requestId / empty) ทุกหน้า · ฟอร์มใช้ React Hook Form + zod ที่ประกาศในหน้านั้น ข้อความ error เป็น i18n key `validation.*`
- **สิทธิ์/โมดูล/คำเรียก**: `useCan('x:write')`, `<Can permission module>`, `useModule('crm')`, `useTerm('customer')`, `<Term k="appointment"/>`, `useTenant()`, `useMembership()` (ใช้ได้ภายใต้ `_app` เท่านั้น)

---

## 3. Route map

Layout: `/_auth/*` (ไม่ต้องล็อกอิน), `/_app/*` (ต้องล็อกอิน + เลือก tenant), `/_platform/*` (ทีม CoreUp)

| Route | หน้า | สิทธิ์ / โมดูล | อุปกรณ์หลัก |
|---|---|---|---|
| `/sign-in` | ล็อกอิน (อีเมล / LINE) | — | ทุกแบบ |
| `/invite/:token` | รับคำเชิญ | — | มือถือ |
| `/select-tenant` | เลือกร้าน (ถ้ามีหลายร้าน) | — | |
| `/` | หน้าแรก **ตาม role** (ดู §4) | — | |
| `/today` | บอร์ดวันนี้ของสาขา | appointments:read · crm | iPad |
| `/calendar` | ปฏิทินนัด (วัน/สัปดาห์, แยกคน/ห้อง) | appointments:read · crm | iPad/คอม |
| `/appointments/new` · `/:id` | ลงนัด / รายละเอียด | appointments:write | |
| `/customers` · `/:id` | รายชื่อ / โปรไฟล์ + timeline | customers:read | |
| `/followups` | งานติดตามวันนี้ | followups:read · crm | |
| `/messages/templates` · `/plans` · `/log` | ข้อความ / จังหวะส่ง / ประวัติ | messages:templates | คอม |
| `/services` · `/packages` | บริการ / คอร์ส | services:write | คอม |
| `/me/today` | การ์ดหน้าที่ของฉัน + เช็กลิสต์ + เคสที่ต้องติดตาม | — | มือถือ |
| `/me/schedule` | เวรของฉัน, ขอแลกกะ | shifts:read:own | มือถือ |
| `/me/earnings` | รายได้ของฉัน | payouts:read:own · payouts | มือถือ |
| `/me/sops` | คู่มือที่ต้องอ่าน | sops:read · sop | มือถือ |
| `/shifts` | ตารางเวรสาขา (ลากวาง) | shifts:write · shifts | คอม/iPad |
| `/checklists` · `/:id/edit` · `/runs` | เช็กลิสต์ / แก้ไข / ผลรายวัน | checklists:* | |
| `/sops` · `/:id/edit` | จัดการคู่มือ | sops:write · sop | คอม |
| `/team` · `/team/:id` | พนักงาน | members:read | |
| `/team/org-chart` | ผังองค์กร | members:read | คอม |
| `/surveys` · `/:id` | รอบแบบสอบถาม + ผล | surveys:results · surveys | คอม |
| `/health` | คะแนนสุขภาพองค์กร D1–D7 | surveys:results | คอม |
| `/reports` · `/:id` | เรื่องที่แจ้งเข้ามา | anon_reports:read · reports | |
| `/queue` | คิวถัดไป + จ่ายคิว | service_records:write · payouts | iPad |
| `/service-records` | บันทึกบริการ | service_records:read · payouts | |
| `/payouts` · `/periods/:id` | สรุปค่ามือ / ปิดงวด | payouts:read · payouts | คอม |
| `/rules/queue` · `/rules/compensation` | ตั้งกติกา (มีตัวจำลอง) | rules:write | คอม |
| `/kpi` | Dashboard | kpi:read · kpi | คอม/มือถือ |
| `/settings/*` | ร้าน สาขา ห้อง ตำแหน่ง role terminology custom fields LINE OA แพ็กเกจ | tenant:write | คอม |
| `/platform` | ภาพรวมธุรกิจ CoreUp | platform:* | คอม |
| `/platform/tenants` · `/:id` | ร้านลูกค้า, โมดูล, impersonate | platform_admin | |
| `/platform/leads` | CRM การขาย (kanban 6 stage) | platform_sales | |
| `/platform/audits` · `/:id` | ออดิท: rubric, findings, แผน 90 วัน, สร้างรายงาน | platform_consultant | |
| `/platform/templates` · `/question-bank` · `/plans` | ตั้งค่ากลาง | platform_admin | |

เมนูด้านข้างสร้างจาก config เดียว (`navigation.ts`) กรองด้วย `can()` + `hasModule()` → ร้านที่ไม่ได้ซื้อโมดูลจะไม่เห็นเมนู (หรือเห็นแบบล็อกพร้อมปุ่ม "ติดต่อ CoreUp" — ตั้งค่าได้)

---

## 4. หน้าแรกตาม role

| Role | `/` redirect หรือแสดง |
|---|---|
| owner | `/kpi` summary: ตัวเลขหลักเทียบเดือนก่อน, คะแนนสุขภาพ, เรื่องที่แจ้งค้าง, สาขาที่เช็กลิสต์ไม่ครบ |
| branch_manager | สรุปสาขาวันนี้: นัด, ยืนยันแล้ว/ยัง, งานติดตามด่วน, เช็กลิสต์, ใครเข้ากะ |
| front_desk | `/today` |
| practitioner / staff | `/me/today` |
| platform_* | `/platform` |

---

## 5. หน้าจอหลัก (spec ย่อ)

### 5.1 `/today` — บอร์ดเคาน์เตอร์ (iPad แนวนอน)

- ซ้าย: timeline นัดวันนี้ (คอลัมน์ต่อพนักงานหรือห้อง) สีตามสถานะ: booked เทา, confirmed เขียว, reschedule_requested ส้ม, checked_in น้ำเงิน, no_show แดง
- ขวาบน: "ต้องโทรเช็ก" = นัดภายใน 24 ชม. ที่ยังไม่ยืนยัน
- ขวากลาง: "คิวถัดไป" (ถ้าเปิด payouts) จาก `/queue/next`
- ขวาล่าง: ปุ่มใหญ่ `+ ลงนัด`, `Walk-in`
- แตะนัด → sheet ด้านข้าง: เปลี่ยนสถานะ, เช็กอิน, เลื่อน, ส่งข้อความ
- refresh อัตโนมัติทุก 30 วินาที (ภายหลังเปลี่ยนเป็น SSE)

### 5.2 ลงนัด (dialog)

ลำดับ: ค้นหาลูกค้า (ชื่อ/เบอร์) หรือสร้างใหม่ → บริการ → วัน/เวลาจาก `/availability` → พนักงาน (ถ้าเลือก) → ใช้คอร์ส? → บันทึก
แสดงตัวอย่างข้อความ LINE ที่ลูกค้าจะได้ ก่อนกดบันทึก

### 5.3 โปรไฟล์ลูกค้า

หัว: ชื่อ, tag, LINE ผูกแล้ว/ยัง, ความยินยอม, คนดูแลหลัก · แท็บ: Timeline · นัด · คอร์ส · ข้อความ · ข้อมูลเพิ่ม (custom fields)

### 5.4 `/me/today` — พนักงาน (มือถือ, ปุ่มใหญ่)

1. การ์ดกะ: เวลา, หน้าที่ (duties) ของกะนี้
2. เช็กลิสต์ที่ต้องทำ (ติ๊ก / ถ่ายรูป)
3. ลูกค้าของฉันวันนี้
4. เคสที่ต้องติดตาม (กดส่งข้อความสำเร็จรูป / บันทึกผล)
5. แถบล่าง: วันนี้ · เวร · รายได้ · คู่มือ · เพิ่มเติม (แจ้งปัญหา, แบบสอบถาม)

### 5.5 ตั้งกติกา `/rules/*`

- ฟอร์มแบบเลือกข้อ (ไม่ต้องเขียน JSON): เช่น คิว = "เวียนตามลำดับ" + "ลูกค้าขอคนเดิม → ให้คนเดิม (ไม่นับรอบ)" + "ต้องมีทักษะบริการนั้น"
- **ตัวจำลอง**: ใส่เหตุการณ์ตัวอย่าง → ดูผลก่อนบันทึก (`/compensation/simulate`)
- แสดงประวัติเวอร์ชัน + วันเริ่มมีผล

### 5.6 แบบสอบถาม `/surveys/:id`

ผลแสดงเป็นคะแนนต่อด้านและต่อคำถาม; กลุ่มที่ตอบไม่ถึงเกณฑ์แสดง "ไม่พอแสดงผล" — **ห้ามมีการกรองที่ทำให้เหลือกลุ่มเล็กกว่าเกณฑ์** (API บังคับอยู่แล้ว หน้าบ้านต้องไม่มีปุ่มนั้นด้วย)

### 5.7 `/kpi`

แถวบน 4–6 ตัวเลขหลัก (เทียบงวดก่อน + ลูกศร) · กราฟแนวโน้ม · ตารางเทียบสาขา · เลือกช่วง/สาขา · ปุ่ม export PDF

### 5.8 Platform: ออดิท

ขั้นตอนแบบ wizard: โปรไฟล์องค์กร → ส่งแบบสอบถาม → ให้คะแนน rubric ต่อด้าน (เกณฑ์แสดงข้างช่อง) → findings → แผน 90 วัน → ตัวอย่างรายงาน → สร้าง PDF

---

## 6. รูปแบบที่ใช้ซ้ำ

| Component | ใช้ทำ |
|---|---|
| `AppShell` | sidebar (คอม) / bottom nav (มือถือ) + tenant/branch switcher |
| `BranchSwitcher` | เลือกสาขา หรือ "ทุกสาขา" (เฉพาะคนที่มีสิทธิ์หลายสาขา) |
| `DataTable` | ตาราง server-side + filter bar + saved views |
| `EntityForm` | ฟอร์มจาก Zod + custom fields ต่อท้ายอัตโนมัติ |
| `StatusBadge` | สถานะ (สี + ข้อความ ไม่ใช้สีอย่างเดียว) |
| `Can`, `ModuleGate` | ซ่อน/ล็อกตามสิทธิ์และโมดูล |
| `Term` | `<Term k="customer" />` แสดงคำตาม terminology |
| `Money`, `DateTime` | format ตาม tenant |
| `EmptyState` | บอกว่าหน้านี้จะมีอะไร + ปุ่มเพิ่มรายการแรก |
| `ImpersonationBanner` | แถบเตือนเมื่อทีม CoreUp เข้าดูร้าน |

**ห้าม** เขียนคำว่า "คนไข้", "หัตถการ", "เทอราพิสต์" ตรง ๆ ในโค้ด ให้ใช้ `t()` + `useTerm()` เสมอ

---

## 7. ข้อมูลและ state

- Query key รูปแบบ `[tenantId, 'appointments', params]` → เปลี่ยนร้าน = cache แยกอัตโนมัติ
- Mutation ที่ผู้ใช้กดบ่อย (ติ๊กเช็กลิสต์, เปลี่ยนสถานะนัด) ใช้ optimistic update + rollback
- เก็บ `tenantId`, `branchId`, ตัวกรองล่าสุด ใน localStorage (ห่อ try/catch) — **ห้าม** เก็บข้อมูลลูกค้าใน localStorage
- ออฟไลน์ชั่วคราว: แสดงแถบ "ออฟไลน์" และ queue การติ๊กเช็กลิสต์ไว้ส่งเมื่อเน็ตกลับ (อย่างอื่นต้องออนไลน์)

## 8. PWA และการแจ้งเตือน

- manifest: ชื่อ "CoreUp", ไอคอนจากโลโก้ (U + ลูกศร), `display: standalone`, theme `#0B2D4F`
- service worker: cache app shell + ฟอนต์ ไม่ cache ข้อมูล API ที่เป็นข้อมูลส่วนบุคคล
- Web Push (VAPID): นัดใหม่, เรื่องด่วน, เช็กลิสต์ค้าง → endpoint `POST /v1/push-subscriptions`
- iPhone รับ push ได้เฉพาะเมื่อเพิ่มลงหน้าจอหลัก → มีหน้าแนะนำวิธีเพิ่ม และ **ส่งซ้ำทาง LINE เสมอสำหรับเรื่องด่วน**

## 9. คุณภาพ

- รองรับจอ 360px ขึ้นไป, iPad แนวนอน/ตั้ง, คอม 1280+
- ทดสอบหลักบน Safari iPadOS, Safari iOS, Chrome Android, Chrome desktop
- Accessibility: ปุ่ม ≥ 44px, focus มองเห็น, label ทุก input, contrast AA
- Bundle: แยกไฟล์ตาม route, หน้าแรกมือถือ < 200KB gzip
- ทุกหน้ามี loading skeleton, empty state, error state (พร้อมปุ่มลองใหม่ + requestId)
