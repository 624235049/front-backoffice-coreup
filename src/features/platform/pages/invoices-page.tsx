import { Download, Plus, Receipt } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { A4Link } from '@/features/accounting/components/a4-actions';
import { downloadXlsx } from '@/features/accounting/lib/xlsx';
import { type Invoice, useConfirmPayment, useGenerateInvoices, useInvoices, usePatchInvoice } from '../api';
import { dmyBE } from '../billing-docs';
import { InvoiceDetailSheet } from '../components/invoice-detail-sheet';
import { IssueInvoiceDialog } from '../components/issue-invoice-dialog';
import { formatDate, formatDateTime, formatMoney, todayBangkok, useIntlLocale } from '../format';
import { hasPendingSlip, slipCheckTone } from '../invoice-slip';

const STATUSES = ['draft', 'issued', 'paid', 'overdue', 'void'] as const;
const SLIP_FILTER = '__slip__';

function SlipBadge({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  if (!hasPendingSlip(invoice)) return null;
  const check = invoice.slipCheck;
  // what the check found: the first reason ("ยอดน้อยกว่าใบแจ้งชำระ"), else its verdict
  const what = check
    ? t(
        check.reasons[0]
          ? `invoices.slip.check.reason.${check.reasons[0]}`
          : `invoices.slip.check.status.${check.status}`,
      )
    : '';
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <Badge variant="warning">{t('invoices.slip.badge')}</Badge>
      <span className="text-xs text-muted-foreground">{formatDateTime(invoice.slipUploadedAt, locale)}</span>
      {check ? (
        <Badge variant={slipCheckTone[check.status]} data-testid="slip-check-badge">
          {t(check.method === 'basic' ? 'invoices.slip.check.badgeBasic' : 'invoices.slip.check.badge', {
            what,
          })}
        </Badge>
      ) : null}
    </div>
  );
}

export function InvoiceStatusBadge({ status }: { status: Invoice['status'] }) {
  const { t } = useTranslation('platform');
  const tone = {
    draft: 'secondary',
    issued: 'outline',
    paid: 'success',
    overdue: 'destructive',
    void: 'secondary',
  } as const;
  return <Badge variant={tone[status]}>{t(`invoiceStatus.${status}`)}</Badge>;
}

