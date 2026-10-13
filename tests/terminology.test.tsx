import { render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import { MembershipProvider } from '@/lib/membership';
import { resolveAllTerms, resolveTerm, Term, useT, useTerm } from '@/lib/terminology';
import { membership } from './fixtures';

const defaults = { customer: 'default-customer', appointment: 'default-appointment' };
const fallback = (k: string) => (defaults as Record<string, string>)[k] ?? `default-${k}`;

describe('resolveTerm', () => {
  it('prefers the tenant word and falls back to the neutral default', () => {
    expect(resolveTerm({ customer: 'แขก' }, 'customer', fallback)).toBe('แขก');
    expect(resolveTerm({}, 'customer', fallback)).toBe('default-customer');
    expect(resolveTerm(undefined, 'service', fallback)).toBe('default-service');
  });

  it('ignores blank tenant words', () => {
    expect(resolveTerm({ customer: '' }, 'customer', fallback)).toBe('default-customer');
  });

  it('resolves every term key', () => {
    const all = resolveAllTerms({ appointment: 'คิว' }, fallback);
    expect(all.appointment).toBe('คิว');
    expect(Object.keys(all).sort()).toEqual([
      'appointment',
      'branch',
      'customer',
      'customers',
      'followup',
      'package',
      'practitioner',
      'resource',
      'service',
    ]);
  });
});

const i18n = i18next.createInstance();

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'th',
    resources: {
      th: {
        terms: { customer: 'ลูกค้า', appointment: 'นัดหมาย' },
        demo: { confirmed: 'ยืนยัน{{appointment}}ของ{{customer}}แล้ว', override: '{{customer}}/{{customer2}}' },
      },
    },
    interpolation: { escapeValue: false },
  });
});

function Probe() {
  const { t } = useT('demo');
  return (
    <>
      <span data-testid="hook">{useTerm('customer')}</span>
      <span data-testid="msg">{t('confirmed')}</span>
      <Term k="appointment" />
    </>
  );
}

describe('terminology hooks', () => {
  it('uses the tenant terminology for hook, <Term/> and message interpolation', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MembershipProvider value={membership({ terminology: { customer: 'คนไข้ทดสอบ', appointment: 'คิว' } })}>
          <Probe />
        </MembershipProvider>
      </I18nextProvider>,
    );
    expect(screen.getByTestId('hook').textContent).toBe('คนไข้ทดสอบ');
    expect(screen.getByTestId('msg').textContent).toBe('ยืนยันคิวของคนไข้ทดสอบแล้ว');
    expect(screen.getByText('คิว')).toBeTruthy();
  });

  it('falls back to the neutral i18n word outside a membership', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Probe />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('hook').textContent).toBe('ลูกค้า');
  });
});
