import { useTranslation } from 'react-i18next';
import { isApiError } from '@/lib/api';
import { useErrorMessage } from '@/lib/query';

/** `details.reason` (business-rule failures) or `details.missing` (demo data prerequisites), as an errors.json key. */
function reasonKeyOf(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null;
  if ('reason' in details && typeof details.reason === 'string') return `reason.${details.reason}`;
  if ('missing' in details && typeof details.missing === 'string') return `missing.${details.missing}`;
  return null;
}

/** Failing field names of a zod issue list (`details` = `[{ path: [..., 'taxId'], message }]`). */
function failingFields(details: unknown): string[] {
  if (!Array.isArray(details)) return [];
  const fields: string[] = [];
  for (const issue of details) {
    if (typeof issue !== 'object' || issue === null || !('path' in issue) || !Array.isArray(issue.path))
      continue;
    const last = issue.path.at(-1);
    if (typeof last === 'string') fields.push(last);
  }
  return fields;
}

/**
 * The API answers many business-rule failures with a generic code (VALIDATION_FAILED / CONFLICT / RECORD_LOCKED)
 * and the real cause in `details.reason`, or a zod issue list in `details`. The generic message ("ข้อมูลไม่ถูกต้อง")
 * does not tell staff what to fix, so map the reason / failing field to a specific Thai sentence
 * (`errors:reason.*`, `errors:field.*`) and fall back to the generic message.
 */
export function useReasonMessage() {
  const { t, i18n } = useTranslation('errors');
  const generic = useErrorMessage();
  return (e: unknown): string => {
    if (!isApiError(e)) return generic(e);
    const reasonKey = reasonKeyOf(e.details);
    if (reasonKey && i18n.exists(reasonKey, { ns: 'errors' })) return t(reasonKey);
    const field = failingFields(e.details).find((f) => i18n.exists(`field.${f}`, { ns: 'errors' }));
    if (field) return t(`field.${field}`);
    return generic(e);
  };
}
