import { ChevronsUpDown, X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type ComboOption = { value: string; label: string; hint?: string };

/**
 * Type-to-search picker. Options come from the parent (usually a debounced server search), so this component only
 * owns the open/close state, keyboard navigation and the text box. The text box shows the selected label when
 * closed and the search text while the user types.
 */
export function Combobox({
  value,
  selectedLabel,
  options,
  onSearch,
  onSelect,
  onClear,
  placeholder,
  emptyText,
  loading,
  disabled,
  clearLabel,
  footer,
  className,
  'aria-label': ariaLabel,
}: {
  value: string | null;
  /** Label of the current value (the option list may not contain it any more). */
  selectedLabel?: string;
  options: readonly ComboOption[];
  onSearch: (q: string) => void;
  onSelect: (option: ComboOption) => void;
  onClear?: () => void;
  placeholder?: string;
  emptyText: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  clearLabel?: string;
  /** Extra row at the bottom of the list (e.g. "+ new contact"). */
  footer?: ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (o: ComboOption) => {
    onSelect(o);
    setOpen(false);
    setText('');
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        className="pr-16"
        value={open ? text : (selectedLabel ?? '')}
        onFocus={() => {
          setOpen(true);
          setText('');
          setActive(0);
          onSearch('');
        }}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
          onSearch(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, options.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && open) {
            const o = options[active];
            if (o) {
              e.preventDefault();
              pick(o);
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1 text-muted-foreground">
        {value && onClear && !disabled ? (
          <button
            type="button"
            className="pointer-events-auto grid size-7 place-items-center rounded hover:bg-muted"
            aria-label={clearLabel}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClear}
          >
            <X className="size-4" />
          </button>
        ) : null}
        <ChevronsUpDown className="size-4" aria-hidden />
      </div>
      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full min-w-56 overflow-auto rounded-lg border bg-white py-1 shadow-lg"
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{loading ? '…' : emptyText}</div>
          ) : (
            options.map((o, i) => (
              <div
                key={o.value}
                role="option"
                tabIndex={-1}
                aria-selected={o.value === value}
                className={cn(
                  'flex min-h-11 cursor-pointer flex-col justify-center px-3 py-1.5 text-sm',
                  i === active && 'bg-mint-50',
                  o.value === value && 'font-medium',
                )}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                onKeyDown={() => undefined}
              >
                <span className="truncate">{o.label}</span>
                {o.hint ? <span className="truncate text-xs text-muted-foreground">{o.hint}</span> : null}
              </div>
            ))
          )}
          {footer ? <div className="border-t">{footer}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
