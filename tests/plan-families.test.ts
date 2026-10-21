import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import type { Plan } from '@/features/platform/api';
import {
  familyMismatch,
  groupPlans,
  limitsLine,
  orderPlans,
  type PlanFamily,
  planFrontName,
  sellablePlans,
  yearlyDeal,
} from '@/features/platform/plan-families';
import platform from '@/locales/th/platform.json';

const i18n = i18next.createInstance();
await i18n.init({
  lng: 'th',
  ns: ['platform'],
  defaultNS: 'platform',
  resources: { th: { platform } },
  interpolation: { escapeValue: false },
});
const t = i18n.getFixedT('th', 'platform');

const plan = (code: string, price: number, over: Partial<Plan> = {}): Plan => ({
  id: code,
  code,
  name: `DB ${code}`,
  priceMinor: price * 100,
  interval: code.endsWith('-year') ? 'year' : 'month',
  active: true,
  selfServe: true,
  tenantCount: 0,
  modules: ['core', 'crm'],
  limits: {},
  ...over,
});

describe('groupPlans', () => {
  const all = [
    plan('growth', 0),
    plan('line-pro-year', 5990),
    plan('enterprise', 7990, { selfServe: false }),
    plan('line-basic', 299),
    plan('line-pro', 599),
    plan('starter', 0),
    plan('legacy-x', 1500),
    plan('line-basic-year', 2990),
  ];

  it('orders families like the pricing page and pairs monthly with yearly by code', () => {
    const g = groupPlans(all);
    expect(g.families.map((f) => f.name)).toEqual(['Basic', 'Pro', 'Enterprise']);
    expect(g.families[1]).toMatchObject({
      best: true,
      month: { code: 'line-pro' },
      year: { code: 'line-pro-year' },
    });
    expect(g.families[2]?.year).toBeUndefined();
  });

  it('puts ฿0 plans outside the families in internal and priced strangers in other', () => {
    const g = groupPlans(all);
    expect(g.internal.map((p) => p.code)).toEqual(['growth', 'starter']);
    expect(g.other.map((p) => p.code)).toEqual(['legacy-x']);
  });

  it('orders a dropdown: sold plans (monthly then yearly) first, the rest last', () => {
    const { sold, rest } = orderPlans(all);
    expect(sold.map((p) => p.code)).toEqual([
      'line-basic',
      'line-basic-year',
      'line-pro',
      'line-pro-year',
      'enterprise',
    ]);
    expect(rest.map((p) => p.code)).toEqual(['legacy-x', 'growth', 'starter']);
  });

  it('names a plan by its front name, or the DB name outside the families', () => {
    expect(planFrontName(plan('line-pro-year', 5990))).toBe('Pro');
    expect(planFrontName(plan('business', 1299))).toBe('Business');
    expect(planFrontName(plan('growth', 0))).toBe('DB growth');
  });
});

describe('limitsLine', () => {
  it('words limits like the pricing page, a missing limit = unlimited', () => {
    expect(limitsLine({ members: 8, branches: 1, messages_per_month: 3000 }, t, 'th-TH')).toBe(
      'พนักงาน 8 บัญชี · 1 สาขา · แจ้งเตือน LINE 3,000 ข้อความ/เดือน · ลูกค้าไม่จำกัด',
    );
    expect(limitsLine({}, t, 'th-TH')).toBe(
      'พนักงานไม่จำกัด · สาขาไม่จำกัด · แจ้งเตือน LINE ไม่จำกัดข้อความ/เดือน · ลูกค้าไม่จำกัด',
    );
  });
});

describe('family checks', () => {
  const fam = (...plans: Plan[]): PlanFamily => {
    const f = groupPlans(plans).families[0];
    if (!f) throw new Error('no family');
    return f;
  };

  it('flags monthly/yearly rows that differ in limits or modules, not when equal', () => {
    const m = plan('line-pro', 599, { limits: { members: 8 } });
    expect(familyMismatch(fam(m, plan('line-pro-year', 5990, { limits: { members: 8 } })))).toBe(false);
    expect(familyMismatch(fam(m, plan('line-pro-year', 5990, { limits: { members: 6 } })))).toBe(true);
    expect(
      familyMismatch(fam(m, plan('line-pro-year', 5990, { limits: { members: 8 }, modules: ['core'] }))),
    ).toBe(true);
    expect(familyMismatch(fam(m, plan('line-pro-year', 5990)))).toBe(true); // 8 vs unlimited
  });

  it('computes the yearly average per month and "pay 10 use 12"', () => {
    expect(yearlyDeal(fam(plan('line-pro', 599), plan('line-pro-year', 5990)))).toEqual({
      avgMinor: 49_900,
      paidMonths: 10,
    });
    expect(yearlyDeal(fam(plan('line-pro', 599), plan('line-pro-year', 7188)))?.paidMonths).toBeNull();
    expect(yearlyDeal(fam(plan('line-pro', 599)))).toBeNull();
  });
});

describe('sellablePlans (what a new shop can be opened on)', () => {
  const all = [
    plan('growth', 0),
    plan('multi', 0),
    plan('line-pro-year', 5990),
    plan('line-basic', 299),
    plan('line-pro', 599),
    plan('legacy-x', 1500),
    plan('business', 1999, { active: false }),
  ];

  it('lists only the pricing-page plans (no internal ฿0 or unknown ones) and starts on Pro', () => {
    const s = sellablePlans(all);
    expect(s.plans.map((p) => p.code)).toEqual(['line-basic', 'line-pro', 'line-pro-year']);
    expect(s.defaultCode).toBe('line-pro');
  });

  it('falls back to the first sold plan, and to nothing when none is sold', () => {
    expect(sellablePlans([plan('line-basic', 299), plan('growth', 0)]).defaultCode).toBe('line-basic');
    expect(sellablePlans([plan('growth', 0)])).toEqual({ plans: [], defaultCode: undefined });
    expect(sellablePlans(undefined).defaultCode).toBeUndefined();
  });
});
