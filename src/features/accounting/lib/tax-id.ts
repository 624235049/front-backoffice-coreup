/** Thai 13-digit tax / national id with the official mod-11 check digit. */
export function isValidThaiTaxId(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(value[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(value[12]);
}

/** Empty is fine (optional field); otherwise must be a valid id. */
export const isOptionalTaxIdOk = (value: string): boolean =>
  value.trim() === '' || isValidThaiTaxId(value.trim());

export const isOptionalEmailOk = (value: string): boolean =>
  value.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
