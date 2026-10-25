import { Copy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type Invoice,
  type Plan,
  type TenantRow,
  useCreateInvoice,
  useInvoices,
  usePatchInvoice,
  usePlans,
  useTenants,
} from '../api';
import { dmyBE, prorateDifference, renewalLineMessage } from '../billing-docs';
import { formatMoney, parseBahtToMinor, todayBangkok, useIntlLocale, usePlanLabel } from '../format';
import { orderPlans } from '../plan-families';

type Kind = 'renewal' | 'upgrade';

/** Copy the LINE message for an invoice that was just issued (also used from the invoice detail). */
export function copyLineMessage(
  invoice: Pick<Invoice, 'number' | 'totalMinor' | 'periodStart' | 'periodEnd' | 'payUrl' | 'tenantName'>,
  plan: Pick<Plan, 'code' | 'name' | 'interval'>,
): Promise<void> {
  return navigator.clipboard.writeText(
    renewalLineMessage({
      shopName: invoice.tenantName,
      plan,
      number: invoice.number,
      totalMinor: invoice.totalMinor,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      payUrl: invoice.payUrl,
    }),
  );
}

/**
 * "ออกใบแจ้งชำระต่ออายุ" for a shop: pick the package + monthly / yearly row. A renewal covers the cycle after the
 * current expiry (period filled in by the API); an upgrade paid mid-cycle covers today → the current expiry for an
 * amount the admin types (a pro-rated difference is suggested). An unpaid invoice the system issued earlier can be
 * voided in the same step. Afterwards the LINE message with the pay link is one click away.
 */
