# 05 — ใช้ได้ทุกธุรกิจ และขยายได้ในอนาคต

อ่านไฟล์นี้ **ก่อนออกแบบฟีเจอร์ใหม่ทุกครั้ง** คำถามที่ต้องตอบได้: "ถ้าพรุ่งนี้มีร้านทำเล็บ/คลินิกสัตว์/ร้านอาหารมาใช้ ฟีเจอร์นี้ต้องแก้โค้ดไหม" — คำตอบที่ถูกคือ **ไม่ต้อง แค่เพิ่มข้อมูล**

## กลไก 9 อย่างที่ทำให้ขยายได้

| # | กลไก | แก้ปัญหา |
|---|---|---|
| 1 | Industry template | ธุรกิจใหม่ = ไฟล์ template ใหม่ |
| 2 | Terminology | คำเรียกต่างกันในแต่ละธุรกิจ/ร้าน |
| 3 | Custom fields | ร้านอยากเก็บข้อมูลเพิ่ม |
| 4 | Modules + plans | ขายแยกฟีเจอร์ เปิดทีละส่วน |
| 5 | Rules as data | กติกาคิว ค่ามือ ต่างกันทุกร้าน |
| 6 | Message templates + plans | จังหวะและคำพูดต่างกันทุกธุรกิจ |
| 7 | Channel providers | วันหน้าใช้ SMS / WhatsApp / Messenger / อีเมล |
| 8 | KPI catalog | เพิ่ม KPI โดยไม่แก้หน้าจอ |
| 9 | Events + integrations | ต่อระบบภายนอก, AI, แอปมือถือในอนาคต |

---

## 1. Industry template

อยู่ที่ `packages/templates/<key>.ts` (validate ด้วย Zod) และ publish ลงตาราง `industry_templates` (มี version) ตอนสร้างร้าน ระบบ **copy** ค่าจาก template ลงข้อมูลของร้าน → ร้านแก้ได้อิสระ ไม่กระทบ template

```ts
// packages/templates/src/spa.ts
export const spa: IndustryTemplate = {
  key: 'spa',
  version: 1,
  extends: 'generic',                       // สืบทอดค่าจาก generic แล้ว override
  name: { th: 'สปา / ร้านนวด', en: 'Spa & Massage' },
  terminology: {
    customer: { th: 'ลูกค้า' }, service: { th: 'บริการ' },
    practitioner: { th: 'เทอราพิสต์' }, appointment: { th: 'คิว' },
  },
  positions: [
    { code: 'manager', name: { th: 'ผู้จัดการร้าน' }, defaultRole: 'branch_manager' },
    { code: 'therapist', name: { th: 'เทอราพิสต์' }, defaultRole: 'practitioner', customerFacing: true },
    { code: 'reception', name: { th: 'หน้าร้าน' }, defaultRole: 'front_desk' },
  ],
  resources: [{ type: 'bed', name: { th: 'เตียง' } }, { type: 'room', name: { th: 'ห้อง VIP' } }],
  serviceCategories: [
    { name: { th: 'นวดไทย' }, services: [{ name: { th: 'นวดไทย 60 นาที' }, durationMin: 60, rebookAfterDays: 14 }] },
    { name: { th: 'นวดน้ำมัน' }, services: [{ name: { th: 'อโรมา 90 นาที' }, durationMin: 90, rebookAfterDays: 21 }] },
  ],
  messagePlans: [
    { trigger: 'appointment.created', offsetMinutes: 0, templateKey: 'booking_confirm' },
    { trigger: 'appointment.reminder', offsetMinutes: -1440, templateKey: 'reminder_1d' },
    { trigger: 'appointment.reminder', offsetMinutes: -180, templateKey: 'reminder_3h' },
    { trigger: 'service.completed', offsetMinutes: 1440, templateKey: 'thank_you_review' },
    { trigger: 'rebook.due', offsetMinutes: 0, templateKey: 'rebook_spa' },
    { trigger: 'customer.lapsed', offsetMinutes: 0, templateKey: 'miss_you' },
  ],
  messageTemplates: { /* key → { th: {...line flex/text...} } */ },
  checklists: [
    { name: { th: 'เปิดร้าน' }, schedule: { type: 'shift_start' }, items: ['เปิดแอร์/เพลง', 'เช็กผ้าขนหนูสะอาด ≥ 20 ผืน', 'เติมน้ำมันนวด'] },
    { name: { th: 'ปิดร้าน' }, schedule: { type: 'shift_end' }, items: ['ส่งผ้าซัก', 'ปิดไฟ/ล็อกประตู', 'สรุปทิป'] },
  ],
  sops: [{ title: { th: 'ต้อนรับลูกค้าใหม่' }, positions: ['reception'], bodyMd: '...' }],
  queueRuleDefault: { mode: 'rotation', honorRequested: true, requiresSkill: true },
  compensationDefault: { /* ดู §5 */ },
  kpiDefaults: ['no_show_rate', 'return_rate_90d', 'turnover_rate', 'tip_per_service'],
  surveyWording: { /* override คำถามบางข้อให้ใช้คำของธุรกิจนี้ */ },
  concernKeywords: [],                     // คลินิกมี ['แดง','บวม','แสบ']; สปาไม่จำเป็น
  modulesRecommended: ['crm', 'shifts', 'payouts'],
};
```

