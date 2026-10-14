import { describe, expect, it } from 'vitest';
import { allocateProRata, calcTotals, lineAmount, lineGross } from '@/features/accounting/lib/calc';
import { isValidNumberFormat, previewDocNumber } from '@/features/accounting/lib/doc-number';
import {
  type EditorState,
  emptyLine,
  parseQty,
  toBody,
  validateEditor,
} from '@/features/accounting/lib/editor';
import {
  daysBetween,
  formatAmount,
  formatBp,
  formatMonthKey,
  monthBounds,
  percentChange,
  presetRange,
  sumMinor,
} from '@/features/accounting/lib/format';
import { minorToBahtText, parseBahtToMinor } from '@/features/accounting/lib/money';
import { isValidThaiTaxId } from '@/features/accounting/lib/tax-id';
import { buildMonthGrid, shiftMonth, yearLabel } from '@/features/accounting/lib/thai-calendar';
import { buildSheetRows, safeSheetName } from '@/features/accounting/lib/xlsx';

const line = (
  over: Partial<Parameters<typeof lineAmount>[0]> & { vatType?: 'vat' | 'none' | 'exempt' } = {},
) => ({
  qty: 1,
  unitPriceMinor: 100_000,
  discountMinor: 0,
  vatType: 'vat' as const,
  ...over,
});

