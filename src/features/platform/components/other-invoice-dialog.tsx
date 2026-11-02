import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
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
import { Combobox } from '@/features/accounting/components/combobox';
import {
  type Invoice,
  type TenantRow,
  useAddons,
  useCreateOtherInvoice,
  usePatchInvoice,
  usePlans,
  useTenants,
} from '../api';
import { formatMoney, parseBahtToMinor, useIntlLocale, usePlanLabel } from '../format';

type Line = { description: string; quantity: string; price: string; note: string };
const blank = (): Line => ({ description: '', quantity: '1', price: '', note: '' });
const PRESETS = ['move', 'setup', 'dev'] as const;
const MAX_LINES = 100;

/** Quantity as typed: a number with up to 3 decimals (1.5 hours), 0.001 … 100,000. */
const parseQuantity = (s: string): number | null => {
  const v = s.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(v)) return null;
  const n = Number(v);
  return n >= 0.001 && n <= 100_000 ? n : null;
};

/** A line the API accepts, or the first reason it does not (shown as the button's hint). */
function parseLine(
  l: Line,
): { quantity: number; unitMinor: number } | 'descriptionNeeded' | 'priceNeeded' | 'quantityNeeded' {
  const quantity = parseQuantity(l.quantity);
  const unitMinor = parseBahtToMinor(l.price);
  if (l.description.trim() === '') return 'descriptionNeeded';
  if (quantity === null) return 'quantityNeeded';
  if (unitMinor === null || unitMinor <= 0) return 'priceNeeded';
  return { quantity, unitMinor };
}

/** Same rounding as the API: the line total is whole satang. */
const lineTotal = (p: { quantity: number; unitMinor: number }) => Math.round(p.quantity * p.unitMinor);

/**
 * "สร้างใบแจ้งชำระอื่น ๆ": any number of free lines (description, quantity with decimals, unit price in baht, note),
 * reorderable, with the line and grand totals live. Chips add common items from the data we already have (package
 * prices, the AI add-on prices, the set-up fee) as a line the team then edits. It is saved as a DRAFT — nothing is
 * emailed; the team reviews it and presses "ส่งให้ลูกค้า". With `draft` the same form edits that draft's lines
 * (only a draft can be edited). The package of the shop is never touched.
 */