Template ที่ต้องมีตอนเปิดตัว: `generic` (ฐาน), `clinic` (ความงาม), `dental`, `spa`, `massage`, `salon` (ร้านสระผม/เฮดสปาสไตล์เวียดนาม), `restaurant` (ไม่มีนัด → ปิด crm.booking ใช้ shifts/checklists/surveys เป็นหลัก)

**เพิ่มธุรกิจใหม่** = เขียน template ใหม่ที่ `extends: 'generic'` + เพิ่มหน้า `/industries/<key>` ใน landing (YAML) — ไม่แก้ API หรือหน้าจอ

ทีม CoreUp แก้/สร้าง template ได้ใน `/platform/templates` (ภายหลัง) → publish เป็น version ใหม่ ร้านเดิมไม่กระทบ มีปุ่ม "ดึงของใหม่จาก template" แบบเลือกทีละส่วน

---

## 2. Terminology

```ts
type TermKey = 'customer' | 'customers' | 'service' | 'appointment' | 'practitioner'
             | 'branch' | 'package' | 'followup' | 'resource';
```

ลำดับการหาคำ: `tenant.terminology` → template ของร้าน → `generic` → i18n default

- API: `GET /v1/me` ส่ง terminology มาให้แล้ว
- หน้าบ้าน: `useTerm('customer')`, `<Term k="appointment" />`
- ข้อความ LINE: ตัวแปร `{{term.appointment}}`
- i18n: ข้อความระบบใช้ placeholder เช่น `"ยืนยัน{{appointment}}แล้ว"`

---

## 3. Custom fields

- ร้านเพิ่มฟิลด์ให้ `customer`, `appointment`, `service`, `membership`, `service_record` ได้ที่ `/settings/fields`
- เก็บค่าใน `custom_fields jsonb` ของแถวนั้น, นิยามใน `field_definitions`
- API validate ด้วย Zod ที่ **สร้างจาก field_definitions ตอน runtime** (cache ต่อ tenant)
- หน้าบ้าน `EntityForm` ต่อท้ายฟิลด์อัตโนมัติ, `DataTable` เลือกเป็นคอลัมน์ได้, filter ได้ (index: GIN บน `custom_fields` ถ้าจำเป็น)
- ห้ามให้สร้างฟิลด์ประเภทข้อมูลการรักษา/สุขภาพ → มีคำเตือนในหน้าตั้งค่า + ห้าม key ในรายการต้องห้าม

---

## 4. Modules + plans

- โมดูลใหม่ = เพิ่ม key ใน `ModuleKey` enum + routes ใช้ `module: 'xxx'` + เมนูใน `navigation.ts` มี `module`
- plan เป็นข้อมูล (`plans`, `plan_modules`, `plan_limits`) เปลี่ยนแพ็กเกจ/ราคาได้โดยไม่ deploy
- รองรับ add-on รายร้าน (`tenant_modules.source = 'addon'`) และ trial มีวันหมด
- Feature flag สำหรับ rollout ฟีเจอร์ใหม่ทีละร้าน: `tenant.settings.flags[]` (ใช้เฉพาะช่วงทดสอบ ลบเมื่อเปิดทุกร้าน)

---

## 5. Rules as data (คิว / ค่าตอบแทน / การจอง)

เก็บใน `rule_sets` (`kind`, `body jsonb`, `schema_version`, `effective_from`) ประมวลผลใน `packages/domain/rules/*` เป็นฟังก์ชันล้วน

