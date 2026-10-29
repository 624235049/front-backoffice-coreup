import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OtherInvoiceDialog } from '@/features/platform/components/other-invoice-dialog';

const h = vi.hoisted(() => ({ create: vi.fn(), warning: vi.fn() }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: h.warning } }));
vi.mock('@/features/platform/api', () => ({
  useTenants: () => ({ data: [] }),
  useCreateOtherInvoice: () => ({ mutate: h.create, isPending: false }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const shop = { id: 'shop-1', name: 'ร้านสปา' };
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('OtherInvoiceDialog', () => {
  it('a quick-pick fills the description, the price stays editable, and the body is sent in satang', () => {
    render(<OtherInvoiceDialog open onOpenChange={() => undefined} tenant={shop} />);
    fireEvent.click(screen.getByTestId('preset-move'));
    expect((screen.getByLabelText('otherInvoice.descriptionLabel') as HTMLInputElement).value).toBe(
      'otherInvoice.presetList.move',
    );
    type('otherInvoice.unitPrice', '3,000');
    type('otherInvoice.note', ' ย้ายจากระบบเดิม ');
    fireEvent.click(screen.getByTestId('other-submit'));
    expect(h.create).toHaveBeenCalledWith(
      {
        tenantId: 'shop-1',
        lines: [
          {
            description: 'otherInvoice.presetList.move',
            quantity: 1,
            unitMinor: 300_000,
            note: 'ย้ายจากระบบเดิม',
          },
        ],
      },
      expect.anything(),
    );
  });

  it('a second quick-pick adds a line; nothing is sent while a line has no price', () => {
    render(<OtherInvoiceDialog open onOpenChange={() => undefined} tenant={shop} />);
    fireEvent.click(screen.getByTestId('preset-setup'));
    fireEvent.click(screen.getByTestId('preset-dev'));
    expect(screen.getAllByTestId('other-line')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('other-submit'));
    expect(h.create).not.toHaveBeenCalled();
    expect(h.warning).toHaveBeenCalledWith('otherInvoice.priceNeeded', expect.anything());
  });
});
