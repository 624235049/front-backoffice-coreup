import { type Invoice, useInvoices } from './api';

/** The shop said "I paid" (uploaded a slip) and the team has not confirmed or rejected it yet. */
export const hasPendingSlip = (i: Pick<Invoice, 'status' | 'slipUploadedAt'>): boolean =>
  (i.status === 'issued' || i.status === 'overdue') && i.slipUploadedAt !== null;

/**
 * Red badge on the "ใบแจ้งหนี้" nav item: slips waiting for review. Polled; only subscription invoices carry slips and
 * only unpaid ones can wait, so two small status queries instead of a new summary endpoint.
 */
export function usePendingSlipCount(): number {
  const issued = useInvoices({ status: 'issued', source: 'subscription' }, 60_000);
  const overdue = useInvoices({ status: 'overdue', source: 'subscription' }, 60_000);
  return [...(issued.data ?? []), ...(overdue.data ?? [])].filter(hasPendingSlip).length;
}
