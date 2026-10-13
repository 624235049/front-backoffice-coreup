# 07 — Deploy บน Railway

เริ่มทุกอย่างที่ Railway เพื่อให้ dev คนเดียวดูแลได้ ไม่ต้องจัดการเซิร์ฟเวอร์เอง ย้ายไป AWS/GCP ภายหลังได้เพราะทุก service เป็น Docker + Postgres มาตรฐาน

## 1. โครง Railway project

Project: `coreup` · Environments: `staging`, `production` (แยกตัวแปรและฐานข้อมูลกัน) · Region: **Southeast Asia (Singapore)** ใกล้ไทยที่สุด

| Service | Source | Start | Domain |
|---|---|---|---|
| `postgres` | Railway PostgreSQL template | — | private network เท่านั้น |
| `redis` | Railway Redis template | — | private network เท่านั้น |
| `api` | repo, root `/`, Dockerfile `infra/api.Dockerfile` | `node apps/api/dist/index.js` | `api.coreup.xxx` |
| `worker` | repo, Dockerfile `infra/worker.Dockerfile` | `node apps/worker/dist/index.js` | ไม่มี (ไม่เปิดพอร์ต) |
| `web` | repo, Dockerfile `infra/web.Dockerfile` (Nuxt node server) | `node apps/web/.output/server/index.mjs` | `coreup.xxx`, `liff.coreup.xxx` |
| `app` | repo, build Vite → serve static (Caddy) `infra/app.Dockerfile` | `caddy run` | `app.coreup.xxx` |

> ทางเลือก: `web` และ `app` ย้ายไป Cloudflare Pages ภายหลังเพื่อ CDN ทั่วโลก (API ยังอยู่ Railway)

**Watch paths** (ให้ build เฉพาะ service ที่เปลี่ยน)

| Service | watch |
|---|---|
| api | `apps/api/**`, `packages/**`, `pnpm-lock.yaml` |
| worker | `apps/worker/**`, `packages/**`, `pnpm-lock.yaml` |
| web | `apps/web/**`, `packages/ui/**`, `packages/api-client/**` |
| app | `apps/app/**`, `packages/**` |

## 2. ฐานข้อมูล PostgreSQL

1. Add → Database → PostgreSQL (เวอร์ชัน 16)
2. เปิด extension (ผ่าน migration แรก)

```sql
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists btree_gist;
create extension if not exists citext;
```

3. **สร้าง role แยก** (สำคัญ — user `postgres` ของ Railway เป็น superuser จะข้าม RLS)

```sql
create role coreup_owner login password '...';
create role coreup_app login password '...' nobypassrls;
create role coreup_platform login password '...' bypassrls;
grant usage on schema public to coreup_app, coreup_platform;
alter default privileges for role coreup_owner in schema public
  grant select, insert, update, delete on tables to coreup_app, coreup_platform;
alter default privileges for role coreup_owner in schema public
  grant usage, select on sequences to coreup_app, coreup_platform;
```

4. ตัวแปรเชื่อมต่อ (ใช้ private network `*.railway.internal`)

| ตัวแปร | ใช้ใน | role |
|---|---|---|
| `DATABASE_URL_MIGRATE` | ขั้น pre-deploy ของ api | `coreup_owner` |
| `DATABASE_URL` | api, worker | `coreup_app` |
| `DATABASE_URL_PLATFORM` | worker (งานข้ามร้าน) | `coreup_platform` |

5. Migration: ตั้ง **Pre-deploy command** ของ `api` = `pnpm --filter @coreup/db migrate` (ใช้ `DATABASE_URL_MIGRATE`) — ถ้า migrate ล้ม deploy จะไม่ไปต่อ
6. Backup: เปิด Railway backups + cron ใน worker `pg_dump` → R2 ทุกวัน เก็บ 30 วัน

## 3. Redis

Add → Database → Redis · ตัวแปร `REDIS_URL` (private) ใช้ใน api (rate limit, idempotency lock, cache) และ worker (BullMQ) · ตั้ง `maxmemory-policy noeviction` (BullMQ ต้องการ)

## 4. Object storage

ใช้ **Cloudflare R2** (S3-compatible, ไม่มีค่า egress) — bucket `coreup-staging`, `coreup-prod` แยกกัน, private ทั้งหมด เข้าถึงผ่าน presigned URL

## 5. ตัวแปร environment

ตรวจด้วย Zod ตอน start: `apps/api/src/env.ts`, `apps/worker/src/env.ts` (ค่าตัวอย่าง dev ทั้งหมดใน `coreup-api/.env.example`)

