import { describe, expect, it } from 'vitest';
import { dmyBE, prorateDifference, renewalLineMessage } from '@/features/platform/billing-docs';

describe('prorateDifference (suggested amount for an upgrade paid mid-cycle)', () => {
  const base = {
    currentPriceMinor: 199_000,
    newPriceMinor: 399_000,
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
  };
  it('is the price difference for the days that are left, in whole baht rounded up', () => {
    // 15 of 30 days left → half of ฿2,000
    expect(prorateDifference({ ...base, today: '2026-10-16' })).toBe(100_000);
    // 10 of 30 days left → 666.67 → ฿667
    expect(prorateDifference({ ...base, today: '2026-10-21' })).toBe(66_700);
  });
  it('is the full difference on the first day and 0 once the period is over', () => {
    expect(prorateDifference({ ...base, today: '2026-10-01' })).toBe(200_000);
    expect(prorateDifference({ ...base, today: '2026-10-31' })).toBe(0);
    expect(prorateDifference({ ...base, today: '2026-11-05' })).toBe(0);
  });
  it('is 0 when the new package is not dearer', () => {
    expect(prorateDifference({ ...base, newPriceMinor: 199_000, today: '2026-10-10' })).toBe(0);
    expect(prorateDifference({ ...base, newPriceMinor: 99_000, today: '2026-10-10' })).toBe(0);
  });
});

describe('renewalLineMessage', () => {
  const msg = renewalLineMessage({
    shopName: 'ร้านสวย',
    plan: { code: 'line-pro-year', name: 'ระบบจองคิว Pro รายปี', interval: 'year' },
    number: 'INV-202610-0007',
    totalMinor: 3_990_000,
    periodStart: '2026-11-02',
    periodEnd: '2027-11-02',
    payUrl: 'https://app.coreup.pro/pay/tok.123',
  });
  it('is a ready Thai message with package, number, period, amount and the pay link', () => {
    expect(msg).toContain('สวัสดีครับ ร้านสวย');
    expect(msg).toContain('แพ็กเกจ Pro (รายปี) เลขที่ INV-202610-0007');
    expect(msg).toContain('รอบใช้งาน 02/11/2569–02/11/2570');
    expect(msg).toContain('ยอดชำระ 39,900 บาท');
    expect(msg).toContain('https://app.coreup.pro/pay/tok.123');
    expect(msg.endsWith('ขอบคุณครับ — CoreUp')).toBe(true);
  });
  it('dmyBE prints the Buddhist year', () => {
    expect(dmyBE('2026-01-05')).toBe('05/01/2569');
  });
});
