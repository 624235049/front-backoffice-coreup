import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OtherInvoiceDialog } from '@/features/platform/components/other-invoice-dialog';

const h = vi.hoisted(() => ({ create: vi.fn(), patch: vi.fn(), warning: vi.fn() }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: h.warning } }));
vi.mock('@/features/platform/api', () => ({
  useTenants: () => ({
    data: [
      { id: 'shop-1', name: 'ร้านสปา' },
      { id: 'shop-2', name: 'ร้านกาแฟ' },
    ],
    isPending: false,
  }),
  usePlans: () => ({
    data: [{ code: 'pro', name: 'Pro', priceMinor: 99_000, interval: 'month', active: true }],
  }),
  useAddons: () => ({
    data: {
      settings: {
        aiChat: { monthlyMinor: 49_000, topupMinor: 29_000, topupMessages: 1000, setupMinor: 150_000 },
        setupService: { priceMinor: 300_000 },
      },
    },
  }),
  useCreateOtherInvoice: () => ({ mutate: h.create, isPending: false }),
  usePatchInvoice: () => ({ mutate: h.patch, isPending: false }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const shop = { id: 'shop-1', name: 'ร้านสปา' };
const type = (label: string, value: string, at = 0) =>
  fireEvent.change(screen.getAllByLabelText(label)[at] as HTMLElement, { target: { value } });
const field = (label: string, at = 0) => (screen.getAllByLabelText(label)[at] as HTMLInputElement).value;

describe('OtherInvoiceDialog: free-form lines', () => {
  it('a quick-pick fills the description, the price stays editable, and the body is sent in satang', () => {
    render(<OtherInvoiceDialog open onOpenChange={() => undefined} tenant={shop} />);
    fireEvent.click(screen.getByTestId('preset-move'));
    expect(field('otherInvoice.descriptionLabel')).toBe('otherInvoice.presetList.move');
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

  it('chips come from existing prices (set-up fee, AI add-on monthly / top-up / set-up, plans) and fill an editable line', () => {
    render(<OtherInvoiceDialog open onOpenChange={() => undefined} tenant={shop} />);
    fireEvent.click(screen.getByTestId('preset-setup'));
    expect(field('otherInvoice.unitPrice')).toBe('3000');
    fireEvent.click(screen.getByTestId('ai-monthly'));
    fireEvent.click(screen.getByTestId('ai-topup'));
    fireEvent.click(screen.getByTestId('ai-setup'));
    fireEvent.click(screen.getByTestId('plan-pro'));
    expect(screen.getAllByTestId('other-line')).toHaveLength(5);
    expect(field('otherInvoice.unitPrice', 1)).toBe('490');
    expect(field('otherInvoice.unitPrice', 2)).toBe('290');
    expect(field('otherInvoice.unitPrice', 3)).toBe('1500');
    expect(field('otherInvoice.unitPrice', 4)).toBe('990');
    // a chip price is only a start: the team edits it
    type('otherInvoice.unitPrice', '2500', 0);
    expect(field('otherInvoice.unitPrice', 0)).toBe('2500');
  });

  it('the quantity may be a fraction; every line and the grand total are live', () => {
    render(<OtherInvoiceDialog open onOpenChange={() => undefined} tenant={shop} />);
    type('otherInvoice.descriptionLabel', 'ค่าพัฒนา');
    type('otherInvoice.quantity', '1.5');
    type('otherInvoice.unitPrice', '850.50');
    expect(screen.getAllByTestId('line-total')[0]?.textContent).toContain('1,275.75');
    fireEvent.click(screen.getByText('otherInvoice.addLine'));
    type('otherInvoice.descriptionLabel', 'ค่าที่ปรึกษา', 1);
    type('otherInvoice.unitPrice', '1000', 1);
    type('otherInvoice.quantity', '0.25', 1);
    expect(screen.getByTestId('other-total').textContent).toContain('1,525.75');
    fireEvent.click(screen.getByTestId('other-submit'));
    expect(h.create).toHaveBeenCalledWith(
      {
        tenantId: 'shop-1',
        lines: [
          { description: 'ค่าพัฒนา', quantity: 1.5, unitMinor: 85_050 },
          { description: 'ค่าที่ปรึกษา', quantity: 0.25, unitMinor: 100_000 },
        ],
      },
      expect.anything(),
    );
  });

  it('lines can be reordered and removed', () => {
    render(<OtherInvoiceDialog open onOpenChange={() => undefined} tenant={shop} />);
    fireEvent.click(screen.getByTestId('preset-move'));
    fireEvent.click(screen.getByTestId('preset-dev'));
    expect(field('otherInvoice.descriptionLabel', 0)).toBe('otherInvoice.presetList.move');
    fireEvent.click(screen.getAllByLabelText('otherInvoice.moveDown')[0] as HTMLElement);
    expect(field('otherInvoice.descriptionLabel', 0)).toBe('otherInvoice.presetList.dev');
    expect(field('otherInvoice.descriptionLabel', 1)).toBe('otherInvoice.presetList.move');
    fireEvent.click(screen.getAllByLabelText('otherInvoice.removeLine')[0] as HTMLElement);
    expect(screen.getAllByTestId('other-line')).toHaveLength(1);
    expect(field('otherInvoice.descriptionLabel', 0)).toBe('otherInvoice.presetList.move');
  });

  it('a second quick-pick adds a line; nothing is sent while a line has no price', () => {
    render(<OtherInvoiceDialog open onOpenChange={() => undefined} tenant={shop} />);
    fireEvent.click(screen.getByTestId('preset-move'));
    fireEvent.click(screen.getByTestId('preset-dev'));
    expect(screen.getAllByTestId('other-line')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('other-submit'));
    expect(h.create).not.toHaveBeenCalled();
    expect(h.warning).toHaveBeenCalledWith('otherInvoice.priceNeeded', expect.anything());
  });

  it('refuses a quantity with more than 3 decimals or zero', () => {
    render(<OtherInvoiceDialog open onOpenChange={() => undefined} tenant={shop} />);
    fireEvent.click(screen.getByTestId('preset-move'));
    type('otherInvoice.unitPrice', '100');
    for (const bad of ['0', '1.0005', 'abc', '']) {
      type('otherInvoice.quantity', bad);
      fireEvent.click(screen.getByTestId('other-submit'));
    }
    expect(h.create).not.toHaveBeenCalled();
    expect(h.warning).toHaveBeenCalledWith('otherInvoice.quantityNeeded', expect.anything());
  });

  it('the shop is picked by typing its name', () => {
    render(<OtherInvoiceDialog open onOpenChange={() => undefined} />);
    fireEvent.click(screen.getByTestId('preset-move'));
    type('otherInvoice.unitPrice', '100');
    fireEvent.click(screen.getByTestId('other-submit'));
    expect(h.warning).toHaveBeenCalledWith('invoices.pickShopFirst', expect.anything());
    const box = screen.getByRole('combobox');
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'กาแฟ' } });
    expect(screen.queryByText('ร้านสปา')).toBeNull();
    fireEvent.click(screen.getByText('ร้านกาแฟ'));
    fireEvent.click(screen.getByTestId('other-submit'));
    expect(h.create).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'shop-2' }), expect.anything());
  });

  it('with a draft it edits that draft: lines come in, and saving PATCHes only the lines', () => {
    const draft = {
      id: 'inv-9',
      tenantId: 'shop-1',
      tenantName: 'ร้านสปา',
      otherLines: [
        { description: 'ค่าตั้งระบบ', quantity: 1.5, unitMinor: 150_000, amountMinor: 225_000, note: 'รวมอบรม' },
      ],
    };
    render(
      <OtherInvoiceDialog
        open
        onOpenChange={() => undefined}
        draft={draft as unknown as Parameters<typeof OtherInvoiceDialog>[0]['draft']}
      />,
    );
    expect(field('otherInvoice.descriptionLabel')).toBe('ค่าตั้งระบบ');
    expect(field('otherInvoice.quantity')).toBe('1.5');
    expect(field('otherInvoice.unitPrice')).toBe('1500');
    type('otherInvoice.quantity', '2');
    fireEvent.click(screen.getByTestId('other-submit'));
    expect(h.create).not.toHaveBeenCalled();
    expect(h.patch).toHaveBeenCalledWith(
      {
        id: 'inv-9',
        body: { lines: [{ description: 'ค่าตั้งระบบ', quantity: 2, unitMinor: 150_000, note: 'รวมอบรม' }] },
      },
      expect.anything(),
    );
  });
});
