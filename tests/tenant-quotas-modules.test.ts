import { describe, expect, it } from 'vitest';
import { limitValue, UNLIMITED_OVERRIDE } from '@/features/platform/components/limits-card';
import { MODULE_GROUPS, MODULE_MENUS } from '@/features/platform/module-menus';
import { SHOP_MODULES } from '@/features/platform/plans';

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
