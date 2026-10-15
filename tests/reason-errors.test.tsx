import { renderHook } from '@testing-library/react';
import i18next from 'i18next';
import type { ReactNode } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { useReasonMessage } from '@/features/reason-errors';
import { ApiError } from '@/lib/api';
import errors from '@/locales/th/errors.json';

const i18n = i18next.createInstance();
await i18n.use(initReactI18next).init({
  lng: 'th',
  fallbackLng: 'th',
  ns: ['errors'],
  defaultNS: 'errors',
  resources: { th: { errors } },
  interpolation: { escapeValue: false },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);
const message = () => renderHook(() => useReasonMessage(), { wrapper }).result.current;

const fail = (code: string, status: number, details?: unknown) =>
  new ApiError({ status, code, message: errors.VALIDATION_FAILED, details });

describe('useReasonMessage', () => {
  it('turns a business-rule reason into the specific sentence instead of the generic one', () => {
    const text = message()(fail('VALIDATION_FAILED', 400, { reason: 'total_must_be_positive' }));
    expect(text).toBe(errors.reason.total_must_be_positive);
    expect(text).not.toBe(errors.VALIDATION_FAILED);
  });

  it('names the failing field of a zod issue list (wrong tax id length)', () => {
    const issues = [{ path: ['taxId'], message: 'Invalid tax id (13 digits with valid checksum)' }];
    expect(message()(fail('VALIDATION_FAILED', 400, issues))).toBe(errors.field.taxId);
  });

  it('says which shop setup is missing for demo data', () => {
    const text = message()(fail('DEMO_PREREQUISITE_MISSING', 409, { missing: 'practitioner' }));
    expect(text).toBe(errors.missing.practitioner);
  });

  it('falls back to the generic message when the reason or field is unknown', () => {
    expect(message()(fail('VALIDATION_FAILED', 400, { reason: 'something_new' }))).toBe(
      errors.VALIDATION_FAILED,
    );
    expect(message()(fail('VALIDATION_FAILED', 400, [{ path: ['mystery'] }]))).toBe(errors.VALIDATION_FAILED);
  });
});
