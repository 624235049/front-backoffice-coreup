import { Link } from '@tanstack/react-router';
import { Mail, Paperclip, Plus, Settings } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { PageHeader } from '@/components/page-header';
import { ListSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, DtCell, DtHead, DtRow, DtTh } from '@/features/accounting/components/data-table';
import { detailPath } from '@/features/accounting/lib/doc-meta';
import { formatDateTime, useIntlLocale } from '@/features/platform/format';
import { useMembership } from '@/lib/membership';
import { type OutboundEmail, type OutboundStatus, useOutbox, useOutboxItem } from '../api';
import { MailComposer } from '../components/mail-composer';
import { MailStatusBadge } from '../components/mail-status';

const ALL = '__all__';
const STATUSES: readonly OutboundStatus[] = [
  'queued',
  'sent',
  'delivered',
  'opened',
  'bounced',
  'complained',
  'failed',
];

/** "Email ที่ส่ง": every customer email the team sent from sales@coreup.pro (and the samples), newest first; "อีเมลใหม่" = free-form. */
export function OutboxPage() {
  const { t } = useTranslation('mail');
  const locale = useIntlLocale();
  const roles = useMembership().roles;
  const isOwner = roles.includes('platform_owner');
  const canCompose = isOwner || roles.includes('platform_sales');
  const [status, setStatus] = useState<OutboundStatus | undefined>();
  const [composing, setComposing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useOutbox({ status });
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <>
      <PageHeader
        title={t('page.title')}
        description={t('replyNote')}
        actions={
          <>
            {isOwner ? (
              <Button asChild variant="outline">
                <Link to={'/mail/settings' as never}>
                  <Settings /> {t('page.settings')}
                </Link>
              </Button>
            ) : null}
            {canCompose ? (
              <Button onClick={() => setComposing(true)} data-testid="mail-new">
                <Plus /> {t('page.new')}
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={status ?? ALL}
          onValueChange={(v) => setStatus(v === ALL ? undefined : (v as OutboundStatus))}
        >
          <SelectTrigger className="w-48" aria-label={t('page.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('page.allStatuses')}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {list.isPending ? <ListSkeleton /> : null}
      {list.isError ? <ErrorState error={list.error} onRetry={() => void list.refetch()} /> : null}
      {list.data && rows.length === 0 ? (
        <EmptyState icon={Mail} title={t('page.empty')} description={t('page.emptyHint')} />
      ) : null}
      {rows.length > 0 ? (
        <DataTable maxHeight="max-h-none">
          <DtHead>
            <DtTh>{t('col.when')}</DtTh>
            <DtTh>{t('col.status')}</DtTh>
            <DtTh>{t('col.to')}</DtTh>
            <DtTh>{t('col.subject')}</DtTh>
            <DtTh>{t('col.document')}</DtTh>
            <DtTh>{t('col.sender')}</DtTh>
          </DtHead>
          <tbody>
            {rows.map((m) => (
              <DtRow key={m.id} onClick={() => setOpenId(m.id)} data-testid="outbox-row">
                <DtCell className="whitespace-nowrap">
                  {formatDateTime(m.sentAt ?? m.createdAt, locale)}
                </DtCell>
                <DtCell>
                  <MailStatusBadge mail={m} />
                </DtCell>
                <DtCell className="max-w-56 truncate">{m.to.join(', ')}</DtCell>
                <DtCell className="max-w-80">
                  <span className="line-clamp-2 break-words">{m.subject}</span>
                  {m.attachments.length > 0 ? (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Paperclip className="size-3" aria-hidden /> {m.attachments.length}
                    </span>
                  ) : null}
                </DtCell>
                <DtCell className="whitespace-nowrap">
                  <DocLink mail={m} />
                </DtCell>
                <DtCell className="whitespace-nowrap">{m.sentBy.name}</DtCell>
              </DtRow>
            ))}
          </tbody>
        </DataTable>
      ) : null}
      {list.hasNextPage ? (
        <div className="mt-3 text-center">
          <Button
            variant="outline"
            onClick={() => void list.fetchNextPage()}
            disabled={list.isFetchingNextPage}
          >
            {t('page.more')}
          </Button>
        </div>
      ) : null}

      {composing ? <MailComposer kind="free" onClose={() => setComposing(false)} /> : null}
      {openId ? <MailDetail id={openId} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

function DocLink({ mail }: { mail: OutboundEmail }) {
  const { t } = useTranslation('mail');
  if (!mail.documentId || mail.kind === 'free')
    return <span className="text-muted-foreground">{t('kind.free')}</span>;
  return (
    <Link
      to={detailPath(mail.kind, mail.documentId) as never}
      onClick={(e) => e.stopPropagation()}
      className="font-mono text-mint-700 hover:underline"
    >
      {mail.documentNumber}
    </Link>
  );
}

/** One sent email as it went out: the sender line, recipients, files, the times and the body snapshot. */
function MailDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation('mail');
  const locale = useIntlLocale();
  const item = useOutboxItem(id);
  const m = item.data;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t('close')} className="max-h-[92dvh] sm:max-w-2xl" data-testid="mail-detail">
        <DialogHeader>
          <DialogTitle>{m?.subject ?? t('page.title')}</DialogTitle>
          <DialogDescription>{m ? <MailStatusBadge mail={m} /> : null}</DialogDescription>
        </DialogHeader>
        {item.isPending ? <ListSkeleton rows={3} /> : null}
        {item.isError ? <ErrorState error={item.error} onRetry={() => void item.refetch()} /> : null}
        {m ? (
          <div className="grid gap-3 text-sm">
            <dl className="grid gap-1">
              <Line label={t('field.from')}>{m.from}</Line>
              <Line label={t('field.to')}>{m.to.join(', ')}</Line>
              {m.cc.length > 0 ? <Line label="CC">{m.cc.join(', ')}</Line> : null}
              {m.bcc.length > 0 ? <Line label="BCC">{m.bcc.join(', ')}</Line> : null}
              <Line label={t('col.sender')}>{m.sentBy.name}</Line>
              <Line label={t('col.when')}>
                {formatDateTime(m.createdAt, locale)}
                {m.deliveredAt ? ` · ${t('status.delivered')} ${formatDateTime(m.deliveredAt, locale)}` : ''}
                {m.openedAt ? ` · ${t('status.opened')} ${formatDateTime(m.openedAt, locale)}` : ''}
              </Line>
              {m.error ? <Line label={t('col.error')}>{m.error}</Line> : null}
            </dl>
            {m.attachments.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {m.attachments.map((a) => (
                  <li
                    key={a.name}
                    className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                  >
                    <Paperclip className="size-3.5" aria-hidden /> {a.name}
                  </li>
                ))}
              </ul>
            ) : null}
            <iframe
              title={t('preview.frame')}
              sandbox=""
              srcDoc={m.html}
              className="h-80 w-full rounded-md border bg-white"
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
