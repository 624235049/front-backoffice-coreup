import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { type ComponentProps, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDate, todayBangkok, useIntlLocale } from '@/features/platform/format';
import { cn } from '@/lib/utils';
import { formatMonthKey } from '../lib/format';
import { buildMonthGrid, monthNames, shiftMonth, weekdayNames, yearLabel } from '../lib/thai-calendar';

function PickerButton({
  text,
  placeholder,
  className,
  ...props
}: { text: string; placeholder?: boolean } & Omit<ComponentProps<typeof Button>, 'children'>) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn('h-11 w-full justify-between gap-2 px-3 font-normal sm:w-auto sm:min-w-40', className)}
      {...props}
    >
      <span className="flex min-w-0 items-center gap-2">
        <CalendarDays className="size-4 shrink-0 text-mint-600" aria-hidden />
        <span className={cn('truncate', placeholder && 'text-muted-foreground')}>{text}</span>
      </span>
      <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
    </Button>
  );
}

/**
 * Date field with a Thai month calendar (Buddhist year) instead of the browser's native picker.
 * Value and callbacks are ISO `YYYY-MM-DD`; an empty string means "no date" (only when `clearable`).
 */
export function DateField({
  value,
  onChange,
  label,
  id,
  min,
  max,
  clearable,
  placeholder,
  className,
}: {
  value: string;
  onChange: (ymd: string) => void;
  label: string;
  id?: string;
  min?: string;
  max?: string;
  clearable?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const [open, setOpen] = useState(false);
  const today = todayBangkok();
  const [view, setView] = useState(() => (value || today).slice(0, 7));
  const cells = buildMonthGrid(view);
  const text = value ? formatDate(value, locale) : (placeholder ?? t('datePicker.pick'));

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setView((value || today).slice(0, 7));
      }}
    >
      <PopoverTrigger asChild>
        <PickerButton
          id={id}
          text={text}
          placeholder={!value}
          aria-label={`${label}: ${text}`}
          className={className}
        />
      </PopoverTrigger>
      <PopoverContent>
        <div className="mb-2 flex items-center justify-between">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t('datePicker.prevMonth')}
            onClick={() => setView((v) => shiftMonth(v, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span className="font-semibold text-navy-900">{formatMonthKey(view, locale)}</span>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t('datePicker.nextMonth')}
            onClick={() => setView((v) => shiftMonth(v, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
          {weekdayNames(locale).map((w) => (
            <span key={w} className="py-1">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((c, i) =>
            c === null ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: leading blanks of the month grid
              <span key={`b${i}`} />
            ) : (
              <button
                key={c.ymd}
                type="button"
                disabled={(min !== undefined && c.ymd < min) || (max !== undefined && c.ymd > max)}
                aria-label={formatDate(c.ymd, locale)}
                aria-pressed={c.ymd === value}
                onClick={() => {
                  onChange(c.ymd);
                  setOpen(false);
                }}
                className={cn(
                  'grid size-10 place-items-center rounded-lg text-sm tabular-nums outline-none transition-colors hover:bg-mint-50 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30',
                  c.ymd === today && 'font-bold text-mint-700',
                  c.ymd === value && 'bg-navy-900 text-white hover:bg-navy-800',
                )}
              >
                {c.day}
              </button>
            ),
          )}
        </div>
        <div className="mt-2 flex items-center justify-between border-t pt-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-mint-700"
            onClick={() => {
              onChange(today);
              setOpen(false);
            }}
          >
            {t('datePicker.today')}
          </Button>
          {clearable && value ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              <X /> {t('clear')}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Month picker: year stepper + 12 Thai month names. `value` is `YYYY-MM`. */
export function MonthField({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (ym: string) => void;
  label: string;
  className?: string;
}) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(value.slice(0, 4)));
  const text = formatMonthKey(value, locale);
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setYear(Number(value.slice(0, 4)));
      }}
    >
      <PopoverTrigger asChild>
        <PickerButton text={text} aria-label={`${label}: ${text}`} className={className} />
      </PopoverTrigger>
      <PopoverContent>
        <div className="mb-3 flex items-center justify-between">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t('datePicker.prevYear')}
            onClick={() => setYear((y) => y - 1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span className="font-semibold text-navy-900">{yearLabel(year, locale)}</span>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t('datePicker.nextYear')}
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {monthNames(locale).map((name, i) => {
            const ym = `${year}-${String(i + 1).padStart(2, '0')}`;
            return (
              <Button
                key={ym}
                type="button"
                size="sm"
                variant={ym === value ? 'default' : 'outline'}
                onClick={() => {
                  onChange(ym);
                  setOpen(false);
                }}
              >
                {name}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