### 5.1 กติกาคิว

```json
{
  "schemaVersion": 1,
  "mode": "rotation",                 // rotation | least_busy | by_skill_priority | manual
  "honorRequested": true,             // ลูกค้าขอคนเดิม → ให้คนนั้น
  "requestedCountsAsTurn": false,     // ขอคนเดิมนับเป็นรอบไหม
  "requiresSkill": true,
  "eligiblePositions": ["therapist"],
  "skipIfOnBreak": true,
  "resetDaily": true,
  "tieBreaker": "earliest_clock_in"
}
```

`decideNextInQueue(rule, state, candidates, request) → { memberId, reason, newState }` — `reason` เป็นข้อความอ่านได้ แสดงให้หน้าร้านเห็น (ความโปร่งใสลดการทะเลาะ)

### 5.2 กติกาค่าตอบแทน

```json
{
  "schemaVersion": 1,
  "components": [
    { "type": "hand_fee", "match": { "serviceCategory": "นวดไทย" }, "amount": { "fixedMinor": 12000 } },
    { "type": "hand_fee", "match": { "service": "*" }, "amount": { "percentBp": 3000, "of": "paid" } },
    { "type": "bonus_requested", "match": { "isRequestedByCustomer": true }, "amount": { "fixedMinor": 2000 } },
    { "type": "commission", "match": { "packageSale": true }, "amount": { "percentBp": 500, "of": "package_price" }, "to": "sale_member" },
    { "type": "tip", "policy": "to_performer" },
    { "type": "tier", "period": "month", "metric": "service_count",
      "tiers": [ { "from": 0, "multiplierBp": 10000 }, { "from": 120, "multiplierBp": 11000 } ] }
  ],
  "rounding": "nearest_baht"
}
```

- `match` ใช้ตัวดำเนินการชุดเล็กที่กำหนดไว้ (ไม่ใช่ eval โค้ด)
- ทุกการคำนวณบันทึก `explain` ใน `commission_ledger` → พนักงานกดดูได้ว่าได้เงินจากอะไร
- ร้านแปลก ๆ ที่ไม่เข้าแบบ → เพิ่ม component type ใหม่ใน domain (มี test) แล้วใช้ได้ทุกร้าน

### 5.3 กติกาการจอง

`{ leadTimeMin, maxAdvanceDays, slotStepMin, allowChooseStaff, requireDeposit: false, cancellationWindowMin }`

---

## 6. Message templates + plans

- `trigger` เป็นชุดคงที่ (เพิ่มได้ในโค้ด) ส่วน **เวลา + ข้อความ เป็นข้อมูล**
- ตัวแปรที่ใช้ในข้อความ (render ด้วย Mustache-like แบบ escape เสมอ)

`{{customer.firstName}}` `{{appointment.date}}` `{{appointment.time}}` `{{service.name}}` `{{practitioner.name}}` `{{branch.name}}` `{{branch.mapUrl}}` `{{package.remaining}}` `{{package.expiresOn}}` `{{tenant.name}}` `{{links.confirm}}` `{{links.reschedule}}` `{{links.feedback}}` `{{term.*}}`

- ข้อความ LINE เก็บเป็น JSON ของเราเอง (`{ type:'card', title, body, buttons:[{label, action}] }`) แล้วให้ provider แปลงเป็น Flex Message → ใช้กับช่องทางอื่นได้ (SMS แปลงเป็นข้อความ + ลิงก์)
- เลือก plan ต่อสาขา/หมวดบริการได้ (`message_plans.branch_id`, `service_category_id`)
- ทุกข้อความเคารพ `quiet_hours` และ `consent_messaging`

---

## 7. Channel providers

```ts
// packages/channels/src/types.ts
export interface ChannelProvider {
  key: 'line' | 'sms' | 'email' | 'whatsapp' | 'messenger';
  send(account: ChannelAccount, to: Recipient, msg: OutboundMessage): Promise<SendResult>;
  verifyWebhook?(req: Request, account: ChannelAccount): Promise<boolean>;
  parseWebhook?(body: unknown): InboundEvent[];
  quota?(account: ChannelAccount): Promise<{ used: number; limit: number | null }>;
}
```

เริ่มด้วย `line` อย่างเดียว · ต่างประเทศ/ร้านที่ไม่ใช้ LINE → เพิ่ม provider ใหม่ ไม่แก้ worker

