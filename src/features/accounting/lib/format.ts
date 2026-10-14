/**
 * Display helpers for accounting tables and reports. Money is integer satang everywhere (AGENTS rule 7);
 * these helpers only format it, they never do float arithmetic on it.
 */

const TZ = 'Asia/Bangkok';

/** "1,234.50" — always two decimals so columns line up; no currency symbol (the column header says THB). */
export function formatAmount(minor: number, locale = 'th-TH'): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    minor / 100,
  );
}

/** Same as formatAmount but an empty cell for zero (keeps wide report tables readable). */
export function formatAmountOrDash(minor: number, locale = 'th-TH'): string {
  return minor === 0 ? '–' : formatAmount(minor, locale);
}

/** "1,234" integer count. */
export function formatInt(n: number, locale = 'th-TH'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

/** Quantity typed/stored as a decimal string ("1", "2.5") → trimmed display. */
export function formatQty(q: string | number, locale = 'th-TH'): string {
  const n = typeof q === 'number' ? q : Number.parseFloat(q);
  if (!Number.isFinite(n)) return String(q);
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(n);
}

/** Basis points → "7%" / "2.5%". */
export function formatBp(bp: number): string {
  const pct = bp / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0$/, '')}%`;
}

/** Sum a satang field over rows (integer sum, safe up to 2^53 satang). */
export function sumMinor<R>(rows: readonly R[], pick: (r: R) => number): number {
  let sum = 0;
  for (const r of rows) sum += pick(r);
  return sum;
}

/** A change in percent between two satang amounts; null when there is no baseline to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

/** "YYYY-MM" for a Date in Bangkok time. */
export function monthKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' })
    .format(d)
    .slice(0, 7);
}

/** "2026-10" → "ต.ค. 2569" (Thai) / "Oct 2026" (en). */
export function formatMonthKey(key: string, locale = 'th-TH'): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

/** Short month only ("ต.ค.") for chart axes. */
export function formatMonthShort(key: string, locale = 'th-TH'): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** First and last day ('YYYY-MM-DD') of the month containing `ymd`. */
export function monthBounds(ymd: string): { from: string; to: string } {
  const [y, m] = ymd.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
}

export type RangePreset = 'thisMonth' | 'lastMonth' | 'thisYear' | 'last12';

/** Date range ('YYYY-MM-DD' both inclusive) for a quick filter, relative to `today` (Bangkok 'YYYY-MM-DD'). */
export function presetRange(preset: RangePreset, today: string): { from: string; to: string } {
  const [y, m] = today.split('-').map(Number) as [number, number];
  switch (preset) {
    case 'thisMonth':
      return monthBounds(today);
    case 'lastMonth': {
      const prev = new Date(Date.UTC(y, m - 2, 1));
      return monthBounds(`${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}-01`);
    }
    case 'thisYear':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'last12': {
      const start = new Date(Date.UTC(y, m - 12, 1));
      return {
        from: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-01`,
        to: monthBounds(today).to,
      };
    }
  }
}

/** Whole days from `from` to `to` ('YYYY-MM-DD'); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Tailwind class for a signed amount (profit/loss). */
export function signTone(minor: number): string {
  if (minor < 0) return 'text-destructive';
  return minor > 0 ? 'text-success' : 'text-muted-foreground';
}
