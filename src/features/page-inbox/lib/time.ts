import { useEffect, useState } from 'react';
import { useTenant } from '@/lib/membership';

/** A clock that ticks every `ms` (default one minute): the countdown badges re-render by themselves. */
export function useNow(ms = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** "5 ชม. 20 น." / "2 วัน 4 ชม." / "12 น." for the time left until `endIso`; null when it is already over. */
export function timeLeft(
  endIso: string | null,
  now: Date,
  t: (key: string, o?: Record<string, unknown>) => string,
): string | null {
  if (!endIso) return null;
  const min = Math.floor((Date.parse(endIso) - now.getTime()) / 60_000);
  if (min <= 0) return null;
  if (min < 60) return t('time.min', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('time.hm', { h, m: min % 60 });
  return t('time.dh', { d: Math.floor(h / 24), h: h % 24 });
}

/** Chat times in the CoreUp team's timezone: "14:35", "เมื่อวาน", "4 พ.ย.". */
export function useChatTime(t: (key: string) => string) {
  const tenant = useTenant();
  const locale = tenant.locale === 'en' ? 'en-GB' : 'th-TH';
  const tz = tenant.timezone;
  const hm = new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const dm = new Intl.DateTimeFormat(locale, { timeZone: tz, day: 'numeric', month: 'short' });
  const full = new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
  const daysAgo = (iso: string, now: Date) =>
    Math.round(
      (Date.parse(`${dayKey(now)}T00:00:00Z`) - Date.parse(`${dayKey(new Date(iso))}T00:00:00Z`)) /
        86_400_000,
    );
  return {
    time: (iso: string) => hm.format(new Date(iso)),
    full: (iso: string) => full.format(new Date(iso)),
    listTime: (iso: string, now: Date = new Date()) => {
      const n = daysAgo(iso, now);
      return n <= 0 ? hm.format(new Date(iso)) : n === 1 ? t('time.yesterday') : dm.format(new Date(iso));
    },
    dayKey: (iso: string) => dayKey(new Date(iso)),
    dayLabel: (iso: string, now: Date = new Date()) => {
      const n = daysAgo(iso, now);
      return n <= 0 ? t('time.today') : n === 1 ? t('time.yesterday') : dm.format(new Date(iso));
    },
  };
}
