import { LifeBuoy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { formatDateTime, useIntlLocale } from '../format';
import {
  type SupportCaseDetail,
  type SupportCaseStatus,
  usePatchSupportCase,
  useSupportCase,
  useSupportCases,
} from '../support-cases-api';

const STATUSES = ['open', 'in_progress', 'done'] as const;
const TONE = { open: 'warning', in_progress: 'secondary', done: 'success' } as const;
const NOTE_MAX = 2000;

function StatusBadge({ status }: { status: SupportCaseStatus }) {
  const { t } = useTranslation('supportCases');
  return <Badge variant={TONE[status]}>{t(`status.${status}`)}</Badge>;
}

/** "เคสจากร้าน": problems shop staff sent from the in-app assistant; open ones first, a side sheet to read and answer. */
export function SupportCasesPage() {
  const { t } = useTranslation('supportCases');
  const locale = useIntlLocale();
  const [filter, setFilter] = useState<SupportCaseStatus | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const cases = useSupportCases(filter === 'all' ? undefined : filter);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <Tabs value={filter} onValueChange={(v) => setFilter(v as SupportCaseStatus | 'all')} className="mb-4">
        <TabsList aria-label={t('filter.label')}>
          {(['all', ...STATUSES] as const).map((s) => (
            <TabsTrigger key={s} value={s}>
              {t(`filter.${s}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <QueryState
        query={cases}
        isEmpty={(rows) => rows.length === 0}
        empty={<EmptyState icon={LifeBuoy} title={t('empty.title')} description={t('empty.description')} />}
      >
        {(rows) => (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.status')}</TableHead>
                  <TableHead>{t('columns.shop')}</TableHead>
                  <TableHead>{t('columns.title')}</TableHead>
                  <TableHead>{t('columns.page')}</TableHead>
                  <TableHead>{t('columns.sentAt')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id} data-testid="support-case-row">
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="font-medium">{c.tenantName}</TableCell>
                    <TableCell className="max-w-md">
                      {/* the summary is the row's button: one tab stop, readable by screen readers */}
                      <button
                        type="button"
                        className={cn(
                          'text-left underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring',
                          c.status === 'open' && 'font-semibold',
                        )}
                        onClick={() => setOpenId(c.id)}
                      >
                        {c.title}
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {c.pagePath || '–'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(c.createdAt, locale)}
                    </TableCell>
                  </TableRow>
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
      <Sheet open={openId !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent
          side="right"
          closeLabel={t('detail.close')}
          className="w-full overflow-y-auto sm:max-w-xl"
        >
          <CaseDetail id={openId} />
        </SheetContent>
      </Sheet>
    </>
  );
}

function CaseDetail({ id }: { id: string | null }) {
  const detail = useSupportCase(id);
  return (
    <QueryState query={detail} skeleton={<Skeleton className="m-4 h-40" />}>
      {(c) => <CaseBody key={c.id} c={c} />}
    </QueryState>
  );
}

function CaseBody({ c }: { c: SupportCaseDetail }) {
  const { t } = useTranslation('supportCases');
  const locale = useIntlLocale();
  const canWrite = useCan('platform:write');
  const patch = usePatchSupportCase(c.id);
  const [status, setStatus] = useState<SupportCaseStatus>(c.status);
  const [note, setNote] = useState(c.staffNote ?? '');
  // a refresh from the server (someone else changed the case) replaces what is shown
  useEffect(() => {
    setStatus(c.status);
    setNote(c.staffNote ?? '');
  }, [c.status, c.staffNote]);
  const dirty = status !== c.status || note.trim() !== (c.staffNote ?? '');

  return (
    <div className="grid content-start gap-4 p-4 pt-6" data-testid="support-case-detail">
      <div>
        <SheetTitle>{t('detail.title', { shop: c.tenantName })}</SheetTitle>
        <SheetDescription>
          {t('detail.from', { name: c.createdByName, when: formatDateTime(c.createdAt, locale) })}
        </SheetDescription>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {t('detail.page', { page: c.pagePath || '–' })}
        </p>
      </div>
      <p className="text-lg font-semibold">{c.title}</p>

      <section className="grid gap-1">
        <h3 className="text-sm font-medium">{t('detail.words')}</h3>
        <p className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-sm">{c.detail}</p>
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-medium">{t('detail.transcript')}</h3>
        {c.transcript.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('detail.emptyTranscript')}</p>
        ) : (
          <ol className="grid gap-2">
            {c.transcript.map((m, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: a stored transcript never reorders
                key={i}
                className={cn(
                  'max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm',
                  m.role === 'user' ? 'justify-self-end bg-primary text-primary-foreground' : 'bg-muted',
                )}
              >
                <span className="sr-only">
                  {t(m.role === 'user' ? 'detail.staff' : 'detail.assistant')}:{' '}
                </span>
                {m.text}
              </li>
            ))}
          </ol>
        )}
      </section>

      <form
        className="grid gap-3 border-t pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          patch.mutate(
            { status, staffNote: note.trim() || null },
            { onSuccess: () => toast.success(t('detail.saved')) },
          );
        }}
      >
        {!canWrite ? <p className="text-sm text-muted-foreground">{t('detail.readOnly')}</p> : null}
        <div className="grid gap-1">
          <Label htmlFor="case-status">{t('detail.status')}</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as SupportCaseStatus)}
            disabled={!canWrite}
          >
            <SelectTrigger id="case-status" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="case-note">{t('detail.note')}</Label>
          <Textarea
            id="case-note"
            rows={4}
            maxLength={NOTE_MAX}
            value={note}
            disabled={!canWrite}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t('detail.noteHint')}</p>
        </div>
        {c.resolvedAt ? (
          <p className="text-xs text-muted-foreground">
            {t('detail.resolvedAt', { when: formatDateTime(c.resolvedAt, locale) })}
          </p>
        ) : null}
        <Button type="submit" className="w-fit" disabled={!canWrite || !dirty || patch.isPending}>
          {t('detail.save')}
        </Button>
      </form>
    </div>
  );
}
