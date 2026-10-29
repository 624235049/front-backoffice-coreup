import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TenantDetail } from '@/features/platform/api';
import { LockCard } from '@/features/platform/components/lock-card';
import platform from '@/locales/th/platform.json';

const state = vi.hoisted(() => ({ canBill: true, mutate: vi.fn() }));
vi.mock('@/lib/permissions', () => ({ useCan: () => state.canBill }));
vi.mock('@/features/platform/api', () => ({
  useSetTrialEnd: () => ({ mutate: state.mutate, isPending: false }),
}));

const i18n = i18next.createInstance();
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'th',
    resources: { th: { platform } },
    defaultNS: 'platform',
    interpolation: { escapeValue: false },
  });
});
afterEach(() => {
  cleanup();
  state.canBill = true;
  state.mutate.mockReset();
});

const show = (over: Partial<TenantDetail>) =>
  render(
    <I18nextProvider i18n={i18n}>
      <LockCard
        d={
          {
            id: 't1',
            status: 'trial',
            trialEndsOn: '2026-11-16',
            lockOn: '2026-11-23',
            access: 'locked',
            ...over,
          } as TenantDetail
        }
      />
    </I18nextProvider>,
  );

describe('LockCard', () => {
  it('shows a locked shop and sends the new trial end', () => {
    show({});
    expect(screen.getByText('ล็อกอยู่')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('วันสิ้นสุดช่วงทดลอง'), { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกวันที่' }));
    expect(state.mutate).toHaveBeenCalledWith({ trialEndsOn: '2026-12-31' }, expect.anything());
  });

  it('offers no extension without platform:billing or for a paying shop', () => {
    state.canBill = false;
    show({});
    expect(screen.queryByLabelText('วันสิ้นสุดช่วงทดลอง')).toBeNull();
    cleanup();
    state.canBill = true;
    show({ status: 'active', trialEndsOn: null });
    expect(screen.queryByLabelText('วันสิ้นสุดช่วงทดลอง')).toBeNull();
  });

  it('says a shop without an end date is never locked', () => {
    show({ status: 'active', trialEndsOn: null, lockOn: null, access: 'ok' });
    expect(screen.getByText(/ไม่ถูกล็อกอัตโนมัติ/)).toBeTruthy();
  });
});
