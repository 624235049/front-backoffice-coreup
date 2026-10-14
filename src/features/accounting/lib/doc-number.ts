/** Tokens the API accepts in a document number format (same rule as the server's `isValidNumberFormat`). */
export function isValidNumberFormat(format: string): boolean {
  if (format.length > 40) return false;
  const stripped = format.replace(/\{(PREFIX|BE|CE|YY|MM|SEQ)\}/g, '');
  if (/[{}]/.test(stripped)) return false;
  if (!/^[A-Za-z0-9\-_/.\s]*$/.test(stripped)) return false;
  if (!format.includes('{SEQ}') || !format.includes('{MM}')) return false;
  return format.includes('{BE}') || format.includes('{CE}') || format.includes('{YY}');
}

/** Example number for the settings screen: "QT-256910-0001" for the default format, prefix QT, October 2026. */
export function previewDocNumber(opts: {
  format: string;
  prefix: string;
  seqDigits: number;
  year: number;
  month: number;
  seq?: number;
}): string {
  const mm = String(opts.month).padStart(2, '0');
  return opts.format
    .replaceAll('{PREFIX}', opts.prefix)
    .replaceAll('{BE}', String(opts.year + 543))
    .replaceAll('{CE}', String(opts.year))
    .replaceAll('{YY}', String(opts.year % 100).padStart(2, '0'))
    .replaceAll('{MM}', mm)
    .replaceAll('{SEQ}', String(opts.seq ?? 1).padStart(opts.seqDigits, '0'));
}
