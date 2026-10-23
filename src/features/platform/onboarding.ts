import type { OnboardingRow } from './api';

export const DAY = 86_400_000;

/** The path to a first real booking, in the order a shop usually walks it. */
export const MILESTONES = [
  'servicesSet',
  'hoursSet',
  'firstBooking',
  'onlineBooking',
  'lineConnected',
] as const;

export const doneCount = (m: OnboardingRow['milestones']) => MILESTONES.filter((k) => m[k]).length;

/** Whole days from a past instant to `now` (0 = less than 24h ago). */
export const daysAgo = (iso: string, now = Date.now()) =>
  Math.max(0, Math.floor((now - Date.parse(iso)) / DAY));

/** `YYYY-MM-DD` plus `n` calendar days (Bangkok dates are plain calendar days, so UTC maths is exact). */
export const addDays = (date: string, n: number) =>
  new Date(Date.parse(date) + n * DAY).toISOString().slice(0, 10);
