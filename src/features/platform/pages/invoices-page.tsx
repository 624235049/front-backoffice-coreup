import { Plus, Receipt } from 'lucide-react';
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

  return (
    <>
      <PageHeader
        title={t('invoices.title')}
        description={t('invoices.description')}
        actions={
          <>
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
          <div className="overflow-x-auto rounded-lg border">
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
                    <TableCell className="whitespace-nowrap text-right">
                      {i.status === 'issued' || i.status === 'overdue' || i.status === 'draft' ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={patch.isPending}
                            onClick={() =>
                              patch.mutate(
                                { id: i.id, body: { status: 'paid' } },
                                {
                                  onSuccess: () =>
                                    toast.success(t('invoices.paidToast', { number: i.number })),
                                },
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
                  { onSuccess: () => setVoiding(null) },
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
  const locale = useIntlLocale();
  const tenants = useTenants({});
  const create = useCreateInvoice();
  const [tenantId, setTenantId] = useState('');
  const [source, setSource] = useState<'subscription' | 'engagement'>('engagement');
  const [amount, setAmount] = useState('');
  const minor = parseBahtToMinor(amount);
  const vat = minor === null ? null : Math.round(minor * 0.07);
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
          <div className="grid grid-cols-2 gap-3">
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
          {minor !== null && vat !== null ? (
            <p className="text-sm text-muted-foreground">
              {t('invoices.preview', {
                vat: formatMoney(vat, locale),
                total: formatMoney(minor + vat, locale),
              })}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!tenantId || minor === null || minor <= 0 || create.isPending}
            onClick={() => {
              if (minor === null) return;
              create.mutate(
                { tenantId, source, amountMinor: minor, status: 'issued' },
                {
                  onSuccess: () => {
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
            disabled={!/^\d{4}-\d{2}$/.test(month) || run.isPending}
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
