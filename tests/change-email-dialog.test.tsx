import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChangeEmailDialog } from '@/features/platform/components/user-actions';
import { ApiError } from '@/lib/api';

const h = vi.hoisted(() => ({
  change: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: h.success, error: h.error, warning: h.warning } }));
vi.mock('@/features/platform/api', () => ({
  useChangeUserEmail: () => ({ mutate: h.change, isPending: false, reset: vi.fn() }),
  useCreateUserResetLink: () => ({}),
  useResetUserPassword: () => ({}),
  useRevokeUserSessions: () => ({}),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const user = {
  id: 'u-1',
  name: 'สมชาย',
  email: 'old@shop.test',
  isTeam: false,
  activeSessions: 2,
};
const REASON = 'ลูกค้าแจ้งทาง LINE ยืนยันแล้ว';

const open = (onOpenChange = vi.fn()) => {
  render(<ChangeEmailDialog user={user} open onOpenChange={onOpenChange} />);
  return onOpenChange;
};
const fill = (email: string, reason: string) => {
  fireEvent.change(screen.getByLabelText('changeEmail.label'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('reason.label'), { target: { value: reason } });
};
const confirm = () => fireEvent.click(screen.getByText('changeEmail.confirm'));

describe('ChangeEmailDialog', () => {
  it('warns that the user is signed out of every device', () => {
    open();
    expect(screen.getByRole('note').textContent).toBe('changeEmail.warning');
  });

  it('sends nothing until the email looks valid and the reason is long enough', () => {
    open();
    fill('not-an-email', REASON);
    confirm();
    expect(h.warning).toHaveBeenLastCalledWith('changeEmail.needed', expect.anything());
    fill('new@shop.test', 'สั้น');
    confirm();
    expect(h.warning).toHaveBeenLastCalledWith('reason.needed', expect.anything());
    expect(h.change).not.toHaveBeenCalled();
  });

  it('sends the trimmed lower-case email and reason, then toasts success and closes', () => {
    const onOpenChange = open();
    fill('  New@Shop.Test ', ` ${REASON} `);
    confirm();
    expect(h.change).toHaveBeenCalledWith(
      { id: 'u-1', newEmail: 'new@shop.test', reason: REASON },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
    const [, { onSuccess }] = h.change.mock.lastCall as [
      unknown,
      { onSuccess: (r: { data: { email: string; revokedSessions: number } }) => void },
    ];
    onSuccess({ data: { email: 'new@shop.test', revokedSessions: 2 } });
    expect(h.success).toHaveBeenCalledWith('changeEmail.done');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('maps email_taken / same_email to their Thai messages and anything else to the generic one', () => {
    open();
    fill('new@shop.test', REASON);
    confirm();
    const [, { onError }] = h.change.mock.lastCall as [unknown, { onError: (e: unknown) => void }];
    const conflict = (reason: string) =>
      new ApiError({ status: 409, code: 'CONFLICT', message: 'x', details: { reason } });
    onError(conflict('email_taken'));
    expect(h.error).toHaveBeenLastCalledWith('error.emailTaken');
    onError(conflict('same_email'));
    expect(h.error).toHaveBeenLastCalledWith('error.sameEmail');
    onError(new ApiError({ status: 500, code: 'INTERNAL', message: 'x' }));
    expect(h.error).toHaveBeenCalledTimes(3);
    expect(h.error).not.toHaveBeenLastCalledWith('error.emailTaken');
  });
});
