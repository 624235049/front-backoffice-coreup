import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AccDocument } from '@/features/accounting/api';
import { QuoteLinkCard } from '@/features/accounting/components/quote-link-card';
import accounting from '@/locales/th/accounting.json';

const mocks = vi.hoisted(() => ({ create: vi.fn(), revoke: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/features/accounting/api', async (orig) => ({
  ...(await orig<typeof import('@/features/accounting/api')>()),
  useCreateQuoteLink: () => ({ mutate: mocks.create, isPending: false }),
  useRevokeQuoteLink: () => ({ mutate: mocks.revoke, isPending: false }),
}));

const i18n = i18next.createInstance();
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'th',
    resources: { th: { accounting } },
    defaultNS: 'accounting',
    interpolation: { escapeValue: false },
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const doc = (over: Partial<AccDocument>): AccDocument =>
  ({
    id: 'd1',
    number: 'QT-202611-0001',
    project: 'HOKA',
    totalMinor: 1_690_000,
    dueDate: '2026-11-30',
    shareUrl: null,
    viewedAt: null,
    acceptedAt: null,
    acceptedName: null,
    ...over,
  }) as AccDocument;
const show = (d: AccDocument) =>
  render(
    <I18nextProvider i18n={i18n}>
      <QuoteLinkCard doc={d} />
    </I18nextProvider>,
  );

describe('QuoteLinkCard', () => {
  it('no link yet: one button issues it', () => {
    show(doc({}));
    fireEvent.click(screen.getByText('ออกลิงก์ใบเสนอราคา'));
    expect(mocks.create).toHaveBeenCalledWith('d1');
  });

  it('a link: URL with copy / open / LINE share, and the chips say opened and accepted by whom', () => {
    show(
      doc({
        shareUrl: 'https://coreup.biz/q/tok123',
        viewedAt: '2026-11-16T05:00:00Z',
        acceptedAt: '2026-11-16T07:05:00Z',
        acceptedName: 'สมชาย ใจดี',
      }),
    );
    expect((screen.getByLabelText('ลิงก์ใบเสนอราคา') as HTMLInputElement).value).toBe(
      'https://coreup.biz/q/tok123',
    );
    expect(screen.getByText('เปิด').closest('a')?.getAttribute('href')).toBe('https://coreup.biz/q/tok123');
    const share = screen.getByText('ส่งทาง LINE').closest('a')?.getAttribute('href') ?? '';
    expect(share.startsWith('https://line.me/R/share?text=')).toBe(true);
    expect(decodeURIComponent(share)).toContain('https://coreup.biz/q/tok123');
    const chips = screen.getByTestId('quote-link-chips').textContent ?? '';
    expect(chips).toContain('เปิดดูแล้ว');
    expect(chips).toContain('ลูกค้ายอมรับแล้ว');
    expect(chips).toContain('สมชาย ใจดี');
  });
});
