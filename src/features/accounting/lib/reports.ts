import type { ExpensesByCategory, ProfitLoss } from '../api';
import { formatMonthKey } from './format';
import type { XlsxColumn } from './xlsx';

/** One display row of a period report (also the Excel row). Money is satang per period column. */
export type SeriesRow = {
  /** 'section' = heading without numbers, 'total' = bold subtotal, 'profit' = bottom line */
  kind: 'section' | 'row' | 'total' | 'profit';
  key: string;
  label: string;
  values: number[];
  totalMinor: number;
};

/** 'YYYY-MM' → "ต.ค. 2569", 'YYYY' → "2569" (Buddhist year for th). */
export function formatPeriod(period: string, locale = 'th-TH'): string {
  if (/^\d{4}$/.test(period)) {
    return locale.startsWith('th') ? String(Number(period) + 543) : period;
  }
  return formatMonthKey(period, locale);
}

const zeros = (n: number) => Array.from({ length: n }, () => 0);

/**
 * Flatten the profit & loss response into display rows: revenue rows → total revenue → expense rows →
 * total expenses → profit. Labels come from the caller (i18n) so this stays pure.
 */
export function buildProfitLossRows(
  pnl: ProfitLoss,
  labels: { revenue: string; expenses: string; totalRevenue: string; totalExpenses: string; profit: string },
  revenueLabel: (key: string, fallback: string) => string,
): SeriesRow[] {
  const n = pnl.periods.length;
  return [
    { kind: 'section', key: 'rev', label: labels.revenue, values: zeros(n), totalMinor: 0 },
    ...pnl.revenue.rows.map((r) => ({
      kind: 'row' as const,
      key: `rev:${r.key}`,
      label: revenueLabel(r.key, r.label),
      values: r.values,
      totalMinor: r.totalMinor,
    })),
    {
      kind: 'total',
      key: 'rev-total',
      label: labels.totalRevenue,
      values: pnl.revenue.totals,
      totalMinor: pnl.revenue.totalMinor,
    },
    { kind: 'section', key: 'exp', label: labels.expenses, values: zeros(n), totalMinor: 0 },
    ...pnl.expenses.rows.map((r) => ({
      kind: 'row' as const,
      key: `exp:${r.key}`,
      label: r.label,
      values: r.values,
      totalMinor: r.totalMinor,
    })),
    {
      kind: 'total',
      key: 'exp-total',
      label: labels.totalExpenses,
      values: pnl.expenses.totals,
      totalMinor: pnl.expenses.totalMinor,
    },
    {
      kind: 'profit',
      key: 'profit',
      label: labels.profit,
      values: pnl.profit.values,
      totalMinor: pnl.profit.totalMinor,
    },
  ];
}

export function buildCategoryRows(report: ExpensesByCategory, totalLabel: string): SeriesRow[] {
  return [
    ...report.expenses.rows.map((r) => ({
      kind: 'row' as const,
      key: r.key,
      label: r.label,
      values: r.values,
      totalMinor: r.totalMinor,
    })),
    {
      kind: 'total',
      key: 'total',
      label: totalLabel,
      values: report.expenses.totals,
      totalMinor: report.expenses.totalMinor,
    },
  ];
}

/** Excel columns for a period report: label, one money column per period, then the row total. */
export function seriesColumns(
  periods: readonly string[],
  firstHeader: string,
  totalHeader: string,
  locale: string,
): XlsxColumn<SeriesRow>[] {
  return [
    { header: firstHeader, width: 34, value: (r) => r.label },
    ...periods.map(
      (p, i): XlsxColumn<SeriesRow> => ({
        header: formatPeriod(p, locale),
        kind: 'money',
        value: (r) => (r.kind === 'section' ? null : (r.values[i] ?? 0)),
      }),
    ),
    {
      header: totalHeader,
      kind: 'money',
      value: (r) => (r.kind === 'section' ? null : r.totalMinor),
    },
  ];
}
