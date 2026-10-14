/**
 * Live preview of document totals in the editor. This mirrors the API's `calcTotals` (the server is the source of
 * truth and returns the saved totals); all money is integer satang and all rounding is half away from zero.
 *
 * Rules (docs/02 §6.10):
 *  - line amount = round(unitPrice × qty) − line discount (VAT-inclusive when the document is `inclusive`)
 *  - document discount is shared pro-rata over the lines by amount (largest remainder, so shares sum exactly)
 *  - exclusive: VAT is computed once on the taxable sum; inclusive: VAT = S × rate / (10000 + rate) once
 *  - withholding base = taxable + exempt (pre-VAT, after discount); net = total − withholding
 */

export type VatType = 'vat' | 'none' | 'exempt';
export type VatMode = 'exclusive' | 'inclusive' | 'none';

export type CalcLine = {
  qty: number;
  unitPriceMinor: number;
  discountMinor: number;
  vatType: VatType;
};

export type CalcTotals = {
  linesTotalMinor: number;
  discountMinor: number;
  taxableMinor: number;
  exemptMinor: number;
  vatMinor: number;
  totalMinor: number;
  whtMinor: number;
  netMinor: number;
};

/** round_half_away(n / d) for n ≥ 0, d > 0 using BigInt so large amounts never lose precision. */
function divRound(n: bigint, d: bigint): number {
  return Number((n * 2n + d) / (2n * d));
}

/** Quantity in thousandths (the server stores milli-units). */
export const qtyToMilli = (qty: number): number => Math.round(qty * 1000);

/** round(unitPrice × qty) in satang, before the line discount. */
export function lineGross(qty: number, unitPriceMinor: number): number {
  const q = qtyToMilli(qty);
  if (q <= 0 || unitPriceMinor <= 0) return 0;
  return divRound(BigInt(unitPriceMinor) * BigInt(q), 1000n);
}

/** Line amount after the line discount; the discount is capped at the gross (never negative). */
export function lineAmount(line: Pick<CalcLine, 'qty' | 'unitPriceMinor' | 'discountMinor'>): number {
  const gross = lineGross(line.qty, line.unitPriceMinor);
  return gross - Math.min(Math.max(line.discountMinor, 0), gross);
}

/** Split `discount` over `weights` pro-rata; shares always sum to `discount` (largest remainder, first wins ties). */
export function allocateProRata(discount: number, weights: readonly number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (discount <= 0 || total <= 0) return weights.map(() => 0);
  const d = BigInt(discount);
  const t = BigInt(total);
  const shares = weights.map((w) => (d * BigInt(w)) / t);
  const rems = weights.map((w, i) => ({ i, rem: (d * BigInt(w)) % t }));
  let left = Number(d - shares.reduce((a, b) => a + b, 0n));
  rems.sort((a, b) => (a.rem === b.rem ? a.i - b.i : a.rem > b.rem ? -1 : 1));
  const out = shares.map(Number);
  for (const r of rems) {
    if (left <= 0) break;
    out[r.i] = (out[r.i] ?? 0) + 1;
    left--;
  }
  return out;
}

export function calcTotals(input: {
  lines: readonly CalcLine[];
  discountMinor: number;
  vatMode: VatMode;
  vatRateBp: number;
  whtBp: number;
}): CalcTotals {
  const amounts = input.lines.map(lineAmount);
  const linesTotal = amounts.reduce((a, b) => a + b, 0);
  const discount = Math.min(Math.max(input.discountMinor, 0), linesTotal);
  const shares = allocateProRata(discount, amounts);
  let vatSum = 0;
  let otherSum = 0;
  input.lines.forEach((l, i) => {
    const a = (amounts[i] ?? 0) - (shares[i] ?? 0);
    if (input.vatMode !== 'none' && l.vatType === 'vat') vatSum += a;
    else otherSum += a;
  });

  let taxable = 0;
  let vat = 0;
  if (input.vatMode === 'exclusive') {
    taxable = vatSum;
    vat = divRound(BigInt(taxable) * BigInt(input.vatRateBp), 10000n);
  } else if (input.vatMode === 'inclusive') {
    vat = divRound(BigInt(vatSum) * BigInt(input.vatRateBp), BigInt(10000 + input.vatRateBp));
    taxable = vatSum - vat;
  }
  const exempt = otherSum;
  const total = taxable + exempt + vat;
  const wht = divRound(BigInt(taxable + exempt) * BigInt(input.whtBp), 10000n);
  return {
    linesTotalMinor: linesTotal,
    discountMinor: discount,
    taxableMinor: taxable,
    exemptMinor: exempt,
    vatMinor: vat,
    totalMinor: total,
    whtMinor: wht,
    netMinor: total - wht,
  };
}
