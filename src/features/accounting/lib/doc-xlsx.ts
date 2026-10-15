/**
 * One accounting document as an Excel sheet: company header block, document facts, line table, totals.
 * `buildDocumentSheet` is pure (unit-tested); `buildDocumentWorkbookBlob` / `downloadDocumentXlsx` write it with
 * `exceljs`, loaded lazily like the list export. Money stays integer satang until the last step (AGENTS rule 7).
 */
import type { AccDocument, Company } from '../api';
import { safeSheetName, satangToBaht, saveBlob, type XlsxCell, type XlsxKind } from './xlsx';

export type DocCell = {
  v: XlsxCell;
  kind?: XlsxKind;
  bold?: boolean;
  /** table header styling */
  head?: boolean;
  /** thin top border (totals) */
  top?: boolean;
  /** right aligned text (labels next to a number) */
  right?: boolean;
};

export type DocSheet = {
  name: string;
  /** rows × 7 columns: # · description · qty · unit · unit price · discount · amount */
  rows: DocCell[][];
  widths: number[];
};

export type DocSheetLabels = {
  /** `ใบแจ้งหนี้ / ใบวางบิล` */
  title: string;
  /** localized status, e.g. `ชำระแล้ว` */
  status: string;
  number: string;
  date: string;
  /** `ครบกำหนด` or `ใช้ได้ถึง` */
  due: string;
  reference: string;
  customer: string;
  taxId: string;
  branch: string;
  address: string;
  phone: string;
  email: string;
  draftNumber: string;
  headOffice: string;
  col: {
    no: string;
    description: string;
    qty: string;
    unit: string;
    unitPrice: string;
    discount: string;
    amount: string;
  };
  totals: {
    lines: string;
    discount: string;
    beforeVat: string;
    vat: string;
    total: string;
    wht: string;
    net: string;
  };
};

type Issuer = Pick<
  Company,
  'legalName' | 'taxId' | 'branchCode' | 'branchName' | 'address' | 'phone' | 'email'
>;

const text = (v: string, extra: Partial<DocCell> = {}): DocCell => ({ v, ...extra });
const money = (minor: number, extra: Partial<DocCell> = {}): DocCell => ({
  v: minor,
  kind: 'money',
  ...extra,
});
const blank: DocCell = { v: null };

/** Sheet model of a document. Money cells carry satang; the writer converts to baht. */
export function buildDocumentSheet(doc: AccDocument, issuer: Issuer, L: DocSheetLabels): DocSheet {
  const rows: DocCell[][] = [];
  const row = (...cells: DocCell[]) =>
    rows.push([...cells, ...Array(Math.max(0, 7 - cells.length)).fill(blank)]);
  const fact = (label: string, value: string | null | undefined) => {
    if (value) row(blank, text(label, { bold: true }), text(value));
  };

  const branch =
    issuer.branchCode === '00000' ? L.headOffice : `${L.branch} ${issuer.branchName ?? issuer.branchCode}`;
  row(text(issuer.legalName, { bold: true }));
  if (issuer.address) row(text(issuer.address));
  row(text(`${issuer.taxId ? `${L.taxId} ${issuer.taxId} · ` : ''}${branch}`));
  const contact = [issuer.phone ? `${L.phone} ${issuer.phone}` : '', issuer.email ?? '']
    .filter(Boolean)
    .join(' · ');
  if (contact) row(text(contact));
  row();
  row(text(`${L.title} · ${L.status}`, { bold: true }));
  fact(L.number, doc.number ?? L.draftNumber);
  fact(L.date, doc.docDate);
  if (doc.type === 'invoice' || doc.type === 'quotation') fact(L.due, doc.dueDate);
  fact(L.reference, doc.reference);
  fact(L.customer, doc.contact.name);
  fact(
    L.taxId,
    doc.contact.taxId
      ? `${doc.contact.taxId}${
          doc.contact.branchCode
            ? ` · ${doc.contact.branchCode === '00000' ? L.headOffice : `${L.branch} ${doc.contact.branchCode}`}`
            : ''
        }`
      : null,
  );
  fact(L.address, doc.contact.address);
  row();

  const hasDiscount = doc.lines.some((l) => l.discountMinor > 0);
  const head = (v: string, right = false): DocCell => ({ v, head: true, right });
  row(
    head(L.col.no),
    head(L.col.description),
    head(L.col.qty, true),
    head(L.col.unit),
    head(L.col.unitPrice, true),
    head(L.col.discount, true),
    head(L.col.amount, true),
  );
  for (const [i, l] of doc.lines.entries()) {
    row(
      { v: i + 1, kind: 'int' },
      text(l.description),
      { v: l.qty, kind: 'text' },
      text(l.unit ?? ''),
      money(l.unitPriceMinor),
      hasDiscount && l.discountMinor > 0 ? money(l.discountMinor) : blank,
      money(l.amountMinor),
    );
  }
  row();

  const total = (label: string, value: DocCell) =>
    row(blank, blank, blank, blank, text(label, value.top ? { bold: true, top: true } : {}), blank, value);
  total(L.totals.lines, money(doc.linesTotalMinor));
  if (doc.discountMinor > 0) total(L.totals.discount, money(-doc.discountMinor));
  if (doc.vatMode !== 'none') {
    total(L.totals.beforeVat, money(doc.taxableMinor + doc.exemptMinor));
    total(`${L.totals.vat} ${doc.vatRateBp / 100}%`, money(doc.vatMinor));
  }
  total(L.totals.total, money(doc.totalMinor, { bold: true, top: true }));
  if (doc.whtMinor > 0) {
    total(`${L.totals.wht}${doc.whtBp > 0 ? ` ${doc.whtBp / 100}%` : ''}`, money(-doc.whtMinor));
    total(L.totals.net, money(doc.netMinor, { bold: true, top: true }));
  }
  if (doc.note) {
    row();
    row(text(doc.note));
  }
  return { name: safeSheetName(doc.number ?? L.title), rows, widths: [6, 46, 10, 10, 16, 14, 18] };
}

const NUM_FMT: Partial<Record<XlsxKind, string>> = { money: '#,##0.00', int: '#,##0' };

export async function buildDocumentWorkbookBlob(sheet: DocSheet): Promise<Blob> {
  // Dynamic import on purpose: exceljs is ~1 MB and must stay out of the main bundle (code-split chunk).
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CoreUp';
  wb.created = new Date();
  const ws = wb.addWorksheet(sheet.name, {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true },
  });
  sheet.widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  for (const cells of sheet.rows) {
    const r = ws.addRow(
      cells.map((c) => (c.kind === 'money' && typeof c.v === 'number' ? satangToBaht(c.v) : c.v)),
    );
    cells.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      const fmt = c.kind ? NUM_FMT[c.kind] : undefined;
      if (fmt) cell.numFmt = fmt;
      if (c.bold) cell.font = { bold: true };
      if (c.right || c.kind === 'money') cell.alignment = { horizontal: 'right' };
      if (c.head) {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2D4F' } };
      }
      if (c.top) cell.border = { top: { style: 'thin' } };
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function downloadDocumentXlsx(filename: string, sheet: DocSheet): Promise<void> {
  saveBlob(
    await buildDocumentWorkbookBlob(sheet),
    filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`,
  );
}