export function IssueInvoiceDialog({
  open,
  onOpenChange,
  tenant,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** the shop; omit to pick one in the dialog (invoices page) */
  tenant?: Pick<TenantRow, 'id' | 'name' | 'planCode' | 'periodStart' | 'periodEnd'>;
}) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const planLabel = usePlanLabel();
  const plans = usePlans();
  const shops = useTenants({});
  const create = useCreateInvoice();
  const patch = usePatchInvoice();
  const [pickedShop, setPickedShop] = useState('');
  const [planCode, setPlanCode] = useState('');
  const [kind, setKind] = useState<Kind>('renewal');
  const [amount, setAmount] = useState('');
  const [voidOpen, setVoidOpen] = useState(true);
  const [done, setDone] = useState<{ invoice: Invoice; plan: Plan } | null>(null);

  const shop = tenant ?? (shops.data ?? []).find((s) => s.id === pickedShop);
  const all = plans.data ?? [];
  const { sold, rest } = orderPlans(all.filter((p) => p.active && p.priceMinor > 0));
  const plan = all.find((p) => p.code === planCode);
  const current = all.find((p) => p.code === shop?.planCode);

  const issued = useInvoices({ tenantId: shop?.id, status: 'issued', source: 'subscription' });
  const overdue = useInvoices({ tenantId: shop?.id, status: 'overdue', source: 'subscription' });
  // another shop's rows can show while a query without a shop is in flight: keep only this shop's
  const unpaid = [...(issued.data ?? []), ...(overdue.data ?? [])].filter(
    (i) => shop && i.tenantId === shop.id,
  );

  const running =
    shop?.periodStart && shop.periodEnd ? { start: shop.periodStart, end: shop.periodEnd } : null;
  const suggested =
    running && plan && current
      ? prorateDifference({
          currentPriceMinor: current.priceMinor,
          newPriceMinor: plan.priceMinor,
          periodStart: running.start,
          periodEnd: running.end,
          today: todayBangkok(),
        })
      : 0;
  const upgradeMinor = parseBahtToMinor(amount);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setDone(null);
      setPlanCode('');
      setKind('renewal');
      setAmount('');
      setPickedShop('');
      setVoidOpen(true);
    }
  };

  const issue = () => {
    if (!shop || !plan) return;
    const upgrade = kind === 'upgrade' && running;
    create.mutate(
      {
        tenantId: shop.id,
        source: 'subscription',
        sourceId: plan.id,
        amountMinor: upgrade ? (upgradeMinor ?? 0) : plan.priceMinor,
        status: 'issued',
        ...(upgrade ? { periodStart: todayBangkok(), periodEnd: running.end } : {}),
      },
      {
        onSuccess: async (res) => {
          if (voidOpen)
            await Promise.all(
              unpaid.map((i) =>
                patch.mutateAsync({ id: i.id, body: { status: 'void' } }).catch(() => undefined),
              ),
            );
          setDone({ invoice: res.data, plan });
          toast.success(t('issueInvoice.issuedToast', { number: res.data.number }));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('issueInvoice.title')}</DialogTitle>
          <DialogDescription>{t('issueInvoice.description')}</DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="grid gap-3 text-sm" data-testid="issue-done">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
              <dt className="text-muted-foreground">{t('invoices.col.number')}</dt>
              <dd className="font-medium">{done.invoice.number}</dd>
              <dt className="text-muted-foreground">{t('issueInvoice.package')}</dt>
              <dd className="font-medium">{planLabel(done.plan)}</dd>
              <dt className="text-muted-foreground">{t('issueInvoice.period')}</dt>
              <dd className="font-medium">
                {done.invoice.periodStart && done.invoice.periodEnd
                  ? `${dmyBE(done.invoice.periodStart)}–${dmyBE(done.invoice.periodEnd)}`
                  : '–'}
              </dd>
              <dt className="text-muted-foreground">{t('invoices.col.total')}</dt>
              <dd className="font-medium">{formatMoney(done.invoice.totalMinor, locale)}</dd>
            </dl>
            <p className="break-all rounded-md bg-muted p-2 text-xs">{done.invoice.payUrl}</p>
            <Button
              data-testid="copy-line-message"
              onClick={() =>
                void copyLineMessage(done.invoice, done.plan).then(
                  () => toast.success(t('issueInvoice.copied')),
                  () => toast.error(t('issueInvoice.copyFailed')),
                )
              }
            >
              <Copy /> {t('issueInvoice.copyLine')}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {tenant ? (
              <p className="text-sm font-medium">{tenant.name}</p>
            ) : (
              <div>
                <Label>{t('invoices.col.shop')}</Label>
                <Select value={pickedShop} onValueChange={setPickedShop}>
                  <SelectTrigger aria-label={t('invoices.col.shop')}>
                    <SelectValue placeholder={t('engagements.pickShop')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(shops.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {running ? (
              <p className="text-xs text-muted-foreground">
                {t('issueInvoice.running', {
                  plan: current ? planLabel(current) : '–',
                  end: dmyBE(running.end),
                })}
              </p>
            ) : null}
            <div>
              <Label>{t('issueInvoice.package')}</Label>
              <Select value={planCode} onValueChange={setPlanCode}>
                <SelectTrigger aria-label={t('issueInvoice.package')}>
                  <SelectValue placeholder={t('issueInvoice.pickPlan')} />
                </SelectTrigger>
                <SelectContent>
                  {sold.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {planLabel(p)}
                    </SelectItem>
                  ))}
                  {sold.length > 0 && rest.length > 0 ? <SelectSeparator /> : null}
                  {rest.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {planLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('issueInvoice.kind')}>
              {(['renewal', 'upgrade'] as const).map((k) => (
                <Button
                  key={k}
                  type="button"
                  variant={kind === k ? 'default' : 'outline'}
                  className="h-auto min-h-11 min-w-0 whitespace-normal px-2 py-2 text-center leading-snug"
                  role="radio"
                  aria-checked={kind === k}
                  disabled={k === 'upgrade' && !running}
                  onClick={() => setKind(k)}
                >
                  {t(`issueInvoice.kinds.${k}`)}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t(`issueInvoice.kindHint.${kind}`)}</p>
            {kind === 'upgrade' ? (
              <div>
                <Label htmlFor="upgrade-amount">{t('invoices.amountExVat')}</Label>
                <Input
                  id="upgrade-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {suggested > 0 ? (
                  <button
                    type="button"
                    className="mt-1 text-xs text-primary underline-offset-2 hover:underline"
                    onClick={() => setAmount(String(suggested / 100))}
                  >
                    {t('issueInvoice.suggest', { amount: formatMoney(suggested, locale) })}
                  </button>
                ) : null}
              </div>
            ) : plan ? (
              <p className="text-sm">
                {t('issueInvoice.amountIs', { amount: formatMoney(plan.priceMinor, locale) })}
              </p>
            ) : null}
            {unpaid.length > 0 ? (
              <label className="flex items-start gap-2 text-sm" htmlFor="void-open">
                <Checkbox
                  id="void-open"
                  checked={voidOpen}
                  onCheckedChange={(v) => setVoidOpen(v === true)}
                  className="mt-0.5"
                />
                <span>{t('issueInvoice.voidOpen', { count: unpaid.length })}</span>
              </label>
            ) : null}
          </div>
        )}
        <DialogFooter>
          {done ? (
            <Button variant="outline" onClick={() => close(false)}>
              {t('common.close')}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                data-testid="issue-submit"
                disabled={create.isPending}
                blockedReason={
                  (!shop && t('invoices.pickShopFirst')) ||
                  (!plan && t('issueInvoice.pickPlan')) ||
                  (kind === 'upgrade' &&
                    (upgradeMinor === null || upgradeMinor <= 0) &&
                    t('invoices.amountNeeded'))
                }
                onClick={issue}
              >
                {t('issueInvoice.submit')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
