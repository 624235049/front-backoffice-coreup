import { describe, expect, it } from 'vitest';
import { limitValue, UNLIMITED_OVERRIDE } from '@/features/platform/components/limits-card';
import { MODULE_GROUPS, MODULE_MENUS } from '@/features/platform/module-menus';
import { BOUNDED_LIMIT_MAX, PLAN_LIMITS, SHOP_MODULES } from '@/features/platform/plans';
import en from '@/locales/en/platform.json';
import th from '@/locales/th/platform.json';

describe('shop module groups', () => {
  it('lists every switchable module exactly once, `lite` apart', () => {
    const grouped = MODULE_GROUPS.flatMap((g) => g.modules).sort();
    const expected = SHOP_MODULES.filter((k) => k !== 'core' && k !== 'lite').sort();
    expect(grouped).toEqual(expected);
    expect(Object.keys(MODULE_MENUS).sort()).toEqual(expected);
  });
});

describe('quota row value', () => {
  it('maps the inputs to what the API stores', () => {
    expect(limitValue('', false)).toBeNull();
    expect(limitValue('  15 ', false)).toBe(15);
    expect(limitValue('0', false)).toBe(0);
    expect(limitValue('7', true)).toBe(UNLIMITED_OVERRIDE);
  });

  it('rejects anything that is not a whole number', () => {
    expect(limitValue('1.5', false)).toBeUndefined();
    expect(limitValue('-2', false)).toBeUndefined();
    expect(limitValue('abc', false)).toBeUndefined();
  });
});

describe('plan limit keys', () => {
  it('the plan editor lists the items quota (จำนวนรายการสินค้า/บริการ) and both languages name every key', () => {
    expect(PLAN_LIMITS).toContain('items');
    for (const k of PLAN_LIMITS) {
      expect(th.plans.limit[k]).toBeTruthy();
      expect(en.plans.limit[k]).toBeTruthy();
    }
    expect(th.plans.limit.items).toBe('รายการสินค้า/บริการ');
  });
});

describe('included AI messages as a plan limit', () => {
  it('is editable on a plan and capped like slip checks: never unlimited, at most 10,000', () => {
    expect(PLAN_LIMITS).toContain('ai_messages_month');
    expect(BOUNDED_LIMIT_MAX).toEqual({ slip_checks_month: 2000, ai_messages_month: 10_000 });
  });
});
