/**
 * PromptPay helpers mirroring `packages/domain/src/checkout` in the API (same rules, so what passes here passes the
 * API). Only used to validate an account id and to draw a sample QR in the settings preview.
 */

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) as 4 uppercase hex chars. */
export function crc16Ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Thai national/tax id check digit: Σ d[i]·(13−i) for the first 12 digits, then (11 − Σ mod 11) mod 10. */
export function isValidThaiNationalId(digits: string): boolean {
  if (!/^\d{13}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(digits[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(digits[12]);
}

/** A Thai mobile (10 digits, 0[6-9]…) or a 13-digit tax/national id with a valid check digit. Spaces/dashes ignored. */
export function isValidPromptPayAccount(raw: string): boolean {
  const compact = raw.replace(/[\s-]/g, '');
  return /^0[6-9]\d{8}$/.test(compact) || isValidThaiNationalId(compact);
}

const tlv = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, '0')}${value}`;

/** EMVCo / Thai QR payload with an amount (satang) for an id that passed {@link isValidPromptPayAccount}. */
export function buildPromptPayPayload(promptPayId: string, amountMinor: number): string {
  const digits = promptPayId.replace(/\D/g, '');
  const isPhone = digits.length === 10;
  const target = isPhone ? `0066${digits.slice(1)}` : digits;
  const merchant = tlv('00', 'A000000677010111') + tlv(isPhone ? '01' : '02', target);
  const body = `${tlv('00', '01')}${tlv('01', '12')}${tlv('29', merchant)}${tlv('53', '764')}${tlv('54', (amountMinor / 100).toFixed(2))}${tlv('58', 'TH')}6304`;
  return body + crc16Ccitt(body);
}
