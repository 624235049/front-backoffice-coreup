/** The 3 questions sales ask a shop to pick a package; the same questions and rules as the pricing page (coreup.pro/queue). */
export type Branches = '1' | '2-3' | '4+';
export type Staff = 'solo' | 'soloPay' | '2-3' | '4-6' | '7+';

export interface PickAnswers {
  branches: Branches;
  /** needs stock control (goods or medicine) or a staff roster */
  big: boolean;
  staff: Staff;
}

export const BRANCH_CHOICES: readonly Branches[] = ['1', '2-3', '4+'];
export const STAFF_CHOICES: readonly Staff[] = ['solo', 'soloPay', '2-3', '4-6', '7+'];

export type PlanFamilyKey = 'basic' | 'premium' | 'pro' | 'business' | 'enterprise';

export function recommendPlan(a: PickAnswers): PlanFamilyKey {
  if (a.branches === '4+') return 'enterprise';
  if (a.branches === '2-3' || a.big) return 'business';
  if (a.staff === '7+') return 'business';
  return ({ solo: 'basic', soloPay: 'premium', '2-3': 'premium', '4-6': 'pro' } as const)[a.staff];
}
