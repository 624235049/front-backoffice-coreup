/** Parse a baht amount typed by a person ("1,250.50", "฿ 90") into integer satang; null when invalid or negative. */
export function parseBahtToMinor(input: string): number | null {
  const cleaned = input.replace(/[,\s฿]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole = '0', frac = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

/** Integer satang → plain editable baht text ("1250.50"; whole baht without decimals). */
export function minorToBahtText(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return frac === 0 ? `${sign}${whole}` : `${sign}${whole}.${String(frac).padStart(2, '0')}`;
}
