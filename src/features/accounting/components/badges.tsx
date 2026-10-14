import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { DocStatus, SalesRow } from '../api';
import { STATUS_TONE } from '../lib/doc-meta';

/** Status text + colour (never colour alone). `overdue` is an extra flag on issued invoices. */
export function DocStatusBadge({ status, overdue }: { status: DocStatus; overdue?: boolean }) {
  const { t } = useTranslation('accounting');
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={STATUS_TONE[status]}>{t(`status.${status}`)}</Badge>
      {overdue && status !== 'void' && status !== 'paid' ? (
        <Badge variant={STATUS_TONE.overdue}>{t('status.overdue')}</Badge>
      ) : null}
    </span>
  );
}

export function SourceBadge({ source }: { source: SalesRow['source'] }) {
  const { t } = useTranslation('accounting');
  if (source === 'accounting') return null;
  return <Badge variant="secondary">{t(`source.${source}`)}</Badge>;
}
