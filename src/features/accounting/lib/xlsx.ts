/**
 * Excel export. Row building is pure (and unit-tested); `downloadXlsx` loads `exceljs` lazily so the library
 * only ships when somebody actually clicks "Export".
 *
 * Money stays integer satang until the very last step: totals are summed in satang, then written as baht numbers
 * with a 2-decimal number format so Excel can add them up again (AGENTS rule 7).
 */

export type XlsxKind = 'text' | 'money' | 'int' | 'percent' | 'date';

export type XlsxCell = string | number | null;

export type XlsxColumn<R> = {
  header: string;
  /** Raw value: money = satang (integer), percent = basis points, date = 'YYYY-MM-DD'. */
  value: (row: R) => XlsxCell;
  kind?: XlsxKind;
  width?: number;
  /** Sum this column into the totals row (money / int only). */
  total?: boolean;
};

export type SheetRows = {
  header: string[];
  body: XlsxCell[][];
  /** null when no column is summed. */
  totals: XlsxCell[] | null;
};

/** Satang → baht as a JS number, exact to 2 decimals (no float drift for the integers we hold). */
export const satangToBaht = (minor: number): number => Math.round(minor) / 100;

function cellValue(kind: XlsxKind, raw: XlsxCell): XlsxCell {
  if (raw === null || raw === undefined) return null;
  if (kind === 'money') return typeof raw === 'number' ? satangToBaht(raw) : raw;
  if (kind === 'percent') return typeof raw === 'number' ? raw / 10000 : raw;
  return raw;
}

/** Pure row builder: header texts, body rows (baht numbers) and an optional totals row. */
export function buildSheetRows<R>(
  columns: readonly XlsxColumn<R>[],
  rows: readonly R[],
  totalsLabel?: string,
): SheetRows {
  const header = columns.map((c) => c.header);
  const body = rows.map((r) => columns.map((c) => cellValue(c.kind ?? 'text', c.value(r))));
  if (!columns.some((c) => c.total)) return { header, body, totals: null };
  let labelPlaced = false;
  const totals = columns.map((c) => {
    if (c.total) {
      let sum = 0;
      for (const r of rows) {
        const v = c.value(r);
        if (typeof v === 'number') sum += v;
      }
      return cellValue(c.kind ?? 'int', sum);
    }
    if (!labelPlaced && totalsLabel) {
      labelPlaced = true;
      return totalsLabel;
    }
    return null;
  });
  return { header, body, totals };
}

const NUM_FMT: Record<XlsxKind, string | undefined> = {
  text: undefined,
  money: '#,##0.00',
  int: '#,##0',
  percent: '0.00%',
  date: 'yyyy-mm-dd',
};

export type XlsxSheet<R = unknown> = {
  name: string;
  columns: readonly XlsxColumn<R>[];
  rows: readonly R[];
  totalsLabel?: string;
  /** Lines above the table (report title, period, company). */
  title?: string[];
};

/** Excel forbids these characters in sheet names and caps them at 31 chars. */
export function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim();
  return (cleaned || 'Sheet').slice(0, 31);
}

export async function buildWorkbookBlob(sheets: readonly XlsxSheet<never>[]): Promise<Blob> {
  // Dynamic import on purpose: exceljs is ~1 MB and must stay out of the main bundle (code-split chunk).
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CoreUp';
  wb.created = new Date();
  const used = new Set<string>();
  for (const sheet of sheets as unknown as readonly XlsxSheet<unknown>[]) {
    let name = safeSheetName(sheet.name);
    for (let n = 2; used.has(name.toLowerCase()); n++)
      name = `${safeSheetName(sheet.name).slice(0, 28)} ${n}`;
    used.add(name.toLowerCase());
    const ws = wb.addWorksheet(name, {
      views: [{ state: 'frozen', ySplit: (sheet.title?.length ?? 0) + 1 }],
    });
    for (const line of sheet.title ?? []) {
      const r = ws.addRow([line]);
      r.font = { bold: true, size: 12 };
    }
    const { header, body, totals } = buildSheetRows(sheet.columns, sheet.rows, sheet.totalsLabel);
    const head = ws.addRow(header);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2D4F' } };
    head.alignment = { vertical: 'middle' };
    for (const r of body) ws.addRow(r);
    if (totals) {
      const tr = ws.addRow(totals);
      tr.font = { bold: true };
      tr.border = { top: { style: 'thin' } };
    }
    sheet.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = c.width ?? (c.kind === 'money' ? 16 : c.kind === 'date' ? 13 : 22);
      const fmt = NUM_FMT[c.kind ?? 'text'];
      if (fmt) col.numFmt = fmt;
      if (c.kind === 'money' || c.kind === 'int' || c.kind === 'percent') {
        col.alignment = { horizontal: 'right' };
      }
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** Build the workbook and trigger a browser download. */
export async function downloadXlsx(filename: string, sheets: readonly XlsxSheet<never>[]): Promise<void> {
  const blob = await buildWorkbookBlob(sheets);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
