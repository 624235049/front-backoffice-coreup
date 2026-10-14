import { Search, X } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { todayBangkok } from '@/features/platform/format';
import { presetRange, type RangePreset } from '../lib/format';
import { DateField } from './date-pickers';

const ALL = '__all__';

export type FilterValues = { q?: string; status?: string; from?: string; to?: string };

/** Debounced text box bound to a URL param. */
export function SearchBox({
  value,
  onCommit,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const id = setTimeout(() => onCommit(text), 300);
    return () => clearTimeout(id);
  }, [text, value, onCommit]);
  return (
    <div className="relative min-w-48 flex-1 sm:max-w-xs">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9"
      />
    </div>
  );
}

/** Two date inputs plus quick ranges (this month / last month / this year). */
export function DateRangeFilter({
  from,
  to,
  onChange,
  presets = ['thisMonth', 'lastMonth', 'thisYear'],
}: {
  from?: string;
  to?: string;
  onChange: (range: { from?: string; to?: string }) => void;
  presets?: readonly RangePreset[];
}) {
  const { t } = useTranslation('accounting');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DateField
        value={from ?? ''}
        max={to || undefined}
        onChange={(v) => onChange({ from: v || undefined, to })}
        label={t('filter.from')}
        placeholder={t('filter.from')}
        clearable
      />
      <span className="text-muted-foreground" aria-hidden>
        –
      </span>
      <DateField
        value={to ?? ''}
        min={from || undefined}
        onChange={(v) => onChange({ from, to: v || undefined })}
        label={t('filter.to')}
        placeholder={t('filter.to')}
        clearable
      />
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <Button
            key={p}
            type="button"
            variant="ghost"
            size="sm"
            className="text-mint-700"
            onClick={() => onChange(presetRange(p, todayBangkok()))}
          >
            {t(`filter.preset.${p}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function StatusFilter({
  value,
  onChange,
  options,
  allLabel,
  label,
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
  options: readonly { value: string; label: string }[];
  allLabel: string;
  label: string;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
      <SelectTrigger className="w-44" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Wrapper that lays filters out in a wrapping row and shows "clear" when any filter is set. */
export function FilterBar({
  active,
  onClear,
  children,
}: {
  active: boolean;
  onClear: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation('accounting');
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {children}
      {active ? (
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          <X /> {t('filter.clear')}
        </Button>
      ) : null}
    </div>
  );
}
