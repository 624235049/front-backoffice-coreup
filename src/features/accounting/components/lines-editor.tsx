import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIntlLocale } from '@/features/platform/format';
import { cn } from '@/lib/utils';
import { type Item, useItems } from '../api';
import { lineAmount } from '../lib/calc';
import { type EditorLine, emptyLine, parseQty } from '../lib/editor';
import { formatAmount } from '../lib/format';
import { useDebounced } from '../lib/use-debounced';
import { MoneyInput } from './money-input';

/** Description box that suggests products/services while typing; free text stays allowed. */
function DescriptionInput({
  value,
  onChange,
  onPick,
  invalid,
  placeholder,
  suggest,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (item: Item) => void;
  invalid: boolean;
  placeholder: string;
  suggest: boolean;
}) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const q = useDebounced(value.trim(), 200);
  const items = useItems({ q: q || undefined, active: true, limit: 6 }, open && suggest);
  const options = items.data ?? [];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Input
        value={value}
        placeholder={placeholder}
        aria-label={t('doc.line.description')}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (!open || options.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, options.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            const o = options[active];
            if (o) {
              e.preventDefault();
              onPick(o);
              setOpen(false);
            }
          } else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && suggest && options.length > 0 ? (
        <div
          role="listbox"
          className="absolute z-40 mt-1 max-h-64 w-full min-w-64 overflow-auto rounded-lg border bg-white py-1 shadow-lg"
        >
          <div className="px-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {t('doc.line.suggestions')}
          </div>
          {options.map((o, i) => (
            <div
              key={o.id}
              role="option"
              tabIndex={-1}
              aria-selected={i === active}
              className={cn(
                'flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm',
                i === active && 'bg-mint-50',
              )}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(o);
                setOpen(false);
              }}
              onKeyDown={() => undefined}
            >
              <span className="min-w-0">
                <span className="block truncate">{o.name}</span>
                {o.code || o.unit ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {[o.code, o.unit].filter(Boolean).join(' · ')}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs text-navy-700 tabular-nums">
                {formatAmount(o.unitPriceMinor, locale)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Line table of the document editor: add/remove rows, product type-to-search, live per-line amount.
 * Phone: every line becomes a stacked card with visible field labels.
 */
export function LinesEditor({
  lines,
  onChange,
  vatEnabled,
  defaultVatType,
  errors,
  suggestItems = true,
}: {
  lines: EditorLine[];
  onChange: (lines: EditorLine[]) => void;
  /** Company is VAT registered (otherwise the per-line VAT type is irrelevant and hidden). */
  vatEnabled: boolean;
  defaultVatType: EditorLine['vatType'];
  errors: { description?: boolean; qty?: boolean; price?: boolean; discount?: boolean };
  /** Offer products/services while typing a description (sales documents; off for expenses). */
  suggestItems?: boolean;
}) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const update = (key: string, patch: Partial<EditorLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const fieldCols = vatEnabled
    ? 'sm:grid-cols-[4.5rem_5rem_repeat(4,minmax(0,1fr))]'
    : 'sm:grid-cols-[4.5rem_5rem_repeat(3,minmax(0,1fr))]';

  return (
    <div className="grid gap-3">
      {lines.map((l, idx) => {
        const qty = parseQty(l.qty);
        const amount = lineAmount({
          qty: qty ?? 0,
          unitPriceMinor: l.unitPriceMinor ?? 0,
          discountMinor: l.discountMinor ?? 0,
        });
        return (
          <div key={l.key} className="grid gap-3 rounded-xl border bg-white p-3">
            <div className="flex items-end gap-2">
              <div className="grid min-w-0 flex-1 gap-1">
                <span className="text-xs text-muted-foreground">
                  {t('doc.line.description')} #{idx + 1}
                </span>
                <DescriptionInput
                  value={l.description}
                  invalid={
                    Boolean(errors.description) && l.description.trim() === '' && l.unitPriceMinor !== null
                  }
                  placeholder={t('doc.line.descriptionPlaceholder')}
                  suggest={suggestItems}
                  onChange={(description) => update(l.key, { description, itemId: null })}
                  onPick={(item) =>
                    update(l.key, {
                      itemId: item.id,
                      description: item.name,
                      unit: item.unit ?? '',
                      unitPriceMinor: item.unitPriceMinor,
                      vatType: vatEnabled ? item.vatType : 'none',
                    })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                aria-label={t('doc.line.remove')}
                disabled={lines.length === 1 && l.description === '' && l.unitPriceMinor === null}
                onClick={() => {
                  const next = lines.filter((x) => x.key !== l.key);
                  onChange(next.length === 0 ? [emptyLine(defaultVatType)] : next);
                }}
              >
                <Trash2 />
              </Button>
            </div>
            <div className={cn('grid grid-cols-2 gap-3', fieldCols)}>
              <div className="grid content-start gap-1">
                <span className="text-xs text-muted-foreground">{t('doc.line.qty')}</span>
                <Input
                  inputMode="decimal"
                  value={l.qty}
                  aria-label={t('doc.line.qty')}
                  aria-invalid={(Boolean(errors.qty) && qty === null) || undefined}
                  className="text-right tabular-nums"
                  onChange={(e) => update(l.key, { qty: e.target.value })}
                />
              </div>
              <div className="grid content-start gap-1">
                <span className="text-xs text-muted-foreground">{t('doc.line.unit')}</span>
                <Input
                  value={l.unit}
                  aria-label={t('doc.line.unit')}
                  maxLength={30}
                  onChange={(e) => update(l.key, { unit: e.target.value })}
                />
              </div>
              <div className="grid content-start gap-1">
                <span className="text-xs text-muted-foreground">{t('doc.line.unitPrice')}</span>
                <MoneyInput
                  value={l.unitPriceMinor}
                  aria-label={t('doc.line.unitPrice')}
                  aria-invalid={(Boolean(errors.price) && l.unitPriceMinor === null) || undefined}
                  onChange={(unitPriceMinor) => update(l.key, { unitPriceMinor })}
                />
              </div>
              <div className="grid content-start gap-1">
                <span className="text-xs text-muted-foreground">{t('doc.line.discount')}</span>
                <MoneyInput
                  value={l.discountMinor}
                  aria-label={t('doc.line.discount')}
                  placeholder="0.00"
                  onChange={(discountMinor) => update(l.key, { discountMinor })}
                />
              </div>
              {vatEnabled ? (
                <div className="grid content-start gap-1">
                  <span className="text-xs text-muted-foreground">{t('doc.line.vatType')}</span>
                  <Select
                    value={l.vatType}
                    onValueChange={(v) => update(l.key, { vatType: v as EditorLine['vatType'] })}
                  >
                    <SelectTrigger aria-label={t('doc.line.vatType')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['vat', 'none', 'exempt'] as const).map((v) => (
                        <SelectItem key={v} value={v}>
                          {t(`vatType.${v}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="col-span-2 grid content-start gap-1 sm:col-span-1">
                <span className="text-right text-xs text-muted-foreground">{t('doc.line.amount')}</span>
                <div className="flex h-11 items-center justify-end rounded-lg bg-navy-50 px-3 font-semibold text-navy-900 tabular-nums">
                  {formatAmount(amount, locale)}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...lines, emptyLine(defaultVatType)])}
        >
          <Plus /> {t('doc.line.add')}
        </Button>
      </div>
    </div>
  );
}
