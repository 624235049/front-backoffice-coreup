import type { AccDocument, Contact, DocType, DocumentBody, LineBody, VatMode, WhtBp } from '../api';
import { type CalcLine, type CalcTotals, calcTotals } from './calc';
import { isOptionalEmailOk, isOptionalTaxIdOk } from './tax-id';

/** A line as it lives in the editor: numbers the user types stay strings until the body is built. */
export type EditorLine = {
  key: string;
  itemId: string | null;
  description: string;
  qty: string;
  unit: string;
  unitPriceMinor: number | null;
  discountMinor: number | null;
  vatType: 'vat' | 'none' | 'exempt';
};

/** The customer typed in the form (all text; the API saves it as a contact, no separate step). */
export type CustomerFields = {
  name: string;
  taxId: string;
  branchCode: string;
  address: string;
  contactPerson: string;
  phone: string;
  email: string;
};

export const emptyCustomer = (): CustomerFields => ({
  name: '',
  taxId: '',
  branchCode: '00000',
  address: '',
  contactPerson: '',
  phone: '',
  email: '',
});

export type EditorState = {
  customer: CustomerFields;
  /** a draft's own contact with the fields it had when loaded: sent by id while the typed fields are unchanged */
  linked: { id: string; fields: CustomerFields } | null;
  docDate: string;
  dueDate: string;
  reference: string;
  vatMode: VatMode;
  whtBp: WhtBp;
  discountMinor: number | null;
  lines: EditorLine[];
  note: string;
  internalNote: string;
  refDocumentId: string | null;
};

let seq = 0;
export const newLineKey = (): string => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

export const emptyLine = (vatType: EditorLine['vatType'] = 'vat'): EditorLine => ({
  key: newLineKey(),
  itemId: null,
  description: '',
  qty: '1',
  unit: '',
  unitPriceMinor: null,
  discountMinor: null,
  vatType,
});

/** Parse a typed quantity ("2", "1.5", "0,5"); null when not a positive number with ≤ 3 decimals. */
export function parseQty(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6 ? n : null;
}

/** A line the user has actually filled in (blank spare rows are dropped when saving). */
export const isBlankLine = (l: EditorLine): boolean =>
  l.description.trim() === '' && (l.unitPriceMinor ?? 0) === 0;

export function toCalcLines(lines: readonly EditorLine[]): CalcLine[] {
  return lines
    .filter((l) => !isBlankLine(l))
    .map((l) => ({
      qty: parseQty(l.qty) ?? 0,
      unitPriceMinor: l.unitPriceMinor ?? 0,
      discountMinor: l.discountMinor ?? 0,
      vatType: l.vatType,
    }));
}

export function editorTotals(s: EditorState, vatRateBp: number): CalcTotals {
  return calcTotals({
    lines: toCalcLines(s.lines),
    discountMinor: s.discountMinor ?? 0,
    vatMode: s.vatMode,
    vatRateBp,
    whtBp: s.whtBp,
  });
}

export type EditorError =
  | 'contact'
  | 'taxId'
  | 'branchCode'
  | 'email'
  | 'lines'
  | 'description'
  | 'qty'
  | 'price'
  | 'discount'
  | 'dueDate';

/** Validation errors by field key; empty when the state can be sent to the API. */
export function validateEditor(s: EditorState): Partial<Record<EditorError, true>> {
  const errors: Partial<Record<EditorError, true>> = {};
  const c = s.customer;
  if (c.name.trim() === '') errors.contact = true;
  if (!isOptionalTaxIdOk(c.taxId)) errors.taxId = true;
  if (c.branchCode !== '' && !/^\d{5}$/.test(c.branchCode)) errors.branchCode = true;
  if (!isOptionalEmailOk(c.email)) errors.email = true;
  const filled = s.lines.filter((l) => !isBlankLine(l));
  if (filled.length === 0) errors.lines = true;
  for (const l of filled) {
    if (l.description.trim() === '') errors.description = true;
    if (parseQty(l.qty) === null) errors.qty = true;
    if (l.unitPriceMinor === null) errors.price = true;
    if (l.discountMinor !== null && l.unitPriceMinor !== null) {
      const qty = parseQty(l.qty) ?? 0;
      const gross = Math.round(l.unitPriceMinor * qty);
      if (l.discountMinor > gross) errors.discount = true;
    }
  }
  if (s.dueDate && s.docDate && s.dueDate < s.docDate) errors.dueDate = true;
  return errors;
}

