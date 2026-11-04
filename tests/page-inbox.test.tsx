import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refusal } from '@/features/page-inbox/api';
import { WindowBadge } from '@/features/page-inbox/components/window-badge';
import { timeLeft } from '@/features/page-inbox/lib/time';
import { ApiError } from '@/lib/api';
import en from '../src/locales/en/pageInbox.json';
import th from '../src/locales/th/pageInbox.json';

const t = (key: string, o?: Record<string, unknown>) => `${key}${o ? JSON.stringify(o) : ''}`;
const NOW = new Date('2026-11-04T10:00:00Z');
const at = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

// the badge's own translation hook is mocked: the test reads the key it chose
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('reply-by badge', () => {
  const badge = (free: number, human: number) =>
    render(
      <WindowBadge
        conversation={{
          lastCustomerMessageAt: at(-1),
          windowFreeEndsAt: at(free),
          windowHumanEndsAt: at(human),
        }}
      />,
    );

  it('green while the 24 h window is open, with the time left', () => {
    badge(5.5, 150);
    expect(screen.getByTestId('window-free').textContent).toContain('window.free');
    expect(screen.getByTestId('window-free').textContent).toContain('time.hm');
  });
  it('amber after 24 h: only a person may send, days left', () => {
    badge(-2, 50);
    expect(screen.getByTestId('window-human').textContent).toContain('window.human');
    expect(screen.getByTestId('window-human').textContent).toContain('time.dh');
  });
  it('grey once the 7 days are over', () => {
    badge(-100, -1);
    expect(screen.getByTestId('window-closed')).toBeTruthy();
  });
  it('timeLeft counts minutes, hours and days; null when over', () => {
    expect(timeLeft(at(0.2), NOW, t)).toContain('time.min');
    expect(timeLeft(at(30), NOW, t)).toContain('time.dh');
    expect(timeLeft(at(-1), NOW, t)).toBeNull();
    expect(timeLeft(null, NOW, t)).toBeNull();
  });
});

describe('send refusal', () => {
  it('reads the reason, Meta’s words and the wrong-facts list out of the API error', () => {
    const e = new ApiError({
      status: 409,
      code: 'CONFLICT',
      message: 'x',
      details: {
        reason: 'wrong_facts',
        message: 'm',
        issues: [{ code: 'expired_promo', message: 'จบแล้ว', severity: 'error' }],
      },
    });
    expect(refusal(e)).toEqual({
      reason: 'wrong_facts',
      message: 'm',
      issues: [{ code: 'expired_promo', message: 'จบแล้ว', severity: 'error' }],
    });
    expect(refusal(new Error('boom'))).toEqual({ reason: null, message: null, issues: [] });
  });
});

describe('locales', () => {
  const keys = (o: object, p = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) =>
      typeof v === 'object' && v !== null ? keys(v, `${p}${k}.`) : [`${p}${k}`],
    );
  it('Thai and English have the same keys', () => {
    expect(keys(en).sort()).toEqual(keys(th).sort());
  });
});
