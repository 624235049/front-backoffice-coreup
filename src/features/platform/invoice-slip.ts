import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type Invoice, useInvoices } from './api';

/** The shop said "I paid" (uploaded a slip) and the team has not confirmed or rejected it yet. */
export const hasPendingSlip = (i: Pick<Invoice, 'status' | 'slipUploadedAt'>): boolean =>
  (i.status === 'issued' || i.status === 'overdue') && i.slipUploadedAt !== null;

/**
 * Red badge on the "ใบแจ้งหนี้" nav item: the "รอยืนยันรับเงิน" queue (unpaid invoices with a slip). Polled, and a toast
 * appears when a new slip arrives while the console is open (the admin's "bell"; the email goes out as well).
 */
export function usePendingSlipCount(): number {
  const { t } = useTranslation('platform');
  const pending = useInvoices({ awaiting: 'true' }, 60_000);
  const count = pending.data?.length ?? 0;
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!pending.data) return;
    // the first load only sets the baseline; later increases are new slips
    if (last.current !== null && count > last.current)
      toast(t('invoices.slip.newToast', { count: count - last.current }), { id: 'new-slip' });
    last.current = count;
  }, [pending.data, count, t]);
  return count;
}
