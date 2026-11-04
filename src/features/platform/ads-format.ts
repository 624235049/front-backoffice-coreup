import { formatMoney } from './format';

/** Satang or "–" when the metric has no denominator (the API sends null). */
export const money = (minor: number | null | undefined, locale: string): string =>
  minor === null || minor === undefined ? '–' : formatMoney(minor, locale);

/** `0.67` → "0.67×"; null → "–" */
export const times = (n: number | null | undefined): string =>
  n === null || n === undefined ? '–' : `${n}×`;

export const num = (n: number | null | undefined, locale: string, digits = 0): string =>
  n === null || n === undefined
    ? '–'
    : new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);

export const percent = (n: number | null | undefined): string =>
  n === null || n === undefined ? '–' : `${n}%`;

/** Evidence of a suggestion as text for the i18n body: `…Minor` numbers are baht, null is "–". */
export function evidenceVars(
  evidence: Record<string, number | string | null>,
  locale: string,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(evidence).map(([k, v]) => [
      k,
      v === null
        ? '–'
        : typeof v === 'number'
          ? k.endsWith('Minor')
            ? formatMoney(v, locale)
            : num(v, locale, 2)
          : v,
    ]),
  );
}

const shift = (ymd: string, days: number): string => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Range presets of the page: this month so far, or the last N days ending today. */
export const rangeOf = (preset: 'month' | '7' | '30', today: string): { from: string; to: string } =>
  preset === 'month'
    ? { from: `${today.slice(0, 7)}-01`, to: today }
    : { from: shift(today, -(Number(preset) - 1)), to: today };

/** Light CSV-free helper for goal inputs: "1,200.50" baht → satang; "" → null; invalid → undefined. */
export function bahtToMinor(input: string): number | null | undefined {
  const s = input.replace(/[,\s฿]/g, '');
  if (s === '') return null;
  return /^\d+(\.\d{1,2})?$/.test(s) ? Math.round(Number.parseFloat(s) * 100) : undefined;
}

/** "5" → 5; "" → null; anything not a whole number ≥ 0 → undefined. */
export function wholeOrNull(input: string): number | null | undefined {
  const s = input.trim();
  if (s === '') return null;
  return /^\d+$/.test(s) ? Number(s) : undefined;
}
