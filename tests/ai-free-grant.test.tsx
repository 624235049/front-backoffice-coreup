import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiFreeGrant } from '@/features/platform/components/ai-free-grant';
import platform from '@/locales/th/platform.json';

const i18n = i18next.createInstance();
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'th',
    resources: { th: { platform } },
    defaultNS: 'platform',
    interpolation: { escapeValue: false },
  });
});
beforeEach(() => {
  // 01:00 on 28 Oct in Bangkok is still 27 Oct in UTC: "today" must be the Bangkok day
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-28T01:00:00+07:00'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const view = (over: Partial<Parameters<typeof AiFreeGrant>[0]> = {}) => {
  const onGrant = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <AiFreeGrant enabledUntil={null} free={false} disabled={false} onGrant={onGrant} {...over} />
    </I18nextProvider>,
  );
  return onGrant;
};

describe('AiFreeGrant', () => {
  it('has no one-click free month: the first 100 messages are free for everybody already', () => {
    view();
    expect(screen.queryByTestId('ai-free-month')).toBeNull();
    expect(screen.queryByRole('button', { name: /ฟรี 1 เดือน/ })).toBeNull();
  });

  it('a custom day goes out billed by default, free only when "ให้ใช้ฟรี" is ticked, with the note', () => {
    const onGrant = view();
    const apply = screen.getByTestId('ai-grant-custom') as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('วันสุดท้ายที่ใช้ได้'), { target: { value: '2026-12-31' } });
    fireEvent.change(screen.getByLabelText(/หมายเหตุ/), { target: { value: ' ร้านชุดเช่า ' } });
    fireEvent.click(apply);
    expect(onGrant).toHaveBeenLastCalledWith({ active: true, enabledUntil: '2026-12-31', note: 'ร้านชุดเช่า' });
    fireEvent.click(screen.getByLabelText('ให้ใช้ฟรี (ไม่ขึ้นใบแจ้งชำระ)'));
    fireEvent.click(apply);
    expect(onGrant).toHaveBeenLastCalledWith({
      active: true,
      enabledUntil: '2026-12-31',
      free: true,
      note: 'ร้านชุดเช่า',
    });
  });

  it('shows "ฟรีถึง {date}" with the last day (the API sends the first instant after it); nothing while no end', () => {
    // 27 Nov 00:00 Bangkok = the first instant after 26 Nov
    view({ enabledUntil: '2026-11-26T17:00:00.000Z', free: true });
    const badge = screen.getByTestId('ai-grant-badge').textContent ?? '';
    expect(badge).toContain('ฟรีถึง');
    expect(badge).toContain('26');
    cleanup();
    view();
    expect(screen.queryByTestId('ai-grant-badge')).toBeNull();
  });

  it('is locked while saving or without write access', () => {
    view({ disabled: true });
    expect((screen.getByTestId('ai-grant-custom') as HTMLButtonElement).disabled).toBe(true);
  });
});