---

## 8. KPI catalog

```ts
// packages/domain/kpi/catalog.ts
export const kpis = {
  no_show_rate: {
    label: { th: 'ไม่มาตามนัด' }, unit: 'percent', better: 'lower',
    modules: ['crm'], grains: ['day', 'week', 'month'],
    compute: (ctx) => ratio(count(ctx.appointments, { status: 'no_show' }), count(ctx.appointments, { status: ACTIVE_OR_DONE })),
  },
  confirm_rate: { ... }, return_rate_90d: { ... }, followup_completion: { ... },
  turnover_rate: { ... }, early_turnover_90d: { ... }, enps: { ... }, fairness_score: { ... },
  absence_per_head: { ... }, checklist_completion: { ... }, sop_coverage: { ... },
  avg_ticket: { ... }, revenue_per_practitioner_hour: { ... }, resource_utilization: { ... },
  package_outstanding_value: { ... }, review_count: { ... }, tip_per_service: { ... },
} satisfies Record<string, KpiDef>;
```

- Worker คำนวณทุกคืนลง `kpi_snapshots` (มี numerator/denominator เพื่อรวมข้ามสาขาได้ถูก)
- หน้า KPI แสดงตาม catalog + โมดูลที่ร้านเปิด → เพิ่ม KPI = เพิ่ม 1 entry + test

---

## 9. Events, integrations และอนาคต

| อนาคต | เตรียมไว้แล้วด้วย |
|---|---|
| ต่อโปรแกรมคลินิก / POS | `imports` (CSV ก่อน) → ภายหลังเขียน connector ที่อ่าน API ภายนอกแล้วสร้าง `appointments`/`service_records` ผ่าน service เดิม; `external_refs (entity, entity_id, system, external_id)` |
| ร้านต่อระบบเราเอง | Public API ด้วย API key ต่อร้าน (`api_keys` + scope = permissions เดิม) + outbound webhooks (02 §7.2) |
| แอปมือถือจริง | API เดิม + auth แบบ token (Better Auth รองรับ) — ไม่ต้องแก้ backend |
| AI วิเคราะห์ (โมดูล `ai`) | ข้อมูลอยู่ในรูปที่วิเคราะห์ได้แล้ว: คำตอบ text ของแบบสอบถาม, health score, KPI; ทำเป็น job ที่ (1) ตัดข้อมูลระบุตัว (2) ส่ง LLM (3) เก็บผลใน `ai_insights` ให้ที่ปรึกษาตรวจก่อนแสดง |
| หลายประเทศ | `tenant.country/currency/timezone/locale` มีแล้ว, i18n key-based, เงินเป็นหน่วยย่อย |
| ร้านใหญ่มาก | RLS + index ที่นำด้วย tenant_id → แยก DB ต่อร้านใหญ่ได้ภายหลัง (schema เดิม) |
| แยก service | `packages/domain` ไม่ผูก framework → ย้ายส่วนหนัก (KPI, benchmark) เป็น service แยก/ภาษาอื่น (Rust) คุยผ่านคิวได้ |
| Benchmark ข้ามร้าน | `kpi_snapshots` + `tenants.industry_key` → ค่าเฉลี่ยรายธุรกิจ (ต้องมี ≥ 10 ร้านต่อกลุ่ม และยินยอมในสัญญา) |

## 10. Checklist ก่อน merge ฟีเจอร์ใหม่

- [ ] ไม่มีคำเฉพาะธุรกิจ hardcode (ใช้ terminology / template)
- [ ] มี `tenant_id` + RLS + test isolation
- [ ] รองรับหลายสาขา (`branch_id` + branchScope) และร้านสาขาเดียว
- [ ] อยู่ใต้โมดูลที่ถูกต้อง + permission
- [ ] กติกาที่ร้านอาจอยากต่างกัน → เป็นข้อมูล ไม่ใช่ `if`
- [ ] ตรรกะคำนวณอยู่ใน `packages/domain` มี unit test
- [ ] emit domain event ถ้าคนอื่นอาจสนใจ
- [ ] ข้อมูลส่วนบุคคล: เก็บเท่าที่จำเป็น, export/erase ได้
- [ ] i18n key ครบ th (และ en ถ้ามี)
- [ ] อัปเดตเอกสารใน `docs/`