| ตัวแปร | ตัวอย่าง / หมายเหตุ | service |
|---|---|---|
| `NODE_ENV` | `production` | api, worker |
| `APP_ENV` | `staging` / `production` | worker |
| `LOG_LEVEL` | `info` | api, worker |
| `PORT` | Railway ใส่ให้ | api, app, platform, web |
| `DATABASE_URL` / `DATABASE_URL_PLATFORM` | role `coreup_app` / `coreup_platform` (§2) | api / api, worker |
| `DATABASE_URL_MIGRATE` | role `coreup_owner` — pre-deploy migrate เท่านั้น | api |
| `REDIS_URL` | `redis://default:...@redis.railway.internal:6379` | api, worker |
| `API_URL` / `APP_URL` / `PLATFORM_APP_URL` / `WEB_URL` | `https://api.coreup.xxx`, `https://app.coreup.xxx`, หลังบ้าน CoreUp, `https://coreup.xxx` | api (worker ใช้ `APP_URL`, `WEB_URL`) |
| `CORS_EXTRA_ORIGINS` | origin เพิ่ม คั่นด้วย comma | api |
| `COOKIE_DOMAIN` | `.coreup.xxx` | api |
| `BETTER_AUTH_SECRET` | random ≥ 32 ตัวอักษร | api |
| `ENCRYPTION_KEY` / `HMAC_KEY` | base64 32 bytes (`openssl rand -base64 32`) — เก็บสำรองนอก Railway; ใช้ใน `@coreup/db` crypto | api, worker |
| `LIFF_JWT_SECRET` | random | api |
| `CHANNEL_PROVIDER` | `line` (production บังคับ); `console` สำหรับ dev/test | api, worker |
| `LINE_LOGIN_CHANNEL_ID` / `LINE_LOGIN_CHANNEL_SECRET` | LINE Login (พนักงาน) + verify LIFF id token | api |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile (ฟอร์ม lead) | api |
| `S3_ENDPOINT` (`https://<account>.r2.cloudflarestorage.com`) `S3_REGION` (`auto`) `S3_BUCKET` `S3_ACCESS_KEY_ID` `S3_SECRET_ACCESS_KEY` | R2 ผ่าน S3 API — bucket ต้องมี CORS rule ให้ origin ของ app/platform/web (GET/PUT/HEAD) เพราะ browser อัปโหลดตรงด้วย presigned URL | api, worker |
| `SMTP_URL` / `MAIL_FROM` / `SALES_NOTIFY_EMAIL` | อีเมลระบบ + แจ้งทีมขายเมื่อมี lead | worker (api ใช้ `SALES_NOTIFY_EMAIL`) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | web push (`npx web-push generate-vapid-keys`) | api, worker |
| `OMISE_PUBLIC_KEY` / `OMISE_SECRET_KEY` / `OMISE_WEBHOOK_SECRET` (`OMISE_API_URL` optional) | ค่าระบบรายเดือน; ไม่ตั้ง = endpoint ชำระเงินตอบ 503 `PAYMENTS_NOT_CONFIGURED` | api |
| `TWO_FACTOR_ENFORCE` | `true`/`false`; ไม่ตั้ง = บังคับ 2FA เฉพาะ production (owner + platform_*) | api |
| `WORKER_CONCURRENCY` / `CHROMIUM_EXECUTABLE_PATH` | optional | worker |
| `SENTRY_DSN` | | api, worker |
| `VITE_API_URL` (+ `VITE_SENTRY_DSN`, `VITE_VAPID_PUBLIC_KEY`) | ฝังตอน build (Dockerfile `ARG`) | app, platform |
| `NUXT_PUBLIC_API_URL` / `NUXT_PUBLIC_SITE_URL` / `NUXT_PUBLIC_TURNSTILE_SITE_KEY` / `NUXT_PUBLIC_GA4` / `NUXT_PUBLIC_META_PIXEL` / `NUXT_PUBLIC_LINE_URL` | อ่านตอน start | web |

> Token LINE OA ของแต่ละร้าน **ไม่ใช่ env** เก็บเข้ารหัสใน `channel_accounts`

## 6. Dockerfile (แนวทาง)

```dockerfile
# infra/api.Dockerfile
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@coreup/api...
RUN pnpm deploy --filter=@coreup/api --prod /out

FROM node:22-slim
WORKDIR /app
COPY --from=build /out .
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

worker เหมือนกัน (Playwright สำหรับ PDF: ใช้ image `mcr.microsoft.com/playwright` เฉพาะ worker)

## 7. Health check / ความพร้อม

| Service | path | ตรวจ |
|---|---|---|
| api | `GET /healthz` | process ทำงาน |
| api | `GET /readyz` | ต่อ DB + Redis ได้ |
| worker | log heartbeat ทุก 60 วิ + Sentry cron monitor | |
| web | `GET /` | |

ตั้ง Railway health check = `/readyz` · uptime monitor ภายนอก (Better Stack / UptimeRobot) ยิง `api`, `web`, `app` ทุก 1 นาที

## 8. CI/CD

- GitHub → Railway auto-deploy: branch `main` → `staging`, tag `v*` หรือ branch `production` → `production`
- GitHub Actions ก่อน merge: `pnpm biome check` → `pnpm typecheck` → `pnpm test` (Postgres service container) → `pnpm build`
- PR ที่แก้ `packages/db/migrations` ต้องมี label `migration` และอ่าน SQL ทุกบรรทัด

## 9. ค่าใช้จ่ายและขยาย

- เริ่ม: plan Hobby/Pro ของ Railway คิดตามการใช้จริง (CPU/RAM/egress) — ตรวจราคาปัจจุบันที่ railway.com/pricing ก่อนตั้งงบ
- ขยาย: เพิ่ม replica ของ `api` (stateless), แยก `worker` ตาม queue (`worker-messages`, `worker-reports`), Postgres เพิ่มสเปก → ย้ายไป managed ที่มี read replica เมื่อจำเป็น
- ข้อมูลอยู่สิงคโปร์ = ส่งข้อมูลส่วนบุคคลออกนอกประเทศ → ระบุในนโยบายความเป็นส่วนตัวและสัญญากับร้าน (ให้ทนายตรวจตาม PDPA)

## 10. Local dev

```bash
pnpm i
docker compose -f infra/docker-compose.dev.yml up -d   # postgres16, redis, minio, mailpit
cp .env.example .env
pnpm db:migrate && pnpm db:seed
pnpm dev            # turbo: api :8787, worker, app :5173, web :3000
```
