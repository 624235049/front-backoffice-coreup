import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type * as ReactI18next from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IssuePinCard } from '@/features/platform/components/issue-pin-card';

const h = vi.hoisted(() => ({
  status: { isSet: true, isDefault: true, updatedAt: '2026-11-01T00:00:00.000Z' },
  save: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('react-i18next', async (orig) => ({
  ...(await orig<typeof ReactI18next>()),
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'th' } }),
}));
vi.mock('@/features/platform/api', () => ({
  useIssuePin: () => ({ isPending: false, isError: false, data: h.status }),
  useSetIssuePin: () => ({ mutate: h.save, isPending: false }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  h.status = { isSet: true, isDefault: true, updatedAt: '2026-11-01T00:00:00.000Z' };
});

const type = (id: string, value: string) => fireEvent.change(screen.getByTestId(id), { target: { value } });

describe('issue PIN card (platform_owner)', () => {
  it('shows set / not set, and tells the owner to change the initial PIN', () => {
    render(<IssuePinCard />);
    expect(screen.getByTestId('issue-pin-status').textContent).toBe('issuePin.card.isSet');
    expect(screen.getByTestId('issue-pin-default')).toBeTruthy();
    cleanup();
    h.status = { isSet: false, isDefault: false, updatedAt: null as unknown as string };
    render(<IssuePinCard />);
    expect(screen.getByTestId('issue-pin-status').textContent).toBe('issuePin.card.notSet');
    expect(screen.queryByTestId('issue-pin-default')).toBeNull();
  });

  it('needs 4–8 digits typed twice (masked, digits only); then saves', () => {
    render(<IssuePinCard />);
    fireEvent.click(screen.getByTestId('issue-pin-edit'));
    expect((screen.getByTestId('issue-pin-new') as HTMLInputElement).type).toBe('password');
    type('issue-pin-new', '12a3');
    expect((screen.getByTestId('issue-pin-new') as HTMLInputElement).value).toBe('123');
    fireEvent.click(screen.getByTestId('set-issue-pin-save'));
    expect(h.save).not.toHaveBeenCalled();
    type('issue-pin-new', '2468');
    type('issue-pin-again', '2469');
    fireEvent.click(screen.getByTestId('set-issue-pin-save'));
    expect(h.save).not.toHaveBeenCalled(); // mismatch
    type('issue-pin-again', '2468');
    fireEvent.keyDown(screen.getByTestId('issue-pin-again'), { key: 'Enter' });
    expect(h.save).toHaveBeenCalledWith('2468', expect.anything());
  });
});
