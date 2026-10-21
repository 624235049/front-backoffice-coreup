import { type CountryCode, type PhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js/mobile';

/**
 * Owner / CoreUp-contact mobile as E.164 (`+66812345678`) for any country, or null. Same rules as the API
 * (`normalizeMobileE164` in @coreup/domain): `+<country><number>`, `00…`, or legacy Thai local `0XXXXXXXXX` read as +66;
 * validated per country with libphonenumber; numbers it can tell are not mobiles (landline…) are refused.
 */
export function normalizeMobileE164(raw: string): string | null {
  const p = parseMobile(raw);
  if (!p?.isValid()) return null;
  const type = p.getType();
  if (type !== undefined && type !== 'MOBILE' && type !== 'FIXED_LINE_OR_MOBILE') return null;
  return p.number;
}

export function parseMobile(raw: string, country: CountryCode = 'TH'): PhoneNumber | undefined {
  const s = raw.trim().replace(/[\s\-().]/g, '');
  if (!s) return undefined;
  if (s.startsWith('+')) return parsePhoneNumberFromString(s);
  if (s.startsWith('00')) return parsePhoneNumberFromString(`+${s.slice(2)}`);
  const local = parsePhoneNumberFromString(s, country);
  if (local?.isValid()) return local;
  return s.startsWith('66') ? parsePhoneNumberFromString(`+${s}`) : local;
}
