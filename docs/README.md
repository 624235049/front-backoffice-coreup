# CoreUp Platform — เอกสารสำหรับ Dev

**CoreUp คือบริษัทที่ปรึกษา SME สายบริการ** (คลินิก สปา ร้านนวด ร้านสระผม ฯลฯ) ที่เข้าไปวางระบบงานและคนให้ร้าน **ระบบในเอกสารชุดนี้คือเครื่องมือของงานที่ปรึกษา** ที่ทิ้งไว้ให้ร้านเดินต่อได้เองหลังจบงาน และพิสูจน์ผลเป็นตัวเลข ตั้งแต่ร้านเดียวจนถึงหลายสาขา

ดังนั้นทุกฟังก์ชันต้อง (1) ลดงานคนหน้างานจริง (2) ทำให้เห็นว่าช่วยอะไรไปแล้ว (3) เทียบผลกับตอนเริ่มได้ — ดู [13-feature-specs.md](13-feature-specs.md)

เอกสารชุดนี้เป็น **spec สำหรับลงมือเขียนโค้ด** ใช้เป็นแหล่งอ้างอิงเดียวของระบบ ถ้าโค้ดกับเอกสารไม่ตรงกัน ให้แก้เอกสารใน PR เดียวกับโค้ด

## อ่านตามลำดับ

| ไฟล์ | เนื้อหา | อ่านเมื่อ |
|---|---|---|
| [00-overview.md](00-overview.md) | ภาพรวม สถาปัตยกรรม tech stack โครง repo หลักการออกแบบ | ก่อนเริ่มทุกอย่าง |
| [01-landing.md](01-landing.md) | ระบบหน้าเว็บ CoreUp (Nuxt) + หน้า LIFF ใน LINE | ทำ landing page |
| [02-api.md](02-api.md) | API ทั้งหมด: ข้อตกลง auth สิทธิ์ endpoint webhook งานเบื้องหลัง | ทำ backend |
| [03-database.md](03-database.md) | ฐานข้อมูล ตารางทั้งหมด RLS index | ทำ backend |
| [04-backoffice.md](04-backoffice.md) | เว็บหลังบ้าน (React + Vite): โครงสร้าง route หน้าจอทุกบทบาท | ทำ frontend หลังบ้าน |
| [05-extensibility.md](05-extensibility.md) | ทำให้ใช้ได้ทุกธุรกิจ + ขยายในอนาคต: template ธุรกิจ, custom field, โมดูล, กติกา, ช่องทางข้อความ, integration, AI | ก่อนออกแบบฟีเจอร์ใหม่ทุกครั้ง |
| [06-roadmap.md](06-roadmap.md) | ลำดับงานสำหรับ dev คนเดียว เช็กลิสต์ต่อ milestone | วางแผนรายสัปดาห์ |
| [07-deploy-railway.md](07-deploy-railway.md) | Deploy บน Railway: Postgres, Redis, services, env, role DB, CI | ตั้งระบบครั้งแรก / deploy |
| [08-operations-and-reports.md](08-operations-and-reports.md) | ตรวจโจทย์ (ลดงานได้จริงไหม), วงจรหลัก, ปฏิทินรวม, คิว/walk-in, ปิดวัน, ระบบรายงาน, จุดปัญหาเพิ่มเติม, โหมดร้านเล็ก | ก่อนทำ M2 เป็นต้นไป |
| [09-roles-and-platform.md](09-roles-and-platform.md) | บทบาท 9 แบบ (CoreUp 4 + ร้าน 5), สิทธิ์ดูรายงานของ platform_owner, dashboard จำนวนร้าน/ลูกค้าที่ใช้งาน, งานที่ปรึกษา + การขายระบบ | ทำ backoffice CoreUp |
| [10-consult-playbook.md](10-consult-playbook.md) | ทำไมขายที่ปรึกษาคู่ระบบ, หลักพาร้านที่ไม่เคยมีระบบเข้าระบบ, แผน 90 วัน, ตัวเลขพิสูจน์ผล, ฟีเจอร์ที่ต้องเพิ่ม | ทีมที่ปรึกษา + dev |
| [11-checkout-and-pos.md](11-checkout-and-pos.md) | อยู่คู่/แทน POS เดิม: แบ่งร้าน 3 กลุ่ม, ระดับการเชื่อม, โมดูล checkout (POS-lite + PromptPay QR), แผนย้ายร้าน | ก่อนทำ M6 |
| [12-database-ddl.sql](12-database-ddl.sql) | **DDL อ้างอิงของฐานข้อมูลทั้งหมด** 94 ตาราง + 4 ตาราง Better Auth constraint ครบ + RLS — ทดสอบรันบน PostgreSQL 16 แล้ว (แยกร้าน, กันนัดชน, ส่วนลดต้องมีเหตุผล, กันอ้างข้ามร้าน) | ก่อนเขียน Drizzle schema |
| [13-feature-specs.md](13-feature-specs.md) | Spec ฟังก์ชันแบบ "ใช้แล้วเห็นผล": impact, บอร์ดวันนี้, กดเสร็จ, การ์ดพนักงาน, ความเสี่ยงคนสำคัญ, ลาออก, ปิดวัน, คิวโปร่งใส, หน้าเจ้าของ, ทดสอบลาพักร้อน, คู่มือร้าน, เครื่องคิดเงินรั่ว | ก่อนทำแต่ละหน้าจอ |
| [AGENTS.md](AGENTS.md) | กฎสำหรับ AI ที่ช่วยเขียนโค้ด (วางที่ root repo, copy เป็น `CLAUDE.md` ได้) | ก่อนให้ AI ทำงาน |

## สรุปใน 30 วินาที

- **เว็บล้วน** ไม่มีแอปมือถือ (PWA แทน) ลูกค้าของร้านใช้ผ่าน **LINE OA** ของร้าน
- **API**: TypeScript + Hono + PostgreSQL 16 + Drizzle + Redis/BullMQ
- **Hosting เริ่มต้น**: Railway (Postgres + Redis + api + worker + web + app) region สิงคโปร์, ไฟล์เก็บ Cloudflare R2
- **หลังบ้าน**: React 19 + Vite + TanStack Router/Query + shadcn/ui
- **Landing**: Nuxt + Nuxt Content + Tailwind
- **Multi-tenant**: ร้าน (tenant) → สาขา (branch) แยกข้อมูลด้วย `tenant_id` + Postgres RLS
- **ใช้ได้ทุกธุรกิจ** ด้วย *industry template* + *terminology* + *custom fields* + *module flags* ไม่ hardcode คำว่า "คนไข้" หรือ "หัตถการ" ในโค้ด

## โดเมน

| โดเมน | ใช้ทำอะไร |
|---|---|
| `coreup.xxx` | Landing page |
| `app.coreup.xxx` | เว็บหลังบ้าน (ร้าน + ทีม CoreUp) |
| `api.coreup.xxx` | API |
| `liff.coreup.xxx` | หน้าเว็บที่เปิดในแอป LINE |

> `xxx` = โดเมนที่จะจดจริง (.com / .co / .in.th)
