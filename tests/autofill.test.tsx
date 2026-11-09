import { cleanup, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PasswordInput } from '@/components/password-input';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SignInPage } from '@/features/auth/pages/sign-in-page';
import auth from '@/locales/th/auth.json';
import common from '@/locales/th/common.json';

const idle = { mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, isSuccess: false };
vi.mock('@tanstack/react-router', () => ({
  useSearch: () => ({}),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));
vi.mock('@/features/auth/api', () => ({
  useAfterSignIn: () => vi.fn(),
  useSignIn: () => idle,
  useRequestMagicLink: () => idle,
}));
vi.mock('@/features/security/components/two-factor-challenge', () => ({ TwoFactorChallenge: () => null }));
vi.mock('@/lib/query', () => ({ useErrorMessage: () => () => 'error' }));

const i18n = i18next.createInstance();
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'th',
    resources: { th: { auth, common } },
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  });
});
afterEach(cleanup);

const wrap = (ui: React.ReactNode) => <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>;

describe('Input autofill defaults', () => {
  it('never autofills by default (Chrome ignores "off", so one-time-code) and keeps a token a caller passes', () => {
    render(
      <>
        <Input aria-label="plain" />
        <Input aria-label="off" autoComplete="off" />
        <Input aria-label="email" autoComplete="email" />
        <Input aria-label="pin" type="password" />
        <Textarea aria-label="note" />
      </>,
    );
    for (const l of ['plain', 'off', 'note']) {
      expect(screen.getByLabelText(l).getAttribute('autocomplete')).toBe('one-time-code');
      expect(screen.getByLabelText(l).getAttribute('data-1p-ignore')).toBe('true');
      expect(screen.getByLabelText(l).getAttribute('data-lpignore')).toBe('true');
    }
    expect(screen.getByLabelText('pin').getAttribute('autocomplete')).toBe('new-password');
    expect(screen.getByLabelText('email').getAttribute('autocomplete')).toBe('email');
    expect(screen.getByLabelText('email').hasAttribute('data-1p-ignore')).toBe(false);
  });

  it('PasswordInput is new-password and hidden from password managers unless a page passes its own token', () => {
    render(
      wrap(
        <>
          <PasswordInput aria-label="a" />
          <PasswordInput aria-label="b" autoComplete="current-password" />
        </>,
      ),
    );
    expect(screen.getByLabelText('a').getAttribute('autocomplete')).toBe('new-password');
    expect(screen.getByLabelText('a').getAttribute('data-1p-ignore')).toBe('true');
    expect(screen.getByLabelText('b').getAttribute('autocomplete')).toBe('current-password');
    expect(screen.getByLabelText('b').hasAttribute('data-1p-ignore')).toBe(false);
  });
});

describe('sign-in page', () => {
  it('keeps login autofill (username + current-password)', () => {
    const { container } = render(wrap(<SignInPage />));
    expect(container.querySelector('input[type="email"]')?.getAttribute('autocomplete')).toBe('username');
    expect(container.querySelector('input[type="password"]')?.getAttribute('autocomplete')).toBe(
      'current-password',
    );
  });
});
