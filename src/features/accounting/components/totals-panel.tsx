import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useIntlLocale } from '@/features/platform/format';
import { cn } from '@/lib/utils';
import type { CalcTotals } from '../lib/calc';
import { formatAmount, formatBp } from '../lib/format';

type VatMode = 'exclusive' | 'inclusive' | 'none';

function Row({
  label,
  value,
  strong,
  muted,
  tone,
}: {
  label: ReactNode;
  value: string;
  strong?: boolean;
  muted?: boolean;
  tone?: 'warning';
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-6 py-1 text-sm',
        strong && 'border-t-2 border-navy-200 pt-2 text-base font-semibold text-navy-900',
        muted && 'text-muted-foreground',
        tone === 'warning' && 'text-warning',
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Breakdown shown beside the editor and on the detail page: lines → discount → VAT → total → WHT → net. */
export function TotalsPanel({
  totals,
  vatMode,
  vatRateBp,
  whtBp,
  className,
  children,
}: {
  totals: CalcTotals;
  vatMode: VatMode;
  vatRateBp: number;
  whtBp: number;
  className?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const m = (v: number) => formatAmount(v, locale);
  const base = totals.taxableMinor + totals.exemptMinor;
  return (
    <div className={cn('rounded-xl border bg-white p-4 shadow-xs', className)}>
      <Row label={t('totals.lines')} value={m(totals.linesTotalMinor)} />
      {totals.discountMinor > 0 ? (
        <Row label={t('totals.discount')} value={`-${m(totals.discountMinor)}`} />
      ) : null}
      <Row label={t('totals.base')} value={m(base)} />
      {vatMode !== 'none' ? (
        <Row
          label={`${t('totals.vat')} ${formatBp(vatRateBp)}${vatMode === 'inclusive' ? ` (${t('totals.included')})` : ''}`}
          value={m(totals.vatMinor)}
        />
      ) : null}
      <Row label={t('totals.grand')} value={m(totals.totalMinor)} strong />
      {whtBp > 0 ? (
        <>
          <Row label={`${t('totals.wht')} ${formatBp(whtBp)}`} value={`-${m(totals.whtMinor)}`} muted />
          <Row label={t('totals.net')} value={m(totals.netMinor)} />
        </>
      ) : null}
      {children}
    </div>
  );
}
