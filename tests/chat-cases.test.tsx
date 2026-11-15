import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatCasesPage } from '@/features/platform/pages/chat-cases-page';
import en from '../src/locales/en/chatCases.json';
import th from '../src/locales/th/chatCases.json';

const h = vi.hoisted(() => ({ patch: vi.fn(), filter: vi.fn(), rows: [] as unknown[], canWrite: true }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k),
    i18n: { language: 'th' },
  }),
}));
vi.mock('@tanstack/react-router', () => ({ useSearch: () => ({ case: 'c2' }) }));
vi.mock('@/lib/permissions', () => ({ useCan: () => h.canWrite }));
vi.mock('@/features/platform/chat-cases-api', () => ({
  useChatCases: (s: string | undefined) => {
    h.filter(s);
    return { isPending: false, isError: false, data: h.rows, hasNextPage: false };
  },
  usePatchChatCase: () => ({ mutate: h.patch, isPending: false }),
}));

const row = (over: Record<string, unknown>) => ({
  id: 'c1',
  tenantName: 'ร้านบิวตี้เฮ้าส์',
  channel: 'line',
  category: 'bug',
  urgency: 'normal',
  message: 'กดบันทึกแล้วขึ้น error ค่ะ',
  recognizedVia: 'lead',
  leadId: 'lead-1',
  invoiceNumber: null,
  attachmentUrl: null,
  status: 'open',
  followUps: 0,
  createdAt: '2026-11-17T05:00:00Z',
  ...over,
});

beforeEach(() => {
  h.patch.mockReset();
  h.filter.mockReset();
  h.canWrite = true;
  h.rows = [
    row({ id: 'c2', urgency: 'emergency', category: 'outage', message: 'ระบบล่มค่ะ' }),
    row({ id: 'c1', invoiceNumber: 'INV-1', attachmentUrl: 'https://x.test/s.jpg', followUps: 2 }),
  ];
});

describe('เคสรอตอบ page', () => {
  it('shows the open cases (emergency badge, shop, words, invoice, picture, chat link) and filters open by default', () => {
    render(<ChatCasesPage />);
    expect(h.filter).toHaveBeenCalledWith('open');
    const rows = screen.getAllByTestId('chat-case-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('urgency.emergency');
    expect(rows[0]?.textContent).toContain('ระบบล่มค่ะ');
    expect(rows[1]?.textContent).toContain('invoice{"number":"INV-1"}');
    expect(rows[1]?.querySelector('a[href="https://x.test/s.jpg"]')).not.toBeNull();
    expect(rows[1]?.querySelector('a[href="/platform/sales?lead=lead-1"]')).not.toBeNull();
  });

  it('closing a case sends done; a closed case can be reopened', () => {
    h.rows = [row({ id: 'c1' }), row({ id: 'c3', status: 'done' })];
    render(<ChatCasesPage />);
    const [open, done] = screen.getAllByRole('button', { name: /markDone|reopen/ });
    fireEvent.click(open as HTMLElement);
    expect(h.patch).toHaveBeenCalledWith({ id: 'c1', status: 'done' });
    fireEvent.click(done as HTMLElement);
    expect(h.patch).toHaveBeenCalledWith({ id: 'c3', status: 'open' });
  });

  it('a read-only team member sees no buttons', () => {
    h.canWrite = false;
    render(<ChatCasesPage />);
    expect(screen.queryAllByRole('button', { name: /markDone|reopen/ })).toHaveLength(0);
  });

  it('Thai and English have the same keys', () => {
    const keys = (o: Record<string, unknown>, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === 'object' ? keys(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`],
      );
    expect(keys(en).sort()).toEqual(keys(th).sort());
  });
});