export function InvoicesPage() {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  // the default view is the queue that needs the admin: transfers waiting for "confirm" / "reject"
  const [status, setStatus] = useState(SLIP_FILTER);
  const [source, setSource] = useState('__all__');
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState(false);
  const invoices = useInvoices({
    status: STATUSES.includes(status as Invoice['status']) ? (status as Invoice['status']) : undefined,
    source: source === '__all__' ? undefined : (source as Invoice['source']),
    awaiting: status === SLIP_FILTER ? 'true' : undefined,
  });
  const patch = usePatchInvoice();
  const confirm = useConfirmPayment();
  const [voiding, setVoiding] = useState<Invoice | null>(null);
  const [reviewing, setReviewing] = useState<Invoice | null>(null);
  // the owner's LINE alert "💰 <shop> แจ้งโอน" links here with ?invoice=<id>: open that invoice to confirm the money
  const wanted = new URLSearchParams(window.location.search).get('invoice');
  useEffect(() => {
    const hit = (invoices.data ?? []).find((i) => i.id === wanted);
    if (hit) setReviewing(hit);
  }, [wanted, invoices.data]);

  const markPaid = (i: Invoice) => {
    const onSuccess = () => toast.success(t('invoices.paidToast', { number: i.number }));
    // a package invoice must run settleInvoice (opens the plan, sets the period); PATCH only flips the status
    if (i.source === 'subscription') confirm.mutate(i.id, { onSuccess });
    else patch.mutate({ id: i.id, body: { status: 'paid' } }, { onSuccess });
  };

  const rowActions = (i: Invoice) => (
    <>
      <A4Link size="sm" source={{ kind: 'shop-platform', id: i.id }} />{' '}
      {hasPendingSlip(i) ? (
        <Button size="sm" onClick={() => setReviewing(i)}>
          {t('invoices.slip.review')}
        </Button>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setReviewing(i)}>
          {t('invoices.detail')}
        </Button>
      )}{' '}
      {i.status === 'issued' || i.status === 'overdue' || i.status === 'draft' ? (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={patch.isPending || confirm.isPending}
            onClick={() => markPaid(i)}
          >
            {t('invoices.markPaid')}
          </Button>{' '}
          <Button size="sm" variant="ghost" onClick={() => setVoiding(i)}>
            {t('invoices.void')}
          </Button>
        </>
      ) : null}
    </>
  );

  return (
    <>
      <PageHeader
        title={t('invoices.title')}
        description={t('invoices.description')}
        actions={
          <>
            <Button
              variant="outline"
              blockedReason={(!invoices.data || invoices.data.length === 0) && t('invoices.nothingToExport')}
              onClick={() =>
                void downloadXlsx(t('invoices.title'), [
                  {
                    name: t('invoices.title'),
                    totalsLabel: t('totalRow', { ns: 'accounting' }),
                    columns: [
                      { header: t('invoices.col.number'), value: (i: Invoice) => i.number },
                      { header: t('invoices.col.shop'), value: (i: Invoice) => i.tenantName },
                      {
                        header: t('invoices.col.source'),
                        value: (i: Invoice) => t(`invoiceSource.${i.source}`),
                      },
                      {
                        header: t('invoices.col.issued'),
                        kind: 'date' as const,
                        value: (i: Invoice) => i.issuedOn,
                      },
                      {
                        header: t('invoices.col.due'),
                        kind: 'date' as const,
                        value: (i: Invoice) => i.dueOn,
                      },
                      {
                        header: t('invoices.col.amount'),
                        kind: 'money' as const,
                        total: true,
                        value: (i: Invoice) => i.amountMinor,
                      },
                      {
                        header: t('invoices.col.vat'),
                        kind: 'money' as const,
                        total: true,
                        value: (i: Invoice) => i.vatMinor,
                      },
                      {
                        header: t('invoices.col.total'),
                        kind: 'money' as const,
                        total: true,
                        value: (i: Invoice) => i.totalMinor,
                      },
                      {
                        header: t('invoices.col.status'),
                        value: (i: Invoice) => t(`invoiceStatus.${i.status}`),
                      },
                    ],
                    rows: invoices.data ?? [],
                  },
                ] as never).catch(() => toast.error(t('exportFailed', { ns: 'accounting' })))
              }
            >
              <Download /> {t('exportExcel', { ns: 'accounting' })}
            </Button>
            <Button variant="outline" onClick={() => setRunning(true)}>
              {t('invoices.run')}
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus /> {t('invoices.add')}
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44" aria-label={t('invoices.col.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('invoices.allStatuses')}</SelectItem>
            <SelectItem value={SLIP_FILTER}>{t('invoices.slipFilter')}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`invoiceStatus.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-44" aria-label={t('invoices.col.source')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('invoices.allSources')}</SelectItem>
            <SelectItem value="subscription">{t('invoiceSource.subscription')}</SelectItem>
            <SelectItem value="engagement">{t('invoiceSource.engagement')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <QueryState
        query={invoices}
        isEmpty={(all) => all.length === 0}
        empty={
          <EmptyState
            icon={Receipt}
            title={status === SLIP_FILTER ? t('invoices.slipEmpty') : t('invoices.empty')}
            description={t('invoices.emptyHint')}
          />
        }
      >
        {(all) => {
          const rows = all;
          return (
            <>
              <ul className="grid gap-2 lg:hidden">
                {rows.map((i) => (
                  <li key={i.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold">{i.tenantName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{i.number}</div>
                      </div>
                      <InvoiceStatusBadge status={i.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span className="text-lg font-semibold">{formatMoney(i.totalMinor, locale)}</span>
                      <span className="text-muted-foreground">
                        {t('invoices.col.due')} {formatDate(i.dueOn, locale)}
                      </span>
                    </div>
                    <SlipBadge invoice={i} />
                    <div className="mt-3 flex flex-wrap items-center gap-2">{rowActions(i)}</div>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto rounded-lg border lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('invoices.col.number')}</TableHead>
                      <TableHead>{t('invoices.col.shop')}</TableHead>
                      <TableHead>{t('invoices.col.plan')}</TableHead>
                      <TableHead>{t('invoices.col.issued')}</TableHead>
                      <TableHead>{t('invoices.col.due')}</TableHead>
                      <TableHead className="text-right">{t('invoices.col.amount')}</TableHead>
                      <TableHead className="text-right">{t('invoices.col.vat')}</TableHead>
                      <TableHead className="text-right">{t('invoices.col.total')}</TableHead>
                      <TableHead>{t('invoices.col.status')}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-xs">
                          {i.number}
                          {i.receiptNumber ? (
                            <span className="block text-muted-foreground">{i.receiptNumber}</span>
                          ) : null}
                        </TableCell>
                        <TableCell>{i.tenantName}</TableCell>
                        <TableCell>
                          {i.planName ?? t(`invoiceSource.${i.source}`)}
                          {i.periodStart && i.periodEnd ? (
                            <span className="block text-xs text-muted-foreground">
                              {dmyBE(i.periodStart)}–{dmyBE(i.periodEnd)}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>{formatDate(i.issuedOn, locale)}</TableCell>
                        <TableCell>{formatDate(i.dueOn, locale)}</TableCell>
                        <TableCell className="text-right">{formatMoney(i.amountMinor, locale)}</TableCell>
                        <TableCell className="text-right">{formatMoney(i.vatMinor, locale)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoney(i.totalMinor, locale)}
                        </TableCell>
                        <TableCell>
                          <InvoiceStatusBadge status={i.status} />
                          <SlipBadge invoice={i} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">{rowActions(i)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          );
        }}
      </QueryState>
      <InvoiceDetailSheet invoice={reviewing} onClose={() => setReviewing(null)} />
      {creating ? <IssueInvoiceDialog open onOpenChange={setCreating} /> : null}
      <RunDialog open={running} onOpenChange={setRunning} />
      <Dialog open={voiding !== null} onOpenChange={(o) => !o && setVoiding(null)}>
        <DialogContent closeLabel={t('common.close')}>
          <DialogHeader>
            <DialogTitle>{t('invoices.voidTitle', { number: voiding?.number })}</DialogTitle>
            <DialogDescription>{t('invoices.voidHint')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoiding(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={patch.isPending}
              onClick={() =>
                voiding &&
                patch.mutate(
                  { id: voiding.id, body: { status: 'void' } },
                  {
                    onSuccess: () => {
                      toast.success(t('invoices.voidedToast', { number: voiding.number }));
                      setVoiding(null);
                    },
                  },
                )
              }
            >
              {t('invoices.void')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RunDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation('platform');
  const run = useGenerateInvoices();
  const [month, setMonth] = useState(todayBangkok().slice(0, 7));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('invoices.run')}</DialogTitle>
          <DialogDescription>{t('invoices.runHint')}</DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="run-month">{t('invoices.month')}</Label>
          <Input id="run-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={run.isPending}
            blockedReason={!/^\d{4}-\d{2}$/.test(month) && t('invoices.monthNeeded')}
            onClick={() =>
              run.mutate(month, {
                onSuccess: (r) => {
                  toast.success(t('invoices.runDone', { created: r.data.created, skipped: r.data.skipped }));
                  onOpenChange(false);
                },
              })
            }
          >
            {t('invoices.runSubmit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
