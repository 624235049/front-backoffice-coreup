import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Scannable table shell: the box scrolls (both ways) so the header row stays pinned while reading long lists,
 * numbers are right-aligned and tabular, and a totals row can stay pinned at the bottom.
 * Use with `DtHead` / `DtRow` / `DtCell` / `DtTotals`.
 */
export function DataTable({
  className,
  children,
  maxHeight = 'max-h-[calc(100dvh-20rem)] min-h-40',
}: {
  className?: string;
  children: React.ReactNode;
  maxHeight?: string;
}) {
  return (
    <div className={cn('overflow-auto rounded-xl border bg-white shadow-xs', maxHeight, className)}>
      <table className="w-full min-w-max border-separate border-spacing-0 text-sm">{children}</table>
    </div>
  );
}

export function DtHead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr>{children}</tr>
    </thead>
  );
}

export function DtTh({
  className,
  num,
  ...props
}: React.ComponentProps<'th'> & {
  /** Right-align (money / quantity columns). */
  num?: boolean;
}) {
  return (
    <th
      className={cn(
        'sticky top-0 z-10 h-10 border-b bg-navy-50 px-3 text-xs font-semibold whitespace-nowrap text-navy-800',
        num ? 'text-right' : 'text-left',
        className,
      )}
      {...props}
    />
  );
}

export function DtRow({
  className,
  onClick,
  ...props
}: React.ComponentProps<'tr'> & { onClick?: React.MouseEventHandler<HTMLTableRowElement> }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'group transition-colors odd:bg-white even:bg-navy-50/30 hover:bg-mint-50',
        onClick && 'cursor-pointer',
        className,
      )}
      {...props}
    />
  );
}

export function DtCell({
  className,
  num,
  ...props
}: React.ComponentProps<'td'> & {
  num?: boolean;
}) {
  return (
    <td
      className={cn(
        'border-b border-navy-100/60 px-3 py-2.5 align-middle',
        num && 'text-right tabular-nums',
        className,
      )}
      {...props}
    />
  );
}

/** Pinned totals row: `<DtTotals label="รวม" span={4}>` then number cells. */
export function DtTotals({
  label,
  span = 1,
  children,
}: {
  label: React.ReactNode;
  span?: number;
  children: React.ReactNode;
}) {
  return (
    <tfoot>
      <tr className="font-semibold">
        <td
          colSpan={span}
          className="sticky bottom-0 z-10 border-t-2 border-navy-200 bg-navy-50 px-3 py-3 text-navy-900"
        >
          {label}
        </td>
        {children}
      </tr>
    </tfoot>
  );
}

/** A number cell inside `DtTotals` (shares the pinned styling). */
export function DtTotalCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      className={cn(
        'sticky bottom-0 z-10 border-t-2 border-navy-200 bg-navy-50 px-3 py-3 text-right whitespace-nowrap text-navy-900 tabular-nums',
        className,
      )}
      {...props}
    />
  );
}
