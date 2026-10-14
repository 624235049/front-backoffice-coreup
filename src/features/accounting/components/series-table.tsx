import { useTranslation } from 'react-i18next';
import { useIntlLocale } from '@/features/platform/format';
import { cn } from '@/lib/utils';
import { formatAmountOrDash } from '../lib/format';
import { formatPeriod, type SeriesRow } from '../lib/reports';
import { DataTable } from './data-table';

/** Report grid: labels pinned on the left, one money column per period, a total column pinned on the right. */
export function SeriesTable({
  periods,
  rows,
  firstHeader,
}: {
  periods: readonly string[];
  rows: readonly SeriesRow[];
  firstHeader: string;
}) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  return (
    <DataTable maxHeight="max-h-[calc(100dvh-22rem)] min-h-48">
      <thead>
        <tr>
          <th className="sticky top-0 left-0 z-20 h-10 min-w-48 border-b bg-navy-50 px-3 text-left text-xs font-semibold text-navy-800">
            {firstHeader}
          </th>
          {periods.map((p) => (
            <th
              key={p}
              className="sticky top-0 z-10 h-10 border-b bg-navy-50 px-3 text-right text-xs font-semibold whitespace-nowrap text-navy-800"
            >
              {formatPeriod(p, locale)}
            </th>
          ))}
          <th className="sticky top-0 right-0 z-20 h-10 border-b border-l bg-navy-100 px-3 text-right text-xs font-semibold whitespace-nowrap text-navy-900">
            {t('report.total')}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const strong = r.kind === 'total' || r.kind === 'profit';
          const bg = r.kind === 'profit' ? 'bg-mint-50' : r.kind === 'total' ? 'bg-navy-50/70' : 'bg-white';
          return (
            <tr key={r.key} className={cn(bg, strong && 'font-semibold')}>
              <td
                className={cn(
                  'sticky left-0 z-[5] border-b border-navy-100/60 px-3 py-2.5',
                  bg,
                  r.kind === 'section' && 'pt-4 text-xs font-bold tracking-wide text-navy-700 uppercase',
                  r.kind === 'row' && 'pl-6',
                )}
              >
                {r.label}
              </td>
              {r.kind === 'section' ? (
                <td colSpan={periods.length + 1} className="border-b border-navy-100/60" />
              ) : (
                <>
                  {r.values.map((v, i) => (
                    <td
                      // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional by period
                      key={i}
                      className={cn(
                        'border-b border-navy-100/60 px-3 py-2.5 text-right whitespace-nowrap tabular-nums',
                        r.kind === 'profit' && v < 0 && 'text-destructive',
                        r.kind === 'profit' && v > 0 && 'text-success',
                      )}
                    >
                      {formatAmountOrDash(v, locale)}
                    </td>
                  ))}
                  <td
                    className={cn(
                      'sticky right-0 z-[5] border-b border-l border-navy-100/60 px-3 py-2.5 text-right whitespace-nowrap tabular-nums',
                      r.kind === 'profit' ? 'bg-mint-100' : 'bg-navy-50',
                      r.kind === 'profit' && r.totalMinor < 0 && 'text-destructive',
                      r.kind === 'profit' && r.totalMinor > 0 && 'text-success',
                    )}
                  >
                    {formatAmountOrDash(r.totalMinor, locale)}
                  </td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}
