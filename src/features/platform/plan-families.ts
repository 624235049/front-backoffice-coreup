import type { TFunction } from 'i18next';
import type { Plan } from './api';
import { PLAN_LIMITS } from './plans';

/** `line-pro-year` → `pro`: the ladder step the picker answers ("basic" … "enterprise"). */
export const keyOf = (code: string): string => code.replace(/^line-/, '').replace(/-year$/, '');

export interface PlanFamily {
  key: string;
  /** the name the pricing page and the shop app use (`marketing.th.displayName`) */
  name: string;
  /** carries a card badge ("แนะนำ"): the plan new shops default to */
  best: boolean;
  month?: Plan;
  year?: Plan;
}

export interface GroupedPlans {
  families: PlanFamily[];
  /** ฿0 plans outside the families: trial shops and old shops, never sold */
  internal: Plan[];
  /** priced plans that match no family: listed so nothing disappears */
  other: Plan[];
}

/**
 * The packages sold (monthly plans with sales copy, in `marketing.sort` order) paired with their `-year` plan by code;
 * the rest are ฿0 internal plans (trial shops, old shops) and priced plans nobody lists.
 */
export function groupPlans(plans: readonly Plan[]): GroupedPlans {
  const byCode = new Map(plans.map((p) => [p.code, p]));
  const sold = plans
    .filter((p) => p.marketing && !p.code.endsWith('-year'))
    .sort((a, b) => (a.marketing?.sort ?? 0) - (b.marketing?.sort ?? 0) || a.priceMinor - b.priceMinor);
  const families = sold.map((month) => ({
    key: keyOf(month.code),
    name: month.marketing?.th.displayName ?? month.name,
    best: !!month.marketing?.th.badge,
    month,
    year: byCode.get(`${month.code}-year`),
  }));
  const used = new Set(families.flatMap((f) => [f.month.code, f.year?.code]));
  const rest = plans.filter((p) => !used.has(p.code));
  return {
    families,
    internal: rest.filter((p) => p.priceMinor === 0),
    other: rest.filter((p) => p.priceMinor > 0),
  };
}

// Names of the sold plans by monthly code, filled whenever the plan list loads: invoice texts and dropdown labels
// receive only a plan row (yearly rows carry no copy), so they look the name up here.
let names = new Map<string, string>();
export function rememberPlanNames(plans: readonly Plan[]): void {
  names = new Map(plans.flatMap((p) => (p.marketing ? [[p.code, p.marketing.th.displayName] as const] : [])));
}

/** Front name for a plan code ("line-pro-year" → "Pro"); the DB name when the code is not a sold plan. */
export function planFrontName(p: Pick<Plan, 'code' | 'name'>): string {
  return names.get(p.code.replace(/-year$/, '')) ?? p.name;
}

/** Same order as the pricing page words them; a missing limit = unlimited. */
const LIMIT_ORDER = [
  'members',
  'branches',
  'messages_per_month',
  'customers',
] as const satisfies readonly (typeof PLAN_LIMITS)[number][];

/** "6 บัญชี · 1 สาขา · แจ้งเตือน LINE 3,000 ข้อความ/เดือน · ลูกค้าไม่จำกัด" */
export function limitsLine(limits: Plan['limits'], t: TFunction<'platform'>, locale: string): string {
  return LIMIT_ORDER.map((k) => {
    const v = limits[k];
    return v === undefined
      ? t(`plans.limitLine.${k}.unlimited`)
      : t(`plans.limitLine.${k}.value`, { value: v.toLocaleString(locale) });
  }).join(' · ');
}

/** True when the monthly and yearly rows of a family give the shop different modules or limits. */
export function familyMismatch(f: PlanFamily): boolean {
  const { month, year } = f;
  if (!month || !year) return false;
  const mods = (p: Plan) => [...p.modules].sort().join(',');
  return mods(month) !== mods(year) || PLAN_LIMITS.some((k) => month.limits[k] !== year.limits[k]);
}

/** Yearly price per month in whole baht (satang), and how many months the shop pays for 12 ("จ่าย 10 ใช้ 12"; null when not a saving). */
export function yearlyDeal(f: PlanFamily): { avgMinor: number; paidMonths: number | null } | null {
  if (!f.year) return null;
  const paid = f.month && f.month.priceMinor > 0 ? f.year.priceMinor / f.month.priceMinor : 0;
  return {
    avgMinor: Math.round(f.year.priceMinor / 1200) * 100,
    paidMonths: Number.isInteger(paid) && paid > 0 && paid < 12 ? paid : null,
  };
}

/** Plans for a dropdown: the sold ones in pricing-page order (monthly then yearly), then the rest (other, internal). */
export function orderPlans(plans: readonly Plan[]): { sold: Plan[]; rest: Plan[] } {
  const g = groupPlans(plans);
  return {
    sold: g.families.flatMap((f) => [f.month, f.year]).filter((p): p is Plan => !!p),
    rest: [...g.other, ...g.internal],
  };
}

/** What a new shop can be opened on: only the plans sold on the pricing page (never internal ฿0 ones). Default = the plan with a card badge, else the first sold plan. */
export function sellablePlans(plans: readonly Plan[] | undefined): {
  plans: Plan[];
  defaultCode: string | undefined;
} {
  const sold = orderPlans(plans ?? []).sold.filter((p) => p.active);
  const best = groupPlans(plans ?? []).families.find((f) => f.best)?.month?.code;
  return { plans: sold, defaultCode: (sold.find((p) => p.code === best) ?? sold[0])?.code };
}
