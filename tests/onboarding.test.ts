import { describe, expect, it } from 'vitest';
import { addDays, daysAgo, doneCount } from '@/features/platform/onboarding';

describe('onboarding helpers', () => {
  it('counts finished milestones', () => {
    const none = {
      servicesSet: false,
      hoursSet: false,
      firstBooking: false,
      onlineBooking: false,
      lineConnected: false,
    };
    expect(doneCount(none)).toBe(0);
    expect(doneCount({ ...none, servicesSet: true, firstBooking: true })).toBe(2);
    expect(
      doneCount({
        servicesSet: true,
        hoursSet: true,
        firstBooking: true,
        onlineBooking: true,
        lineConnected: true,
      }),
    ).toBe(5);
  });

  it('adds calendar days across month ends', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-10-22', 1)).toBe('2026-10-23');
  });

  it('counts whole days ago and never goes negative', () => {
    const now = Date.parse('2026-10-22T10:00:00Z');
    expect(daysAgo('2026-10-22T02:00:00Z', now)).toBe(0);
    expect(daysAgo('2026-10-19T09:00:00Z', now)).toBe(3);
    expect(daysAgo('2026-10-23T10:00:00Z', now)).toBe(0);
  });
});
