import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { formatMobile, OwnerPhone } from '@/features/platform/components/owner-phone';
import platform from '@/locales/th/platform.json';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

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
  vi.clearAllMocks();
});

const renderPhone = (phone: string | null, onRowClick = vi.fn()) =>
  render(
    <I18nextProvider i18n={i18n}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stands in for the clickable table row */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: test double */}
      <div onClick={onRowClick}>
        <OwnerPhone phone={phone} />
      </div>
    </I18nextProvider>,
  );

describe('OwnerPhone', () => {
  it('formats a 10-digit mobile and links it with tel:', () => {
    expect(formatMobile('0812345678')).toBe('081-234-5678');
    renderPhone('0812345678');
    const link = screen.getByTestId('owner-phone-link');
    expect(link.getAttribute('href')).toBe('tel:0812345678');
    expect(link.textContent).toBe('081-234-5678');
  });

  it('shows a dash when the shop never gave a phone', () => {
    renderPhone(null);
    expect(screen.queryByTestId('owner-phone-link')).toBeNull();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('copies the plain digits and does not open the row behind it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const row = vi.fn();
    renderPhone('0812345678', row);
    fireEvent.click(screen.getByTestId('owner-phone-copy'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('คัดลอกเบอร์แล้ว'));
    expect(writeText).toHaveBeenCalledWith('0812345678');
    fireEvent.click(screen.getByTestId('owner-phone-link'));
    expect(row).not.toHaveBeenCalled();
  });

  it('tells the person the number when copying is blocked', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    renderPhone('0812345678');
    fireEvent.click(screen.getByTestId('owner-phone-copy'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('คัดลอกไม่ได้ เบอร์คือ 0812345678'));
  });
});
