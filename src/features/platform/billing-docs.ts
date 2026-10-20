import { planFrontName } from './plan-families';

const DAY_MS = 86_400_000;
const days = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/**
 * Suggested amount (satang, VAT excluded) for an upgrade paid mid-cycle: the price difference of the two packages
 * for the part of the running cycle that is left. The admin may type another amount (discounts, rounding).
 * 0 when there is nothing left to pay for or the new package is not dearer.
 */
export function prorateDifference(v: {
  currentPriceMinor: number;
  newPriceMinor: number;
  /** running paid period [start, end) */
  periodStart: string;
  periodEnd: string;
  today: string;
}): number {
  const cycle = days(v.periodStart, v.periodEnd);
  const left = Math.min(Math.max(days(v.today, v.periodEnd), 0), cycle);
  if (cycle <= 0 || left === 0) return 0;
  const diff = v.newPriceMinor - v.currentPriceMinor;
  // whole baht, rounded up: the shop never pays a fraction of a baht
  return diff <= 0 ? 0 : Math.ceil((diff * left) / cycle / 100) * 100;
}

/** `2026-11-02` → `02/11/2569` (Buddhist year, as printed on the invoice). */
export const dmyBE = (ymd: string): string => {
  const [y, m, d] = ymd.split('-') as [string, string, string];
  return `${d}/${m}/${Number(y) + 543}`;
};

/** Ready-to-paste LINE message with the pay link of an invoice the admin just issued. */
export function renewalLineMessage(v: {
  shopName: string;
  plan: { code: string; name: string; interval: 'month' | 'year' };
  number: string;
  totalMinor: number;
  periodStart: string | null;
  periodEnd: string | null;
  payUrl: string;
}): string {
  const baht = (v.totalMinor / 100).toLocaleString('th-TH', { maximumFractionDigits: 2 });
  return [
    `สวัสดีครับ ${v.shopName}`,
    `ใบแจ้งชำระเงินแพ็กเกจ ${planFrontName(v.plan)} (${v.plan.interval === 'year' ? 'รายปี' : 'รายเดือน'}) เลขที่ ${v.number}`,
    ...(v.periodStart && v.periodEnd ? [`รอบใช้งาน ${dmyBE(v.periodStart)}–${dmyBE(v.periodEnd)}`] : []),
    `ยอดชำระ ${baht} บาท`,
    '',
    'กดลิงก์เพื่ออ่านและยอมรับข้อกำหนด โอนเงิน แล้วแนบสลิปได้เลยครับ แอดมินตรวจแล้วระบบต่ออายุให้อัตโนมัติ',
    v.payUrl,
    '',
    'ขอบคุณครับ — CoreUp',
  ].join('\n');
}
