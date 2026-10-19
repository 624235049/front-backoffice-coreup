import type { SHOP_MODULES } from './plans';

type FeatureModule = Exclude<(typeof SHOP_MODULES)[number], 'core' | 'lite'>;

/** Headed groups of the module switches, same split as the pricing page (หน้าบ้าน · ระบบจองคิว / หลังบ้าน · POS / Business). */
export const MODULE_GROUPS = [
  { key: 'front', modules: ['crm', 'booking', 'messaging'] },
  { key: 'back', modules: ['checkout', 'payouts', 'reports'] },
  {
    key: 'business',
    modules: ['inventory', 'shifts', 'kpi', 'checklists', 'sop', 'surveys', 'approvals', 'clinical'],
  },
] as const satisfies readonly { key: string; modules: readonly FeatureModule[] }[];

/**
 * The shop menus each module turns on (Thai names as the shop shows them; "ตั้งค่า ›" = a tab in the settings page).
 * Hand-copied from the shop repo: front-backoffice-shop/src/features/<area>/nav.ts and settings-tabs.ts (items with that
 * `module`), names from src/locales/th/*.json. Terminology placeholders ({{customers}}, {{service}} …) are written
 * with the default words. Update this file when a shop nav item changes module. `booking` gates no menu.
 */
export const MODULE_MENUS: Record<FeatureModule, readonly string[]> = {
  crm: [
    'วันนี้',
    'ปฏิทิน',
    'ติดตามลูกค้า',
    'ลูกค้า',
    'เรื่องร้องเรียน',
    'ตั้งค่า › บริการ',
    'ตั้งค่า › ลูกค้า',
    'ตั้งค่า › ทักษะ',
    'ตั้งค่า › จองออนไลน์',
    'ตั้งค่า › การเตือนนัด',
  ],
  booking: [],
  messaging: ['ข้อความ', 'ตั้งค่า › เชื่อมต่อ LINE'],
  checkout: ['ภาพรวมธุรกิจ', 'รับเงิน', 'บิล', 'รายงาน (ยอดขาย)', 'ลิ้นชักเงิน', 'ปิดวัน', 'ตั้งค่า › การรับเงิน'],
  payouts: ['บันทึกบริการ', 'ปิดงวดค่ามือ', 'รายได้ของฉัน', 'นำเข้ายอด POS'],
  reports: ['รายงาน', 'กล่องแจ้งปัญหา'],
  inventory: ['ขายหน้าร้าน', 'สินค้า', 'สต็อก', 'นับสต็อก', 'รายงานสต็อก', 'ตั้งค่า › สินค้าและสต็อก'],
  shifts: ['ตารางเวร', 'เวรของฉัน'],
  kpi: ['ตัวเลขร้าน'],
  checklists: ['เช็กลิสต์', 'เช็กลิสต์ของฉัน'],
  sop: ['คู่มือ', 'คู่มือที่ต้องอ่าน'],
  surveys: ['สุขภาพองค์กร', 'แบบสอบถาม'],
  approvals: ['กล่องอนุมัติ'],
  clinical: ['เคสที่ต้องบันทึก', 'ตั้งค่า › บันทึกการรักษา'],
};
