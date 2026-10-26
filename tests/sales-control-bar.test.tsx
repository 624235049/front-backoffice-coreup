import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allOff, modeOf, SalesControlBar, withMode } from '@/features/platform/components/sales-control-bar';
import type { SalesConfigView } from '@/features/platform/sales-api';

const h = vi.hoisted(() => ({
  save: vi.fn(),
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('@/features/platform/sales-api', () => ({
  useSaveSalesConfig: () => ({ mutate: h.save, isPending: false }),
  useSalesContacts: () => ({ data: [{ externalUserId: 'PSID-9', label: 'คุณบอส' }] }),
}));

const FB = 'fb-account';
const IG = 'ig-account';
const LINE = 'line-account';
const view = (
  channels: { channelAccountId: string; mode: 'off' | 'testers' | 'everyone' }[],
  testers: unknown[] = [],
) =>
  ({
    config: { channels, testers },
    accounts: [
      { id: FB, provider: 'messenger', name: 'CoreUp เพจ' },
      { id: IG, provider: 'instagram', name: 'coreup.pro' },
      { id: LINE, provider: 'line', name: 'CoreUP.Pro' },
    ],
    usage: {},
    modelReady: true,
  }) as unknown as SalesConfigView;

const pick = (account: string, name: string) => {
  const group = screen.getByTestId(`sales-channel-${account}`);
  const el = [...group.querySelectorAll('[role=radio]')].find((b) => b.textContent?.startsWith(name));
  if (!el) throw new Error(`no ${name}`);
  return el;
};
const saved = () => h.save.mock.calls[0]?.[0] as { channels: { channelAccountId: string; mode: string }[] };

beforeEach(() => h.save.mockReset());
afterEach(cleanup);

describe('config helpers', () => {
  it('modeOf: an account that is not listed is off; withMode changes one account and keeps the others', () => {
    const c = view([{ channelAccountId: FB, mode: 'everyone' }]).config;
    expect(modeOf(c, IG)).toBe('off');
    const next = withMode(c, [FB, IG], IG, 'testers');
    expect(next.channels).toEqual([
      { channelAccountId: FB, mode: 'everyone' },
      { channelAccountId: IG, mode: 'testers' },
    ]);
    expect(allOff(next, [FB, IG, LINE]).channels.every((x) => x.mode === 'off')).toBe(true);
  });
});

describe('SalesControlBar', () => {
  it('saves at once: ทดสอบ on one page leaves the others alone', () => {
    render(<SalesControlBar view={view([{ channelAccountId: IG, mode: 'everyone' }])} />);
    fireEvent.click(pick(FB, 'ทดสอบ'));
    expect(saved().channels).toEqual(
      expect.arrayContaining([
        { channelAccountId: FB, mode: 'testers' },
        { channelAccountId: IG, mode: 'everyone' },
      ]),
    );
  });

  it('ทุกคน asks for a confirmation first, then saves', () => {
    render(<SalesControlBar view={view([])} />);
    fireEvent.click(pick(FB, 'ทุกคน'));
    expect(h.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'เปิดให้ทุกคน' }));
    expect(saved().channels).toContainEqual({ channelAccountId: FB, mode: 'everyone' });
  });

  it('LINE stays with people: only ปิด is possible', () => {
    render(<SalesControlBar view={view([])} />);
    expect(pick(LINE, 'ทดสอบ').hasAttribute('disabled')).toBe(true);
    expect(pick(LINE, 'ทุกคน').hasAttribute('disabled')).toBe(true);
  });

  it('หยุด AI ทั้งหมด turns every channel off in one save; disabled when nothing is on', () => {
    const { unmount } = render(<SalesControlBar view={view([])} />);
    expect(screen.getByTestId('sales-stop-all').hasAttribute('disabled')).toBe(true);
    unmount();
    render(
      <SalesControlBar
        view={view([
          { channelAccountId: FB, mode: 'everyone' },
          { channelAccountId: IG, mode: 'testers' },
        ])}
      />,
    );
    fireEvent.click(screen.getByTestId('sales-stop-all'));
    expect(saved().channels.every((x) => x.mode === 'off')).toBe(true);
    expect(saved().channels).toHaveLength(3);
  });

  it('test mode shows the picker and adds a person as a tester', () => {
    render(<SalesControlBar view={view([{ channelAccountId: FB, mode: 'testers' }])} />);
    fireEvent.click(screen.getByRole('button', { name: /เพิ่ม/ }));
    const next = h.save.mock.calls[0]?.[0] as { testers: unknown[] };
    expect(next.testers).toEqual([{ channelAccountId: FB, externalUserId: 'PSID-9', label: 'คุณบอส' }]);
  });
});
