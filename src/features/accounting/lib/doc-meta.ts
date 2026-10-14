import type { DocStatus, DocType } from '../api';

/** The four sales-side screens. A receipt screen holds both receipt (RE) and tax invoice/receipt (TX). */
export type DocKind = 'quotation' | 'invoice' | 'receipt' | 'credit_note';

export const DOC_KINDS: readonly DocKind[] = ['quotation', 'invoice', 'receipt', 'credit_note'];

const SEGMENT: Record<DocKind, string> = {
  quotation: 'quotations',
  invoice: 'invoices',
  receipt: 'receipts',
  credit_note: 'credit-notes',
};

export function kindOf(type: DocType): DocKind {
  return type === 'tax_invoice' ? 'receipt' : type;
}

export const listPath = (kind: DocKind) => `/accounting/${SEGMENT[kind]}`;
export const newPath = (kind: DocKind) => `/accounting/${SEGMENT[kind]}/new`;
export const detailPath = (type: DocType, id: string) => `/accounting/${SEGMENT[kindOf(type)]}/${id}`;

/** Statuses that can be filtered per screen (the API enum is shared by all document types). */
export const KIND_STATUSES: Record<DocKind, readonly (DocStatus | 'overdue')[]> = {
  quotation: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'void'],
  invoice: ['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void'],
  receipt: ['draft', 'issued', 'void'],
  credit_note: ['draft', 'issued', 'void'],
};

export const STATUS_TONE: Record<
  DocStatus | 'overdue',
  'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'default'
> = {
  draft: 'secondary',
  sent: 'outline',
  accepted: 'success',
  rejected: 'destructive',
  expired: 'warning',
  issued: 'outline',
  partially_paid: 'warning',
  paid: 'success',
  void: 'destructive',
  overdue: 'destructive',
};

/** Where a "ค่าแพ็กเกจร้าน" / consulting invoice is managed (read-only here, no double entry). */
export const SHOP_INVOICES_PATH = '/platform/invoices';
