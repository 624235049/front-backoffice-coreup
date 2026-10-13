# front-backoffice-coreup

หลังบ้านทีม CoreUp (React 19 + Vite) — `team.coreup.xxx` · สำหรับ `platform_owner | platform_admin | platform_consultant | platform_sales`

หน้า: `/platform` dashboard · `/platform/tenants` (+ รายละเอียด, เข้าดูแทนร้าน) · `/platform/leads` kanban · `/platform/engagements` (+ board งานตาม playbook 90 วัน) · `/platform/audits` (rubric, findings, แผน 90 วัน, PDF) · `/platform/invoices` · `/platform/revenue` (owner เท่านั้น) · `/platform/team`

```bash
pnpm install
cp .env.example .env       # VITE_API_URL=http://localhost:18787
pnpm gen:api               # types from openapi.json (or API_OPENAPI_URL=http://localhost:18787/v1/openapi.json)
pnpm dev                   # http://localhost:15174
pnpm typecheck && pnpm test && pnpm build
```

ล็อกอินด้วยบัญชีทีม CoreUp (dev: `owner@coreup.local` / `coreup1234`) — ผู้ใช้ที่ไม่มี membership ใน tenant `coreup` จะเห็นหน้า "ไม่มีสิทธิ์"
API ต้องตั้ง `PLATFORM_APP_URL=http://localhost:15174` (CORS + ลิงก์รีเซ็ตรหัสผ่าน/magic link ของทีม CoreUp) และ `APP_URL` ชี้ไปหลังบ้านร้านซึ่งเป็นปลายทางของ "เข้าดูแทนร้าน"

Deploy: Railway service from this repo (`Dockerfile` → Caddy static, `railway.json`).
