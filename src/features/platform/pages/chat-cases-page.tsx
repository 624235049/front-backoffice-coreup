import { useSearch } from '@tanstack/react-router';
import { MessageCircleWarning } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCan } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { type ChatCase, type ChatCaseStatus, useChatCases, usePatchChatCase } from '../chat-cases-api';
import { formatDateTime, useIntlLocale } from '../format';

const FILTERS = ['open', 'done', 'all'] as const;

/** "เคสรอตอบ": what the support AI queued for the team (or escalated) from LINE / Facebook / Instagram; close a case when answered. */
export function ChatCasesPage() {
  const { t } = useTranslation('chatCases');
  const locale = useIntlLocale();
  const canWrite = useCan('platform:write');
  const { case: focus } = useSearch({ from: '/_app/platform/chat-cases' });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('open');
  const cases = useChatCases(filter === 'all' ? undefined : filter);
  const patch = usePatchChatCase();

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <Tabs value={filter} onValueChange={(v) => setFilter(v as (typeof FILTERS)[number])} className="mb-4">
        <TabsList aria-label={t('filter.label')}>
          {FILTERS.map((s) => (
            <TabsTrigger key={s} value={s}>
              {t(`filter.${s}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <QueryState
        query={cases}
        isEmpty={(rows) => rows.length === 0}
        empty={
          <EmptyState
            icon={MessageCircleWarning}
            title={t('empty.title')}
            description={t('empty.description')}
          />
        }
      >
        {(rows) => (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.urgency')}</TableHead>
                  <TableHead>{t('columns.shop')}</TableHead>
                  <TableHead>{t('columns.message')}</TableHead>
                  <TableHead>{t('columns.channel')}</TableHead>
                  <TableHead>{t('columns.at')}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t('columns.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <CaseRow
                    key={c.id}
                    c={c}
                    focused={c.id === focus}
                    locale={locale}
                    canWrite={canWrite}
                    pending={patch.isPending}
                    onSet={(status) => patch.mutate({ id: c.id, status })}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>
      {cases.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={cases.isFetchingNextPage}
            onClick={() => void cases.fetchNextPage()}
          >
            {t('loadMore')}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function CaseRow(p: {
  c: ChatCase;
  focused: boolean;
  locale: string;
  canWrite: boolean;
  pending: boolean;
  onSet: (status: ChatCaseStatus) => void;
}) {
  const { t } = useTranslation('chatCases');
  const { c } = p;
  return (
    <TableRow data-testid="chat-case-row" className={cn(p.focused && 'bg-accent/50')}>
      <TableCell className="whitespace-nowrap">
        {c.status === 'done' ? (
          <Badge variant="success">{t('status.done')}</Badge>
        ) : c.urgency === 'emergency' ? (
          <Badge variant="destructive">{t('urgency.emergency')}</Badge>
        ) : (
          <Badge variant="warning">{t('urgency.normal')}</Badge>
        )}
        <div className="mt-1 text-xs text-muted-foreground">{t(`category.${c.category}`)}</div>
      </TableCell>
      <TableCell className="font-medium">{c.tenantName}</TableCell>
      <TableCell className="max-w-md">
        <p className={cn('whitespace-pre-wrap text-sm', c.status === 'open' && 'font-semibold')}>
          {c.message}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {c.followUps > 0 ? <span>{t('followUps', { count: c.followUps })}</span> : null}
          {c.recognizedVia === 'name' ? <span>{t('weakMatch')}</span> : null}
          {c.invoiceNumber ? <span>{t('invoice', { number: c.invoiceNumber })}</span> : null}
          {c.attachmentUrl ? (
            <a className="underline" href={c.attachmentUrl} target="_blank" rel="noreferrer">
              {t('picture')}
            </a>
          ) : null}
          {c.leadId ? (
            <a className="underline" href={`/platform/sales?lead=${c.leadId}`}>
              {t('openChat')}
            </a>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm">{t(`channel.${c.channel}`)}</TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
        {formatDateTime(c.createdAt, p.locale)}
      </TableCell>
      <TableCell className="text-right">
        {p.canWrite ? (
          <Button
            type="button"
            size="sm"
            variant={c.status === 'open' ? 'default' : 'outline'}
            disabled={p.pending}
            onClick={() => p.onSet(c.status === 'open' ? 'done' : 'open')}
          >
            {c.status === 'open' ? t('markDone') : t('reopen')}
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
