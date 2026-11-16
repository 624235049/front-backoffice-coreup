import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { OutboundEmail } from '@/features/mail/api';
import { parseEmails } from '@/features/mail/lib';
import { OutboxPage } from '@/features/mail/pages/outbox-page';
import mail from '@/locales/th/mail.json';

const h = vi.hoisted(() => ({
  rows: [] as unknown[],
  roles: ['platform_sales'] as string[],
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock('@/lib/membership', () => ({ useMembership: () => ({ roles: h.roles, permissions: [] }) }));
vi.mock('@/features/mail/components/mail-composer', () => ({
  MailComposer: ({ kind }: { kind: string }) => <div data-testid="composer">{kind}</div>,
}));
vi.mock('@/features/mail/api', async () => ({
  useOutbox: () => ({
    isPending: false,
    isError: false,
    hasNextPage: false,
    data: { pages: [{ data: h.rows }] },
  }),
  useOutboxItem: () => ({ isPending: true, isError: false }),
}));

const i18n = i18next.createInstance();
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'th',
    resources: { th: { mail } },
    defaultNS: 'mail',
    interpolation: { escapeValue: false },
  });
});
afterEach(cleanup);

const row = (over: Partial<OutboundEmail>): OutboundEmail => ({
  id: 'm1',
  kind: 'quotation',
  isTest: false,
  documentId: 'd1',
  documentNumber: 'QT-000000-0001',
  from: 'x',
  to: ['customer@example.test'],
  cc: [],
  bcc: [],
  subject: 'ใบเสนอราคา QT-000000-0001',
  attachments: [{ name: 'a.pdf', size: 1 }],
  status: 'bounced',
  error: null,
  sentBy: { id: 'u1', name: 'Owner' },
  resendId: 'r',
  createdAt: '2026-11-16T05:29:00.000Z',
  sentAt: '2026-11-16T05:30:00.000Z',
  deliveredAt: null,
  openedAt: null,
  failedAt: null,
  ...over,
});
const show = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <OutboxPage />
    </I18nextProvider>,
  );

describe('parseEmails', () => {
  it('splits on comma / semicolon / space, lower-cases, drops duplicates, separates the invalid', () => {
    expect(parseEmails('A@x.com, b@y.com; a@x.com  nope c@z')).toEqual({
      valid: ['a@x.com', 'b@y.com'],
      invalid: ['nope', 'c@z'],
    });
    expect(parseEmails('')).toEqual({ valid: [], invalid: [] });
  });
});

describe('OutboxPage', () => {
  it('empty state explains the page', () => {
    h.rows = [];
    show();
    expect(screen.getByText(mail.page.empty)).toBeTruthy();
  });

  it('lists the sent emails with status, document link and sender; sales can write a new email, not open the settings', () => {
    h.rows = [
      row({}),
      row({
        id: 'm2',
        kind: 'free',
        documentId: null,
        documentNumber: null,
        isTest: true,
        status: 'delivered',
        to: ['me@x.com'],
      }),
    ];
    show();
    const rows = screen.getAllByTestId('outbox-row').map((r) => r.textContent ?? '');
    expect(rows[0]).toContain('customer@example.test');
    expect(rows[0]).toContain('QT-000000-0001');
    expect(rows[0]).toContain('ตีกลับ');
    expect(rows[1]).toContain('อีเมลทั่วไป');
    expect(rows[1]).toContain('ตัวอย่าง');
    expect(screen.queryByText(mail.page.settings)).toBeNull();
    fireEvent.click(screen.getByTestId('mail-new'));
    expect(screen.getByTestId('composer').textContent).toBe('free');
  });

  it('the owner sees the settings link', () => {
    h.roles = ['platform_owner'];
    h.rows = [];
    show();
    expect(screen.getByText(mail.page.settings).closest('a')?.getAttribute('href')).toBe('/mail/settings');
    h.roles = ['platform_sales'];
  });
});
