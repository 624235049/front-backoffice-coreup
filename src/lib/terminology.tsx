import { useTranslation } from 'react-i18next';
import { useOptionalMembership } from '@/lib/membership';

/** docs/05 §2. Keep in sync with the API's terminology keys. */
export const TERM_KEYS = [
  'customer',
  'customers',
  'service',
  'appointment',
  'practitioner',
  'branch',
  'package',
  'followup',
  'resource',
] as const;
export type TermKey = (typeof TERM_KEYS)[number];

/**
 * Resolve a business word (docs/05 §2). `terminology` comes from /v1/me, already merged by the API
 * (tenant -> template -> generic); the neutral i18n default `terms:<key>` is the last resort.
 * NEVER hardcode business words ("คนไข้", "หัตถการ", ...) in UI code: use this or `<Term />`.
 */
export function resolveTerm(
  terminology: Readonly<Record<string, string>> | undefined,
  key: TermKey,
  fallback: (key: TermKey) => string,
): string {
  const v = terminology?.[key];
  return v && v.length > 0 ? v : fallback(key);
}

/** All terms as an i18next interpolation map: `t('confirmed', terms)` -> "ยืนยัน{{appointment}}แล้ว". */
export function resolveAllTerms(
  terminology: Readonly<Record<string, string>> | undefined,
  fallback: (key: TermKey) => string,
): Record<TermKey, string> {
  return Object.fromEntries(TERM_KEYS.map((k) => [k, resolveTerm(terminology, k, fallback)])) as Record<
    TermKey,
    string
  >;
}

/** `const customer = useTerm('customer')` */
export function useTerm(key: TermKey): string {
  const { t } = useTranslation('terms');
  return resolveTerm(useOptionalMembership()?.terminology, key, (k) => t(k));
}

/** `<Term k="appointment" />` */
export function Term({ k }: { k: TermKey }) {
  return <>{useTerm(k)}</>;
}

/**
 * Translation hook that always supplies the term variables, so any message may use
 * `{{customer}} {{customers}} {{service}} {{appointment}} {{practitioner}} {{branch}} {{package}} {{followup}} {{resource}}`.
 * Explicit options win over terms.
 */
export function useT(ns?: string | string[]) {
  const { t, i18n } = useTranslation(ns);
  const { t: tTerms } = useTranslation('terms');
  const terms = resolveAllTerms(useOptionalMembership()?.terminology, (k) => tTerms(k));
  const tt = (key: string, options?: Record<string, unknown>): string =>
    t(key, { ...terms, ...options } as never) as unknown as string;
  return { t: tt, i18n, terms };
}
