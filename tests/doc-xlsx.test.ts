import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { AccDocument } from '@/features/accounting/api';
import {
  buildDocumentSheet,
  buildDocumentWorkbookBlob,
  type DocSheet,
  type DocSheetLabels,
} from '@/features/accounting/lib/doc-xlsx';

const L: DocSheetLabels = {
  title: 'ใบแจ้งหนี้',
  status: 'ออกแล้ว',
  number: 'เลขที่',
  date: 'วันที่',
  due: 'ครบกำหนด',
  reference: 'อ้างอิง',
  customer: 'ลูกค้า',
  taxId: 'เลขประจำตัวผู้เสียภาษี',
  branch: 'สาขา',
  address: 'ที่อยู่',
  phone: 'โทร',
  email: 'อีเมล',
  draftNumber: 'ฉบับร่าง',
  headOffice: 'สำนักงานใหญ่',
  col: {
    no: '#',
    description: 'รายการ',
    qty: 'จำนวน',
    unit: 'หน่วย',
    unitPrice: 'ราคา/หน่วย',
    discount: 'ส่วนลด',
    amount: 'จำนวนเงิน',
  },
  totals: {
    lines: 'รวมเป็นเงิน',
    discount: 'ส่วนลด',
    beforeVat: 'ราคาก่อนภาษีมูลค่าเพิ่ม',
    vat: 'ภาษีมูลค่าเพิ่ม',
    total: 'จำนวนเงินรวมทั้งสิ้น',
    wht: 'หักภาษี ณ ที่จ่าย',
    net: 'ยอดชำระสุทธิ',
  },
};

const issuer = {
  legalName: 'บริษัท คอร์อัพ จำกัด',
  taxId: '0105555000123',
  branchCode: '00000',
  branchName: null,
  address: '1 ถนนทดสอบ กรุงเทพ',
  phone: '021234567',
  email: 'hello@coreup.biz',
};

const doc = (over: Partial<AccDocument> = {}): AccDocument =>
  ({
    id: '019a0000-0000-7000-8000-000000000001',
    type: 'invoice',
    number: 'IV-256910-0001',
    status: 'issued',
    docDate: '2026-10-15',
    dueDate: '2026-11-14',
    contact: { name: 'ลูกค้า จำกัด', taxId: '0105555999999', branchCode: '00000', address: '9 ถนนลูกค้า' },
    reference: 'PO-77',
    vatMode: 'exclusive',
    vatRateBp: 700,
    whtBp: 300,
    linesTotalMinor: 100_050,
    discountMinor: 50,
    taxableMinor: 100_000,
    exemptMinor: 0,
    vatMinor: 7_000,
    totalMinor: 107_000,
    whtMinor: 3_000,
    netMinor: 104_000,
    note: 'ขอบคุณครับ',
    lines: [
      {
        id: 'l1',
        position: 1,
        itemId: null,
        description: 'ค่าที่ปรึกษา',
        qty: 2.5,
        unit: 'ชม.',
        unitPriceMinor: 40_020,
        discountMinor: 0,
        vatType: 'vat',
        amountMinor: 100_050,
      },
    ],
    payments: [],
    related: [],
    ...over,
  }) as AccDocument;

/** Rows as plain values, money converted back to what the reader of the sheet sees (satang kept in the model). */
const labelRows = (rows: DocSheet['rows']) => rows.map((r) => r.map((c) => c.v));

/** jsdom's Blob has no arrayBuffer(). */
const readBlob = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

describe('buildDocumentSheet', () => {
  it('lays out header block, facts, lines and totals with WHT and VAT in satang', () => {
    const s = buildDocumentSheet(doc(), issuer, L);
    const rows = labelRows(s.rows);
    expect(rows[0]?.[0]).toBe('บริษัท คอร์อัพ จำกัด');
    expect(rows.flat()).toContain('IV-256910-0001');
    expect(rows.flat()).toContain('PO-77');
    expect(rows.flat()).toContain('0105555999999 · สำนักงานใหญ่');

    const headRow = rows.findIndex((r) => r[0] === '#');
    expect(rows[headRow]).toEqual(['#', 'รายการ', 'จำนวน', 'หน่วย', 'ราคา/หน่วย', 'ส่วนลด', 'จำนวนเงิน']);
    expect(rows[headRow + 1]).toEqual([1, 'ค่าที่ปรึกษา', 2.5, 'ชม.', 40_020, null, 100_050]);

    const label = (text: string) => rows.find((r) => r[4] === text);
    expect(label('รวมเป็นเงิน')?.[6]).toBe(100_050);
    expect(label('ส่วนลด')?.[6]).toBe(-50);
    expect(label('ราคาก่อนภาษีมูลค่าเพิ่ม')?.[6]).toBe(100_000);
    expect(label('ภาษีมูลค่าเพิ่ม 7%')?.[6]).toBe(7_000);
    expect(label('จำนวนเงินรวมทั้งสิ้น')?.[6]).toBe(107_000);
    expect(label('หักภาษี ณ ที่จ่าย 3%')?.[6]).toBe(-3_000);
    expect(label('ยอดชำระสุทธิ')?.[6]).toBe(104_000);
    expect(rows.flat()).toContain('ขอบคุณครับ');
  });

  it('leaves out VAT, WHT, discount and the due date when the document has none; a draft has no number', () => {
    const s = buildDocumentSheet(
      doc({
        type: 'receipt',
        number: null,
        status: 'draft',
        vatMode: 'none',
        whtBp: 0,
        whtMinor: 0,
        discountMinor: 0,
        vatMinor: 0,
        netMinor: 107_000,
        note: null,
      }),
      issuer,
      L,
    );
    const rows = labelRows(s.rows);
    const labels = rows.map((r) => r[4]);
    expect(labels).not.toContain('ภาษีมูลค่าเพิ่ม 7%');
    expect(labels).not.toContain('ยอดชำระสุทธิ');
    expect(labels).not.toContain('ส่วนลด');
    expect(rows.flat()).not.toContain('ครบกำหนด');
    expect(rows.flat()).toContain('ฉบับร่าง');
  });

  it('writes a real workbook: baht numbers with 2-decimal format that Excel can add up', async () => {
    const blob = await buildDocumentWorkbookBlob(buildDocumentSheet(doc(), issuer, L));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await readBlob(blob));
    const ws = wb.worksheets[0];
    expect(ws?.name).toBe('IV-256910-0001');
    let totalCell: ExcelJS.Cell | undefined;
    ws?.eachRow((row) => {
      if (row.getCell(5).value === 'จำนวนเงินรวมทั้งสิ้น') totalCell = row.getCell(7);
    });
    expect(totalCell?.value).toBe(1070);
    expect(totalCell?.numFmt).toBe('#,##0.00');
  });
});
