import { type ApiError, isApiError } from '@/lib/api';

/** 4–8 digits: same rule as the API (`platformIssuePinSetBody`). */
export const PIN_PATTERN = /^\d{4,8}$/;

function detail(e: ApiError, key: string): unknown {
  const d = e.details;
  return typeof d === 'object' && d !== null && key in d ? (d as Record<string, unknown>)[key] : undefined;
}

/**
 * The API refuses a bill without the team PIN, with a wrong one (403) or after 5 wrong ones in 15 minutes (429).
 * The PIN dialog shows these in place, so the mutation hooks do not also toast them.
 */
export function isIssuePinError(e: unknown): e is ApiError {
  return (
    isApiError(e) &&
    (e.code === 'ISSUE_PIN_REQUIRED' ||
      e.code === 'ISSUE_PIN_WRONG' ||
      (e.status === 429 && detail(e, 'reason') === 'pin_locked'))
  );
}

export type PinProblem =
  | { key: 'required' }
  | { key: 'wrong'; count: number }
  | { key: 'exhausted' }
  | { key: 'locked'; minutes: number };

export function pinProblemOf(e: ApiError): PinProblem {
  if (e.status === 429) {
    const secs = detail(e, 'retryAfterSeconds');
    return { key: 'locked', minutes: Math.max(1, Math.ceil((typeof secs === 'number' ? secs : 900) / 60)) };
  }
  if (e.code === 'ISSUE_PIN_REQUIRED') return { key: 'required' };
  const left = detail(e, 'attemptsLeft');
  return typeof left === 'number' && left > 0 ? { key: 'wrong', count: left } : { key: 'exhausted' };
}