export function OtherInvoiceDialog({
  open,
  onOpenChange,
  tenant,
  draft,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** the shop; omit to pick one in the dialog (invoices page) */
  tenant?: Pick<TenantRow, 'id' | 'name'>;
  /** edit this draft's lines instead of creating a new invoice */
  draft?: Invoice;
  /** the saved draft (created or edited), e.g. to open its detail */
  onDone?: (invoice: Invoice) => void;
}) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const planLabel = usePlanLabel();
  const shops = useTenants({});
  const plans = usePlans();
  const addons = useAddons();
  const create = useCreateOtherInvoice();
  const patch = usePatchInvoice();
  const [pickedShop, setPickedShop] = useState<{ id: string; name: string } | null>(null);
  const [shopQuery, setShopQuery] = useState('');
  const [lines, setLines] = useState<Line[]>(() =>
    draft
      ? draft.otherLines.map((l) => ({
          description: l.description,
          quantity: String(l.quantity),
          price: String(l.unitMinor / 100),
          note: l.note ?? '',
        }))
      : [blank()],
  );

  const shop = tenant ?? (draft ? { id: draft.tenantId, name: draft.tenantName } : pickedShop);
  const fixedShop = tenant ?? (draft ? { id: draft.tenantId, name: draft.tenantName } : null);
  const parsed = lines.map(parseLine);
  const firstError = parsed.find((p): p is Exclude<typeof p, { quantity: number }> => typeof p === 'string');
  const subtotal = parsed.reduce((s, p) => (typeof p === 'string' ? s : s + lineTotal(p)), 0);
  const pending = create.isPending || patch.isPending;
  const q = shopQuery.trim().toLowerCase();
  const shopOptions = (shops.data ?? [])
    .filter((s) => q === '' || s.name.toLowerCase().includes(q))
    .slice(0, 30)
    .map((s) => ({ value: s.id, label: s.name }));

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setLines([blank()]);
      setPickedShop(null);
    }
  };
  const setLine = (i: number, change: Partial<Line>) =>
    setLines((all) => all.map((l, n) => (n === i ? { ...l, ...change } : l)));
  const move = (i: number, by: -1 | 1) =>
    setLines((all) => {
      const to = i + by;
      if (to < 0 || to >= all.length) return all;
      const next = [...all];
      [next[i], next[to]] = [next[to] as Line, next[i] as Line];
      return next;
    });
  // a chip fills the first still-empty line, else adds one (so a half-typed form is never overwritten)
  const add = (item: { description: string; price?: number }) =>
    setLines((all) => {
      const filled: Line = {
        ...blank(),
        description: item.description,
        price: item.price === undefined ? '' : String(item.price / 100),
      };
      const empty = all.findIndex((l) => l.description.trim() === '' && l.price.trim() === '');
      if (empty >= 0) return all.map((l, n) => (n === empty ? filled : l));
      return all.length < MAX_LINES ? [...all, filled] : all;
    });

  // common items from data we already hold: package prices, AI add-on, set-up fee (all editable once added)
  const ai = addons.data?.settings.aiChat;
  const chips: { key: string; label: string; description: string; price?: number }[] = [
    ...PRESETS.map((k) => ({
      key: `preset-${k}`,
      label: t(`otherInvoice.presetList.${k}`),
      description: t(`otherInvoice.presetList.${k}`),
      // the set-up fee has a catalogue price; the other two are quoted by hand
      ...(k === 'setup' && addons.data ? { price: addons.data.settings.setupService.priceMinor } : {}),
    })),
    ...(ai
      ? [
          {
            key: 'ai-monthly',
            label: t('otherInvoice.chips.aiMonthly'),
            description: t('otherInvoice.chips.aiMonthly'),
            price: ai.monthlyMinor,
          },
          {
            key: 'ai-topup',
            label: t('otherInvoice.chips.aiTopup', { messages: ai.topupMessages.toLocaleString(locale) }),
            description: t('otherInvoice.chips.aiTopup', {
              messages: ai.topupMessages.toLocaleString(locale),
            }),
            price: ai.topupMinor,
          },
          {
            key: 'ai-setup',
            label: t('otherInvoice.chips.aiSetup'),
            description: t('otherInvoice.chips.aiSetup'),
            price: ai.setupMinor,
          },
        ]
      : []),
    ...(plans.data ?? [])
      .filter((p) => p.active && p.priceMinor > 0)
      .map((p) => ({
        key: `plan-${p.code}`,
        label: planLabel(p),
        description: t('otherInvoice.chips.plan', { name: planLabel(p).split(' · ')[0] }),
        price: p.priceMinor,
      })),
  ];

  const save = () => {
    if (!shop || firstError) return;
    const body = lines.map((l, i) => {
      const p = parsed[i] as { quantity: number; unitMinor: number };
      return {
        description: l.description.trim(),
        quantity: p.quantity,
        unitMinor: p.unitMinor,
        ...(l.note.trim() ? { note: l.note.trim() } : {}),
      };
    });
    const onSuccess = (res: { data: Invoice }) => {
      toast.success(t(draft ? 'otherInvoice.savedToast' : 'otherInvoice.draftToast'));
      onDone?.(res.data);
      close(false);
    };
    if (draft) patch.mutate({ id: draft.id, body: { lines: body } }, { onSuccess });
    else create.mutate({ tenantId: shop.id, lines: body }, { onSuccess });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent closeLabel={t('common.close')} className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(draft ? 'otherInvoice.editTitle' : 'otherInvoice.title')}</DialogTitle>
          <DialogDescription>{t('otherInvoice.description')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {fixedShop ? (
            <p className="text-sm font-medium">{fixedShop.name}</p>
          ) : (
            <div>
              <Label>{t('invoices.col.shop')}</Label>
              <Combobox
                aria-label={t('invoices.col.shop')}
                value={pickedShop?.id ?? null}
                selectedLabel={pickedShop?.name}
                options={shopOptions}
                onSearch={setShopQuery}
                onSelect={(o) => setPickedShop({ id: o.value, name: o.label })}
                placeholder={t('otherInvoice.searchShop')}
                emptyText={t('otherInvoice.noShop')}
                loading={shops.isPending}
              />
            </div>
          )}
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">{t('otherInvoice.presets')}</p>
            <div className="flex flex-wrap gap-2" data-testid="chips">
              {chips.map((c) => (
                <Button
                  key={c.key}
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid={c.key}
                  onClick={() => add(c)}
                >
                  {c.label}
                </Button>
              ))}
            </div>
          </div>
          {lines.map((l, i) => {
            const p = parsed[i];
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: lines have no id; every field is controlled by the list state
              <div key={i} className="grid gap-2 rounded-lg border p-3" data-testid="other-line">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-medium">{t('otherInvoice.line', { n: i + 1 })}</span>
                  <div className="flex items-center">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t('otherInvoice.moveUp')}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ChevronUp />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t('otherInvoice.moveDown')}
                      disabled={i === lines.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ChevronDown />
                    </Button>
                    {lines.length > 1 ? (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t('otherInvoice.removeLine')}
                        onClick={() => setLines((all) => all.filter((_, n) => n !== i))}
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
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
                      inputMode="decimal"
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
                <p className="text-right text-sm text-muted-foreground" data-testid="line-total">
                  {t('otherInvoice.lineTotal')}:{' '}
                  {p === undefined || typeof p === 'string' ? '–' : formatMoney(lineTotal(p), locale)}
                </p>
              </div>
            );
          })}
          {lines.length < MAX_LINES ? (
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
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            data-testid="other-submit"
            disabled={pending}
            blockedReason={
              (!shop && t('invoices.pickShopFirst')) || (firstError && t(`otherInvoice.${firstError}`))
            }
            onClick={save}
          >
            {t(draft ? 'otherInvoice.saveDraft' : 'otherInvoice.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