export function toLineBody(l: EditorLine): LineBody {
  return {
    itemId: l.itemId,
    description: l.description.trim(),
    qty: parseQty(l.qty) ?? 1,
    unit: l.unit.trim() || null,
    unitPriceMinor: l.unitPriceMinor ?? 0,
    discountMinor: l.discountMinor ?? 0,
    vatType: l.vatType,
  };
}

const sameCustomer = (a: CustomerFields, b: CustomerFields): boolean =>
  (Object.keys(a) as (keyof CustomerFields)[]).every((k) => a[k].trim() === b[k].trim());

/** The customer part of the body: the draft's contact id while untouched, else the typed customer (empty → null). */
export function customerBody(s: EditorState): Pick<DocumentBody, 'contactId' | 'customer'> {
  if (s.linked && sameCustomer(s.customer, s.linked.fields)) return { contactId: s.linked.id };
  const c = s.customer;
  const text = (v: string) => v.trim() || null;
  return {
    customer: {
      name: c.name.trim(),
      taxId: text(c.taxId),
      // a branch only means something next to a tax id
      branchCode: c.taxId.trim() ? text(c.branchCode) : null,
      address: text(c.address),
      contactPerson: text(c.contactPerson),
      phone: text(c.phone),
      email: text(c.email),
    },
  };
}

/** Body for create (`type` set) and update (the API ignores `type`/`issue` there). */
export function toBody(s: EditorState, type: DocType, issue = false): DocumentBody {
  return {
    type,
    ...customerBody(s),
    docDate: s.docDate,
    dueDate: s.dueDate || null,
    reference: s.reference.trim() || null,
    vatMode: s.vatMode,
    whtBp: s.whtBp,
    discountMinor: s.discountMinor ?? 0,
    lines: s.lines.filter((l) => !isBlankLine(l)).map(toLineBody),
    note: s.note.trim() || null,
    internalNote: s.internalNote.trim() || null,
    refDocumentId: s.refDocumentId,
    issue,
    payment: null,
  };
}

/** The contact's fields as the form shows them. */
export const customerOf = (
  c: Pick<Contact, 'name' | 'taxId' | 'branchCode' | 'address' | 'contactPerson' | 'phone' | 'email'>,
): CustomerFields => ({
  name: c.name,
  taxId: c.taxId ?? '',
  branchCode: c.branchCode ?? '00000',
  address: c.address ?? '',
  contactPerson: c.contactPerson ?? '',
  phone: c.phone ?? '',
  email: c.email ?? '',
});

/** `contact`: the draft's linked contact (phone / email / person are not in the document's snapshot). */
export function fromDocument(d: AccDocument, contact?: Contact): EditorState {
  const customer = customerOf(contact ?? { ...d.contact, contactPerson: null, phone: null, email: null });
  return {
    customer,
    linked: d.contactId && contact ? { id: d.contactId, fields: customer } : null,
    docDate: d.docDate,
    dueDate: d.dueDate ?? '',
    reference: d.reference ?? '',
    vatMode: d.vatMode,
    whtBp: d.whtBp as WhtBp,
    discountMinor: d.discountMinor === 0 ? null : d.discountMinor,
    lines: d.lines.map((l) => ({
      key: newLineKey(),
      itemId: l.itemId,
      description: l.description,
      qty: String(l.qty),
      unit: l.unit ?? '',
      unitPriceMinor: l.unitPriceMinor,
      discountMinor: l.discountMinor === 0 ? null : l.discountMinor,
      vatType: l.vatType,
    })),
    note: d.note ?? '',
    internalNote: d.internalNote ?? '',
    refDocumentId: d.refDocumentId,
  };
}

export function newEditorState(opts: {
  today: string;
  dueDate: string;
  vatRegistered: boolean;
  defaultNote: string | null;
}): EditorState {
  return {
    customer: emptyCustomer(),
    linked: null,
    docDate: opts.today,
    dueDate: opts.dueDate,
    reference: '',
    vatMode: opts.vatRegistered ? 'exclusive' : 'none',
    whtBp: 0,
    discountMinor: null,
    lines: [emptyLine(opts.vatRegistered ? 'vat' : 'none')],
    note: opts.defaultNote ?? '',
    internalNote: '',
    refDocumentId: null,
  };
}

/** 'YYYY-MM-DD' + n days (UTC arithmetic on a date-only string). */
export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
