import { Download, Plus, Receipt } from 'lucide-react';
import { useState } from 'react';
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
import {
  type Invoice,
  useCreateInvoice,
  useGenerateInvoices,
  useInvoices,
  usePatchInvoice,
  useTenants,
} from '../api';
import { formatDate, formatMoney, parseBahtToMinor, todayBangkok, useIntlLocale } from '../format';

const STATUSES = ['draft', 'issued', 'paid', 'overdue', 'void'] as const;

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
  const [status, setStatus] = useState('__all__');
  const [source, setSource] = useState('__all__');
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState(false);
  const invoices = useInvoices({
    status: status === '__all__' ? undefined : (status as Invoice['status']),
    source: source === '__all__' ? undefined : (source as Invoice['source']),
  });
  const patch = usePatchInvoice();
  const [voiding, setVoiding] = useState<Invoice | null>(null);

  const rowActions = (i: Invoice) => (
    <>
      <A4Link size="sm" source={{ kind: 'shop-platform', id: i.id }} />{' '}
      {i.status === 'issued' || i.status === 'overdue' || i.status === 'draft' ? (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={patch.isPending}
            onClick={() =>
              patch.mutate(
                { id: i.id, body: { status: 'paid' } },
                { onSuccess: () => toast.success(t('invoices.paidToast', { number: i.number })) },
              )
            }
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
        isEmpty={(rows) => rows.length === 0}
        empty={
          <EmptyState icon={Receipt} title={t('invoices.empty')} description={t('invoices.emptyHint')} />
        }
      >
        {(rows) => (
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
                    <TableHead>{t('invoices.col.source')}</TableHead>
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
                      <TableCell className="font-mono text-xs">{i.number}</TableCell>
                      <TableCell>{i.tenantName}</TableCell>
                      <TableCell>{t(`invoiceSource.${i.source}`)}</TableCell>
                      <TableCell>{formatDate(i.issuedOn, locale)}</TableCell>
                      <TableCell>{formatDate(i.dueOn, locale)}</TableCell>
                      <TableCell className="text-right">{formatMoney(i.amountMinor, locale)}</TableCell>
                      <TableCell className="text-right">{formatMoney(i.vatMinor, locale)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(i.totalMinor, locale)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={i.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">{rowActions(i)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </QueryState>
      <CreateInvoiceDialog open={creating} onOpenChange={setCreating} />
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

function CreateInvoiceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation('platform');
  const tenants = useTenants({});
  const create = useCreateInvoice();
  const [tenantId, setTenantId] = useState('');
  const [source, setSource] = useState<'subscription' | 'engagement'>('engagement');
  const [amount, setAmount] = useState('');
  const minor = parseBahtToMinor(amount);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('invoices.add')}</DialogTitle>
          <DialogDescription>{t('invoices.vatHint')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>{t('invoices.col.shop')}</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger aria-label={t('invoices.col.shop')}>
                <SelectValue placeholder={t('engagements.pickShop')} />
              </SelectTrigger>
              <SelectContent>
                {(tenants.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t('invoices.col.source')}</Label>
              <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
                <SelectTrigger aria-label={t('invoices.col.source')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscription">{t('invoiceSource.subscription')}</SelectItem>
                  <SelectItem value="engagement">{t('invoiceSource.engagement')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="inv-amount">{t('invoices.amountExVat')}</Label>
              <Input
                id="inv-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={create.isPending}
            blockedReason={
              !tenantId
                ? t('invoices.pickShopFirst')
                : (minor === null || minor <= 0) && t('invoices.amountNeeded')
            }
            onClick={() => {
              if (minor === null) return;
              create.mutate(
                { tenantId, source, amountMinor: minor, status: 'issued' },
                {
                  onSuccess: () => {
                    toast.success(t('invoices.createdToast'));
                    onOpenChange(false);
                    setAmount('');
                    setTenantId('');
                  },
                },
              );
            }}
          >
            {t('invoices.issue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
