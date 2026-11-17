import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { LineQuota, PageList } from '../api';
import { ChannelIcon } from './channel-icon';

const nf = new Intl.NumberFormat('en-US');

/** Share of the monthly cap used, 0–100 (an OA without a cap shows an empty bar). */
export const usedPercent = (q: LineQuota): number =>
  q.limit ? Math.min(100, Math.round((q.used / q.limit) * 100)) : 0;

/**
 * Top of the list: CoreUp's LINE OA with this month's push quota (used / limit, the worker's cached count) and the one thing the
 * team must know about this channel: what is typed in LINE OA Manager never reaches us.
 */
export function LineQuotaStrip({ line }: { line: NonNullable<PageList['line']> }) {
  const { t } = useTranslation('pageInbox');
  const q = line.quota;
  return (
    <div className="grid gap-1 border-b bg-[var(--card)] px-3 py-2 text-xs" data-testid="line-quota">
      <div className="flex items-center gap-1.5">
        <ChannelIcon channel="line" />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{line.accountName}</span>
        {q ? (
          <span
            className={cn('tabular-nums', q.low ? 'font-semibold text-destructive' : 'text-muted-foreground')}
            data-testid="line-quota-count"
          >
            {q.limit
              ? t('quota.usedOf', { used: nf.format(q.used), limit: nf.format(q.limit) })
              : t('quota.usedNoCap', { used: nf.format(q.used) })}
          </span>
        ) : (
          <span className="text-muted-foreground">{t('quota.unknown')}</span>
        )}
      </div>
      {q?.limit ? (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={t('quota.label')}
          aria-valuemin={0}
          aria-valuemax={q.limit}
          aria-valuenow={Math.min(q.used, q.limit)}
        >
          <div
            className={cn(
              'h-full rounded-full',
              q.low ? 'bg-destructive' : q.warn ? 'bg-warning' : 'bg-[#06C755]',
            )}
            style={{ width: `${usedPercent(q)}%` }}
          />
        </div>
      ) : null}
      {q?.low ? (
        <p className="font-medium text-destructive" data-testid="line-quota-low">
          {q.exhausted ? t('quota.exhausted') : t('quota.low')}
        </p>
      ) : null}
      <p className="text-muted-foreground" data-testid="line-oa-note">
        {t('quota.oaManagerNote')}
      </p>
    </div>
  );
}