describe('calcTotals (live preview mirrors the API)', () => {
  it('exclusive: VAT 7% added on top, WHT 3% on the pre-VAT base', () => {
    const t = calcTotals({
      lines: [line({ unitPriceMinor: 100_000 })],
      discountMinor: 0,
      vatMode: 'exclusive',
      vatRateBp: 700,
      whtBp: 300,
    });
    expect(t.taxableMinor).toBe(100_000);
    expect(t.vatMinor).toBe(7_000);
    expect(t.totalMinor).toBe(107_000);
    expect(t.whtMinor).toBe(3_000);
    expect(t.netMinor).toBe(104_000);
  });

  it('inclusive: VAT is carved out of the price once on the document', () => {
    const t = calcTotals({
      lines: [line({ unitPriceMinor: 107_000 })],
      discountMinor: 0,
      vatMode: 'inclusive',
      vatRateBp: 700,
      whtBp: 0,
    });
    expect(t.vatMinor).toBe(7_000);
    expect(t.taxableMinor).toBe(100_000);
    expect(t.totalMinor).toBe(107_000);
  });

  it('none: no VAT even for vat lines; exempt lines never carry VAT', () => {
    const none = calcTotals({
      lines: [line()],
      discountMinor: 0,
      vatMode: 'none',
      vatRateBp: 700,
      whtBp: 0,
    });
    expect(none.vatMinor).toBe(0);
    expect(none.totalMinor).toBe(100_000);
    const mixed = calcTotals({
      lines: [line(), line({ vatType: 'exempt' })],
      discountMinor: 0,
      vatMode: 'exclusive',
      vatRateBp: 700,
      whtBp: 0,
    });
    expect(mixed.vatMinor).toBe(7_000);
    expect(mixed.exemptMinor).toBe(100_000);
    expect(mixed.totalMinor).toBe(207_000);
  });

  it('rounds half away from zero and keeps the document discount exact across lines', () => {
    // 0.5 × 2.01 baht = 100.5 satang → 101 (half away from zero)
    expect(lineGross(0.5, 201)).toBe(101);
    expect(lineAmount({ qty: 1, unitPriceMinor: 1000, discountMinor: 5000 })).toBe(0);
    const shares = allocateProRata(100, [333, 333, 334]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    const t = calcTotals({
      lines: [
        line({ unitPriceMinor: 33_300 }),
        line({ unitPriceMinor: 33_300 }),
        line({ unitPriceMinor: 33_400 }),
      ],
      discountMinor: 100,
      vatMode: 'exclusive',
      vatRateBp: 700,
      whtBp: 0,
    });
    expect(t.linesTotalMinor).toBe(100_000);
    expect(t.taxableMinor).toBe(99_900);
    expect(t.vatMinor).toBe(6_993);
  });

  it('caps the discount at the lines total', () => {
    const t = calcTotals({
      lines: [line({ unitPriceMinor: 5_000 })],
      discountMinor: 999_999,
      vatMode: 'exclusive',
      vatRateBp: 700,
      whtBp: 500,
    });
    expect(t.discountMinor).toBe(5_000);
    expect(t.totalMinor).toBe(0);
    expect(t.whtMinor).toBe(0);
  });
});

describe('display helpers', () => {
  it('formats satang with two decimals and parses typed baht', () => {
    expect(formatAmount(123_450, 'en-US')).toBe('1,234.50');
    expect(formatAmount(0, 'en-US')).toBe('0.00');
    expect(parseBahtToMinor('1,250.5')).toBe(125_050);
    expect(parseBahtToMinor('฿ 90')).toBe(9_000);
    expect(parseBahtToMinor('12.345')).toBeNull();
    expect(parseBahtToMinor('-5')).toBeNull();
    expect(minorToBahtText(125_050)).toBe('1250.50');
    expect(minorToBahtText(9_000)).toBe('90');
  });

  it('sums money as integers and reports changes against a baseline', () => {
    expect(sumMinor([{ a: 10 }, { a: 20 }, { a: 5 }], (r) => r.a)).toBe(35);
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(10, 0)).toBeNull();
    expect(formatBp(700)).toBe('7%');
    expect(formatBp(250)).toBe('2.5%');
  });

  it('builds quick date ranges around month ends and year boundaries', () => {
    expect(monthBounds('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(presetRange('lastMonth', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(presetRange('thisYear', '2026-10-15')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(presetRange('last12', '2026-10-15')).toEqual({ from: '2025-11-01', to: '2026-10-31' });
    expect(daysBetween('2026-10-01', '2026-10-31')).toBe(30);
    expect(formatMonthKey('2026-10', 'en-GB')).toContain('2026');
  });
});

describe('Excel row building', () => {
  type Row = { name: string; base: number; vat: number; rate: number | null };
  const rows: Row[] = [
    { name: 'A', base: 100_000, vat: 7_000, rate: 700 },
    { name: 'B', base: 50_050, vat: 3_504, rate: null },
  ];
  const cols = [
    { header: 'Name', value: (r: Row) => r.name },
    { header: 'Base', kind: 'money' as const, value: (r: Row) => r.base, total: true },
    { header: 'VAT', kind: 'money' as const, value: (r: Row) => r.vat, total: true },
    { header: 'Rate', kind: 'percent' as const, value: (r: Row) => r.rate },
  ];

  it('converts satang to baht numbers and sums the totals row in satang first', () => {
    const { header, body, totals } = buildSheetRows(cols, rows, 'Total');
    expect(header).toEqual(['Name', 'Base', 'VAT', 'Rate']);
    expect(body).toEqual([
      ['A', 1000, 70, 0.07],
      ['B', 500.5, 35.04, null],
    ]);
    expect(totals).toEqual(['Total', 1500.5, 105.04, null]);
  });

  it('has no totals row when no column is summed, and sanitises sheet names', () => {
    expect(buildSheetRows([cols[0] as (typeof cols)[number]], rows).totals).toBeNull();
    expect(safeSheetName('P&L: 2026/Q1 [draft]?')).toBe('P&L  2026 Q1  draft');
    expect(safeSheetName('x'.repeat(50))).toHaveLength(31);
  });
});

describe('document numbering preview and tax id', () => {
  it('renders the default format with Buddhist year and month', () => {
    expect(
      previewDocNumber({
        format: '{PREFIX}-{BE}{MM}-{SEQ}',
        prefix: 'QT',
        seqDigits: 4,
        year: 2026,
        month: 10,
      }),
    ).toBe('QT-256910-0001');
    expect(
      previewDocNumber({
        format: '{PREFIX}/{YY}{MM}/{SEQ}',
        prefix: 'IV',
        seqDigits: 3,
        year: 2026,
        month: 3,
        seq: 12,
      }),
    ).toBe('IV/2603/012');
  });

  it('accepts only formats the API accepts', () => {
    expect(isValidNumberFormat('{PREFIX}-{BE}{MM}-{SEQ}')).toBe(true);
    expect(isValidNumberFormat('{PREFIX}-{SEQ}')).toBe(false);
    expect(isValidNumberFormat('{PREFIX}-{BE}{MM}-{SEQ}-{FOO}')).toBe(false);
  });

  it('checks the 13-digit tax id check digit', () => {
    expect(isValidThaiTaxId('0105536012346')).toBe(true);
    expect(isValidThaiTaxId('0105536012347')).toBe(false);
    expect(isValidThaiTaxId('12345')).toBe(false);
  });
});

describe('editor state → API body', () => {
  const base: EditorState = {
    contactId: 'c1',
    contactName: 'ACME',
    docDate: '2026-10-15',
    dueDate: '2026-11-14',
    reference: '',
    vatMode: 'none',
    whtBp: 300,
    discountMinor: null,
    lines: [
      { ...emptyLine('none'), description: ' Consulting ', qty: '1,5', unitPriceMinor: 100_000 },
      emptyLine('none'),
    ],
    note: '',
    internalNote: '',
    refDocumentId: null,
  };

  it('drops blank spare rows, trims text and converts typed values', () => {
    const body = toBody(base, 'invoice');
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]).toMatchObject({
      description: 'Consulting',
      qty: 1.5,
      unitPriceMinor: 100_000,
      discountMinor: 0,
    });
    expect(body).toMatchObject({
      type: 'invoice',
      whtBp: 300,
      dueDate: '2026-11-14',
      discountMinor: 0,
      issue: false,
    });
  });

  it('flags a missing customer, empty lines, bad quantity and a due date before the document date', () => {
    expect(validateEditor({ ...base, contactId: null }).contact).toBe(true);
    expect(validateEditor({ ...base, lines: [emptyLine()] }).lines).toBe(true);
    expect(
      validateEditor({
        ...base,
        lines: [{ ...emptyLine('none'), description: 'x', unitPriceMinor: 100, qty: '0' }],
      }).qty,
    ).toBe(true);
    expect(validateEditor({ ...base, dueDate: '2026-10-01' }).dueDate).toBe(true);
    expect(validateEditor(base)).toEqual({});
    expect(parseQty('0.0005')).toBeNull();
  });
});

describe('date picker calendar helpers', () => {
  it('lays out a month starting on Sunday with leading blanks', () => {
    const grid = buildMonthGrid('2026-10'); // 1 Oct 2026 is a Thursday
    expect(grid.slice(0, 4)).toEqual([null, null, null, null]);
    expect(grid[4]).toEqual({ ymd: '2026-10-01', day: 1 });
    expect(grid.at(-1)).toEqual({ ymd: '2026-10-31', day: 31 });
    expect(buildMonthGrid('2028-02').filter(Boolean)).toHaveLength(29);
  });

  it('steps months across year boundaries and labels Buddhist years for Thai', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(yearLabel(2026, 'th-TH')).toBe('2569');
    expect(yearLabel(2026, 'en-GB')).toBe('2026');
  });
});
