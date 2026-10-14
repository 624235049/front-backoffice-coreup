/** Calendar helpers for the date pickers. Dates are ISO `YYYY-MM-DD`, months `YYYY-MM`; labels follow the UI locale. */

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM` shifted by `delta` months. */
export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export type DayCell = { ymd: string; day: number };

/** Month grid starting on Sunday: `null` for the blanks before day 1, then every day of the month. */
export function buildMonthGrid(ym: string): (DayCell | null)[] {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => ({ ymd: `${ym}-${pad(i + 1)}`, day: i + 1 })),
  ];
}

/** Weekday names Sunday → Saturday: narrow for Thai ("อา", "จ" …; the short form is the full name), short otherwise. */
export function weekdayNames(locale: string): string[] {
  const f = new Intl.DateTimeFormat(locale, {
    weekday: locale.startsWith('th') ? 'narrow' : 'short',
    timeZone: 'UTC',
  });
  // 2026-10-04 is a Sunday
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2026, 9, 4 + i))));
}

/** Short month names January → December. */
export function monthNames(locale: string): string[] {
  const f = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, i) => f.format(new Date(Date.UTC(2026, i, 1))));
}

/** 2026 → "2569" (th, Buddhist year) / "2026" (en). */
export function yearLabel(year: number, locale: string): string {
  return locale.startsWith('th') ? String(year + 543) : String(year);
}
