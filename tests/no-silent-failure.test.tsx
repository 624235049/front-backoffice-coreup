import { QueryClientProvider, useMutation } from '@tanstack/react-query';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { createQueryClient } from '@/lib/query-client';

const toast = vi.hoisted(() => ({ warning: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Button blockedReason', () => {
  it('a blocked tap explains why and does not run the action', () => {
    const onClick = vi.fn();
    render(
      <Button blockedReason="เลือกบริการก่อน" onClick={onClick}>
        บันทึก
      </Button>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    expect(onClick).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith('เลือกบริการก่อน', expect.anything());
    expect(screen.getByRole('button').getAttribute('aria-disabled')).toBe('true');
  });

  it('a blocked submit button does not submit its form', () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" blockedReason="กรอกชื่อก่อน">
          ส่ง
        </Button>
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'ส่ง' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('runs normally when there is no reason', () => {
    const onClick = vi.fn();
    render(
      <Button blockedReason={false} onClick={onClick}>
        บันทึก
      </Button>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(toast.warning).not.toHaveBeenCalled();
  });
});

describe('failed mutations are never silent', () => {
  const setup = () => {
    const qc = createQueryClient(vi.fn());
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    return wrapper;
  };
  const fail = () => Promise.reject(new ApiError({ status: 409, code: 'CONFLICT', message: 'บิลนี้ปิดไปแล้ว' }));

  it('a mutation without its own error handling gets a toast with the server message', async () => {
    const { result } = renderHook(() => useMutation({ mutationFn: fail }), { wrapper: setup() });
    result.current.mutate();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('บิลนี้ปิดไปแล้ว'));
  });

  it('leaves mutations alone that show the error themselves', async () => {
    const own = vi.fn();
    const { result } = renderHook(
      () => ({
        handled: useMutation({ mutationFn: fail, onError: own }),
        inline: useMutation({ mutationFn: fail, meta: { inlineError: true } }),
      }),
      { wrapper: setup() },
    );
    result.current.handled.mutate();
    result.current.inline.mutate();
    await waitFor(() => expect(own).toHaveBeenCalled());
    await vi.waitFor(() => expect(result.current.inline.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
