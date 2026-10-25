import type { ApiBody } from '@/lib/api';
import type { Plan } from './api';

// `branch_insights` (Enterprise) and `expenses` (Business) are newer than this app's openapi copy: drop the extra member after the next `pnpm gen:api`
type ModuleKey = NonNullable<ApiBody<'/v1/platform/plans', 'post'>['modules']>[number] | 'branch_insights' | 'expenses';

/**
 * Shop modules the team can sell in a plan or switch on per shop (the API's `moduleKey` minus the internal
 * `audit` / `ai` / `platform`). `core` is always on. Order = order shown on screen.
 */
export const SHOP_MODULES = [
  'core',
  'crm',
  'messaging',
  'booking',
  'checkout',
  'payouts',
  'inventory',
  'shifts',
  'checklists',
  'sop',
  'surveys',
  'reports',
  'approvals',
  'clinical',
  'kpi',
  'expenses',
  'branch_insights',
  'lite',
] as const satisfies readonly ModuleKey[];

/** The limit keys the API enforces (`PLAN_LIMIT_KEYS`); a missing key = unlimited, except `slip_checks_month` (0 – 2,000, never unlimited). */
export const PLAN_LIMITS = [
  'branches',
  'members',
  'customers',
  'messages_per_month',
  'slip_checks_month',
] as const satisfies readonly (keyof NonNullable<ApiBody<'/v1/platform/plans', 'post'>['limits']>)[];

/** New-shop default: the cheapest active plan with a real price (฿0 seed plans are quoted per shop). */
export const defaultPlanCode = (plans: Plan[] | undefined): string | undefined =>
  [...(plans ?? [])].sort((a, b) => a.priceMinor - b.priceMinor).find((p) => p.active && p.priceMinor > 0)
    ?.code;
