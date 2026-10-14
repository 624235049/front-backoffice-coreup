import type { AccDocument, DocType, DocumentBody, LineBody, VatMode, WhtBp } from '../api';
import { type CalcLine, type CalcTotals, calcTotals } from './calc';

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

export type EditorState = {
  contactId: string | null;
  contactName: string;
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

export type EditorError = 'contact' | 'lines' | 'description' | 'qty' | 'price' | 'discount' | 'dueDate';

/** Validation errors by field key; empty when the state can be sent to the API. */
export function validateEditor(s: EditorState): Partial<Record<EditorError, true>> {
  const errors: Partial<Record<EditorError, true>> = {};
  if (!s.contactId) errors.contact = true;
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

/** Body for create (`type` set) and update (the API ignores `type`/`issue` there). */
export function toBody(s: EditorState, type: DocType, issue = false): DocumentBody {
  return {
    type,
    contactId: s.contactId as string,
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

export function fromDocument(d: AccDocument): EditorState {
  return {
    contactId: d.contactId,
    contactName: d.contact.name,
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
    contactId: null,
    contactName: '',
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
