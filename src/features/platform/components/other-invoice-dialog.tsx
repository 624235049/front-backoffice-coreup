import { Copy, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { type Invoice, type TenantRow, useCreateOtherInvoice, useTenants } from '../api';
import { formatMoney, parseBahtToMinor, useIntlLocale } from '../format';

type Line = { description: string; quantity: string; price: string; note: string };
const blank = (): Line => ({ description: '', quantity: '1', price: '', note: '' });
const PRESETS = ['move', 'setup', 'dev'] as const;

/** A line the API accepts, or the first reason it does not (shown as the button's hint). */
function parseLine(
  l: Line,
): { quantity: number; unitMinor: number } | 'descriptionNeeded' | 'priceNeeded' | 'quantityNeeded' {
  const quantity = /^\d+$/.test(l.quantity.trim()) ? Number(l.quantity) : 0;
  const unitMinor = parseBahtToMinor(l.price);
  if (l.description.trim() === '') return 'descriptionNeeded';
  if (quantity < 1 || quantity > 1000) return 'quantityNeeded';
  if (unitMinor === null || unitMinor <= 0) return 'priceNeeded';
  return { quantity, unitMinor };
}

/**
 * "ออกใบแจ้งชำระอื่น ๆ" for a one-off charge (ค่าย้ายระบบ, ค่าตั้งระบบ, ค่าพัฒนาเพิ่ม): quick-pick names fill the description,
 * the price stays editable. The shop gets it like a package invoice (email, billing page, pay page); its package is untouched.
 */
export function OtherInvoiceDialog({
  open,
  onOpenChange,
  tenant,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** the shop; omit to pick one in the dialog (invoices page) */
  tenant?: Pick<TenantRow, 'id' | 'name'>;
}) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const shops = useTenants({});
  const create = useCreateOtherInvoice();
  const [pickedShop, setPickedShop] = useState('');
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [done, setDone] = useState<Invoice | null>(null);

  const shop = tenant ?? (shops.data ?? []).find((s) => s.id === pickedShop);
  const parsed = lines.map(parseLine);
  const firstError = parsed.find((p): p is Exclude<typeof p, { quantity: number }> => typeof p === 'string');
  const subtotal = parsed.reduce((s, p) => (typeof p === 'string' ? s : s + p.quantity * p.unitMinor), 0);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setDone(null);
      setLines([blank()]);
      setPickedShop('');
    }
  };
  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((all) => all.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  // a quick-pick fills the first still-empty line, else adds one
  const pick = (name: string) =>
    setLines((all) => {
      const empty = all.findIndex((l) => l.description.trim() === '');
      return empty >= 0
        ? all.map((l, n) => (n === empty ? { ...l, description: name } : l))
        : [...all, { ...blank(), description: name }];
    });

  const issue = () => {
    if (!shop || firstError) return;
    create.mutate(
      {
        tenantId: shop.id,
        lines: lines.map((l, i) => {
          const p = parsed[i] as { quantity: number; unitMinor: number };
          return {
            description: l.description.trim(),
            quantity: p.quantity,
            unitMinor: p.unitMinor,
            ...(l.note.trim() ? { note: l.note.trim() } : {}),
          };
        }),
      },
      {
        onSuccess: (res) => {
          setDone(res.data);
          toast.success(t('otherInvoice.issuedToast', { number: res.data.number }));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent closeLabel={t('common.close')} className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('otherInvoice.title')}</DialogTitle>
          <DialogDescription>{t('otherInvoice.description')}</DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="grid gap-3 text-sm" data-testid="other-done">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
              <dt className="text-muted-foreground">{t('invoices.col.number')}</dt>
              <dd className="font-medium">{done.number}</dd>
              <dt className="text-muted-foreground">{t('invoices.col.shop')}</dt>
              <dd className="font-medium">{done.tenantName}</dd>
              <dt className="text-muted-foreground">{t('invoices.col.total')}</dt>
              <dd className="font-medium">{formatMoney(done.totalMinor, locale)}</dd>
            </dl>
            <p className="break-all rounded-md bg-muted p-2 text-xs">{done.payUrl}</p>
            <Button
              data-testid="copy-pay-link"
              onClick={() =>
                void navigator.clipboard.writeText(done.payUrl).then(
                  () => toast.success(t('otherInvoice.copiedLink')),
                  () => toast.error(t('issueInvoice.copyFailed')),
                )
              }
            >
              <Copy /> {t('otherInvoice.copyLink')}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
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
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">{t('otherInvoice.presets')}</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((k) => (
                  <Button
                    key={k}
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid={`preset-${k}`}
                    onClick={() => pick(t(`otherInvoice.presetList.${k}`))}
                  >
                    {t(`otherInvoice.presetList.${k}`)}
                  </Button>
                ))}
              </div>
            </div>
            {lines.map((l, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: lines have no id and are only appended / removed by the admin
              <div key={i} className="grid gap-2 rounded-lg border p-3" data-testid="other-line">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{t('otherInvoice.line', { n: i + 1 })}</span>
                  {lines.length > 1 ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={t('otherInvoice.removeLine')}
                      onClick={() => setLines((all) => all.filter((_, n) => n !== i))}
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor={`other-desc-${i}`}>{t('otherInvoice.descriptionLabel')}</Label>
                  <Input
                    id={`other-desc-${i}`}
                    maxLength={200}
                    value={l.description}
                    placeholder={t('otherInvoice.descriptionPlaceholder')}
                    onChange={(e) => setLine(i, { description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                  <div>
                    <Label htmlFor={`other-qty-${i}`}>{t('otherInvoice.quantity')}</Label>
                    <Input
                      id={`other-qty-${i}`}
                      inputMode="numeric"
                      value={l.quantity}
                      onChange={(e) => setLine(i, { quantity: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`other-price-${i}`}>{t('otherInvoice.unitPrice')}</Label>
                    <Input
                      id={`other-price-${i}`}
                      inputMode="decimal"
                      value={l.price}
                      onChange={(e) => setLine(i, { price: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor={`other-note-${i}`}>{t('otherInvoice.note')}</Label>
                  <Input
                    id={`other-note-${i}`}
                    maxLength={500}
                    value={l.note}
                    placeholder={t('otherInvoice.notePlaceholder')}
                    onChange={(e) => setLine(i, { note: e.target.value })}
                  />
                </div>
              </div>
            ))}
            {lines.length < 20 ? (
              <Button
                type="button"
                variant="outline"
                className="justify-self-start"
                onClick={() => setLines((all) => [...all, blank()])}
              >
                <Plus /> {t('otherInvoice.addLine')}
              </Button>
            ) : null}
            <p className="text-sm font-medium" data-testid="other-total">
              {t('otherInvoice.total')}: {formatMoney(subtotal, locale)}
            </p>
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
                data-testid="other-submit"
                disabled={create.isPending}
                blockedReason={
                  (!shop && t('invoices.pickShopFirst')) || (firstError && t(`otherInvoice.${firstError}`))
                }
                onClick={issue}
              >
                {t('otherInvoice.submit')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
