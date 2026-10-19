import type { TFunction } from 'i18next';
import type { Plan } from './api';
import { PLAN_LIMITS } from './plans';

/** The packages sold on the public pricing page (coreup.pro/queue), in that order. `code` = monthly plan, yearly = `<code>-year`. */
export const FAMILIES: readonly { key: string; name: string; code: string; best?: boolean }[] = [
  { key: 'basic', name: 'Basic', code: 'line-basic' },
  { key: 'premium', name: 'Premium', code: 'line-premium' },
  { key: 'pro', name: 'Pro', code: 'line-pro', best: true },
  { key: 'business', name: 'Business', code: 'business' },
  { key: 'enterprise', name: 'Enterprise', code: 'enterprise' },
];

export interface PlanFamily {
  key: string;
  /** the name the public pricing page uses */
  name: string;
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

export function groupPlans(plans: readonly Plan[]): GroupedPlans {
  const byCode = new Map(plans.map((p) => [p.code, p]));
  const used = new Set<string>();
  const families: PlanFamily[] = [];
  for (const f of FAMILIES) {
    const month = byCode.get(f.code);
    const year = byCode.get(`${f.code}-year`);
    if (!month && !year) continue;
    families.push({ key: f.key, name: f.name, best: !!f.best, month, year });
    used.add(f.code);
    used.add(`${f.code}-year`);
  }
  const rest = plans.filter((p) => !used.has(p.code));
  return {
    families,
    internal: rest.filter((p) => p.priceMinor === 0),
    other: rest.filter((p) => p.priceMinor > 0),
  };
}

/** Front name for a plan code ("line-pro-year" → "Pro"); the DB name when the code is in no family. */
export function planFrontName(p: Pick<Plan, 'code' | 'name'>): string {
  const f = FAMILIES.find((x) => p.code === x.code || p.code === `${x.code}-year`);
  return f?.name ?? p.name;
}

/** Same order as the pricing page words them; a missing limit = unlimited. */
const LIMIT_ORDER = [
  'members',
  'branches',
  'messages_per_month',
  'customers',
] as const satisfies readonly (typeof PLAN_LIMITS)[number][];

/** "พนักงาน 8 บัญชี · 1 สาขา · แจ้งเตือน LINE 3,000 ข้อความ/เดือน · ลูกค้าไม่จำกัด" */
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
    sold: g.families.flatMap((f) => [f.month, f.year]).filter((p) => !!p),
    rest: [...g.other, ...g.internal],
  };
}
