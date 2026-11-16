import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { useIntlLocale } from '@/features/platform/format';
import type { OutboundEmail } from '../api';
import { STATUS_VARIANT } from '../lib';

/** Delivery status of a sent email (+ "ตัวอย่าง" for a sample to oneself). */
export function MailStatusBadge({ mail }: { mail: Pick<OutboundEmail, 'status' | 'isTest' | 'error'> }) {
  const { t } = useTranslation('mail');
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge variant={STATUS_VARIANT[mail.status]} title={mail.error ?? undefined}>
        {t(`status.${mail.status}`)}
      </Badge>
      {mail.isTest ? <Badge variant="outline">{t('testBadge')}</Badge> : null}
    </span>
  );
}

/** "ส่งเมลแล้ว 16 พ.ย. 12:30 → customer@example.test · ถึงแล้ว" */
export function MailHistoryLine({ mail }: { mail: OutboundEmail }) {
  const { t } = useTranslation('mail');
  const locale = useIntlLocale();
  const at = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
  }).format(new Date(mail.sentAt ?? mail.createdAt));
  return (
    <span className="min-w-0 break-words">
      {t(mail.isTest ? 'history.sentTest' : mail.status === 'queued' ? 'history.queued' : 'history.sent')}{' '}
      {at} → <span className="font-medium">{mail.to.join(', ')}</span>
      {mail.cc.length > 0 ? ` (CC ${mail.cc.join(', ')})` : ''} · {t(`status.${mail.status}`)}
      {mail.status === 'failed' && mail.error ? ` (${mail.error})` : ''}
    </span>
  );
}
