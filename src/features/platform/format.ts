import { useTranslation } from 'react-i18next';

/** Satang → "฿1,234.50" (whole baht without decimals). Money is always integer satang (AGENTS rule 7). */
export function formatMoney(minor: number, locale = 'th-TH'): string {
  const baht = minor / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'THB',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: Number.isInteger(baht) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(baht);
}

const TZ = 'Asia/Bangkok';

export function formatDate(value: string | null | undefined, locale = 'th-TH'): string {
  if (!value) return '–';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+07:00`) : new Date(value);
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: TZ }).format(d);
}

export function formatDateTime(value: string | null | undefined, locale = 'th-TH'): string {
  if (!value) return '–';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ }).format(
    new Date(value),
  );
}

/** Locale tag for Intl following the UI language. */
export function useIntlLocale(): string {
  const { i18n } = useTranslation();
  return i18n.language === 'en' ? 'en-GB' : 'th-TH';
}

/** Parse a THB amount typed by a person ("1,250.50") into satang; null when invalid. */
export function parseBahtToMinor(input: string): number | null {
  const cleaned = input.replace(/[,\s฿]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number.parseFloat(cleaned) * 100);
}

export const todayBangkok = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

/** "Booking Basic · ฿299/เดือน" for plan dropdowns. */
export function usePlanLabel(): (p: {
  name: string;
  priceMinor: number;
  interval: 'month' | 'year';
}) => string {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  return (p) => `${p.name} · ${formatMoney(p.priceMinor, locale)}${t(`plans.per.${p.interval}`)}`;
}
