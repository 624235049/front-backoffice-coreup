import { describe, expect, it } from 'vitest';
import { type Branches, type PickAnswers, recommendPlan, type Staff } from '@/features/platform/plan-picker';

const pick = (branches: Branches, big: boolean, staff: Staff) =>
  recommendPlan({ branches, big, staff } as PickAnswers);

describe('recommendPlan (3 questions, same rules as coreup.pro/queue)', () => {
  it('4+ branches is Enterprise and 2-3 branches is Business, whatever else is answered', () => {
    expect(pick('4+', false, 'solo')).toBe('enterprise');
    expect(pick('2-3', false, 'solo')).toBe('business');
    expect(pick('2-3', true, '7+')).toBe('business');
  });
  it('one branch: clinic, big spa, stock-heavy or 7+ people is Business', () => {
    expect(pick('1', true, 'solo')).toBe('business');
    expect(pick('1', false, '7+')).toBe('business');
  });
  it('one plain branch follows the staff count', () => {
    expect(pick('1', false, 'solo')).toBe('basic');
    expect(pick('1', false, 'soloPay')).toBe('premium');
    expect(pick('1', false, '2-3')).toBe('premium');
    expect(pick('1', false, '4-6')).toBe('pro');
  });
});
