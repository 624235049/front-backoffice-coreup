import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback } from 'react';
import { z } from 'zod';

/** A YYYY-MM-DD string, anything else is dropped (a bad hand-edited URL never breaks the page). */
const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);
const text = z.string().max(200).optional().catch(undefined);

/** Search params shared by every accounting list: `?q=&status=&type=&source=&from=&to=`. */
export const listSearchSchema = z.object({
  q: text,
  status: text,
  /** receipts screen: receipt | tax_invoice; invoices screen: source filter */
  type: text,
  source: text,
  category: text,
  from: ymd,
  to: ymd,
});

export type ListSearch = z.infer<typeof listSearchSchema>;

/** Search params of the reports page. */
export const reportSearchSchema = z.object({
  tab: z.enum(['pnl', 'receivables', 'vat', 'wht', 'expenses']).optional().catch(undefined),
  from: ymd,
  to: ymd,
  group: z.enum(['month', 'year']).optional().catch(undefined),
  view: z.enum(['sales', 'purchase']).optional().catch(undefined),
  /** overview: YYYY-MM */
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
});

export type ReportSearch = z.infer<typeof reportSearchSchema>;

/**
 * Read filters from the URL and patch them back (replace, so Back does not step through keystrokes).
 * Empty strings/undefined remove the param.
 */
export function useUrlFilters<T extends Record<string, unknown>>(): [T, (patch: Partial<T>) => void] {
  const search = useRouterState({ select: (st) => st.location.search }) as unknown as T;
  const navigate = useNavigate();
  const patch = useCallback(
    (p: Partial<T>) => {
      void navigate({
        to: '.',
        replace: true,
        search: ((prev: Record<string, unknown>) => {
          const next: Record<string, unknown> = { ...prev, ...p };
          for (const k of Object.keys(next)) {
            if (next[k] === '' || next[k] === undefined || next[k] === null) delete next[k];
          }
          return next;
        }) as never,
      });
    },
    [navigate],
  );
  return [search, patch];
}
