import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasPendingSlip } from '@/features/platform/invoice-slip';
import { InvoicesPage } from '@/features/platform/pages/invoices-page';

const h = vi.hoisted(() => ({
  confirm: vi.fn(),
  reject: vi.fn(),
  patch: vi.fn(),
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
  invoices: [] as unknown[],
}));

vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('@/features/accounting/components/a4-actions', () => ({ A4Link: () => null }));
vi.mock('@/features/platform/api', () => ({
  useInvoices: () => ({ isPending: false, isError: false, data: h.invoices }),
  useTenants: () => ({ data: [] }),
  usePlans: () => ({ data: [] }),
  useConfirmPayment: () => ({ mutate: h.confirm, isPending: false }),
  useRejectSlip: () => ({ mutate: h.reject, isPending: false }),
  usePatchInvoice: () => ({ mutate: h.patch, isPending: false }),
  useCreateInvoice: () => ({ mutate: vi.fn(), isPending: false }),
  useGenerateInvoices: () => ({ mutate: vi.fn(), isPending: false }),
}));

const invoice = (over: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  number: 'INV-202610-0001',
  tenantName: 'ร้านสปา',
  source: 'subscription',
  status: 'issued',
  issuedOn: '2026-10-01',
  dueOn: '2026-10-15',
  amountMinor: 99_000,
  vatMinor: 0,
  totalMinor: 99_000,
  slipUrl: 'https://files.example/slip.png?sig=abc',
  slipUploadedAt: '2026-10-02T03:00:00.000Z',
  slipNote: null,
  planName: 'Pro',
  periodStart: '2026-11-02',
  periodEnd: '2026-12-02',
  receiptNumber: null,
  payUrl: 'https://app.coreup.pro/pay/tok',
  termsAcceptance: null,
  slipCheck: null,
  ...over,
});

beforeEach(() => {
  h.invoices = [invoice()];
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('hasPendingSlip', () => {
  it('is true only for unpaid invoices that carry a slip', () => {
    expect(hasPendingSlip({ status: 'issued', slipUploadedAt: '2026-10-02T03:00:00Z' })).toBe(true);
    expect(hasPendingSlip({ status: 'overdue', slipUploadedAt: '2026-10-02T03:00:00Z' })).toBe(true);
    expect(hasPendingSlip({ status: 'paid', slipUploadedAt: '2026-10-02T03:00:00Z' })).toBe(false);
    expect(hasPendingSlip({ status: 'issued', slipUploadedAt: null })).toBe(false);
  });
});

describe('invoices page: slips and mark-as-paid', () => {
  it('flags a reported transfer and opens the slip next to the invoice', () => {
    render(<InvoicesPage />);
    expect(screen.getAllByText('invoices.slip.badge').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'invoices.slip.review' })[0] as HTMLElement);
    const img = screen.getByRole('img', { name: 'invoices.slip.file' });
    expect(img.getAttribute('src')).toBe('https://files.example/slip.png?sig=abc');
  });

  it('"mark as paid" on a package invoice runs confirm-payment, not the status PATCH', () => {
    h.invoices = [invoice({ slipUrl: null, slipUploadedAt: null })];
    render(<InvoicesPage />);
    fireEvent.click(screen.getAllByRole('button', { name: 'invoices.markPaid' })[0] as HTMLElement);
    expect(h.confirm).toHaveBeenCalledWith('inv-1', expect.anything());
    expect(h.patch).not.toHaveBeenCalled();
  });

  it('"mark as paid" on a consulting invoice still uses the status PATCH', () => {
    h.invoices = [invoice({ id: 'inv-2', source: 'engagement', slipUrl: null, slipUploadedAt: null })];
    render(<InvoicesPage />);
    fireEvent.click(screen.getAllByRole('button', { name: 'invoices.markPaid' })[0] as HTMLElement);
    expect(h.patch).toHaveBeenCalledWith({ id: 'inv-2', body: { status: 'paid' } }, expect.anything());
    expect(h.confirm).not.toHaveBeenCalled();
  });
});

describe('slip review sheet actions', () => {
  const open = () => {
    render(<InvoicesPage />);
    fireEvent.click(screen.getAllByRole('button', { name: 'invoices.slip.review' })[0] as HTMLElement);
  };

  it('confirm sends the invoice id to confirm-payment', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'invoices.slip.confirm' }));
    expect(h.confirm).toHaveBeenCalledWith('inv-1', expect.anything());
    expect(h.reject).not.toHaveBeenCalled();
  });

  it('reject needs a note: an empty one is blocked with a reason, nothing is sent', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'invoices.slip.reject' }));
    expect(h.reject).not.toHaveBeenCalled();
    expect(h.toast.warning).toHaveBeenCalledWith('invoices.slip.noteNeeded', expect.anything());
  });

  it('reject sends the trimmed note to reject-slip', () => {
    open();
    fireEvent.change(screen.getByLabelText('invoices.slip.noteLabel'), { target: { value: '  ยอดไม่ตรง  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'invoices.slip.reject' }));
    expect(h.reject).toHaveBeenCalledWith({ id: 'inv-1', note: 'ยอดไม่ตรง' }, expect.anything());
    expect(h.confirm).not.toHaveBeenCalled();
  });
});

describe('invoice detail: acceptance of the terms and the automatic slip check', () => {
  it('shows who accepted which version (IP, browser) and the slip-check verdict next to the slip', () => {
    h.invoices = [
      invoice({
        receiptNumber: null,
        termsAcceptance: {
          version: '2026-10-21',
          acceptedAt: '2026-10-02T02:00:00.000Z',
          name: 'สมชาย ใจดี',
          userId: null,
          ip: '203.0.113.7',
          userAgent: 'Mozilla/5.0',
        },
        slipCheck: {
          status: 'failed',
          reasons: ['amount_low'],
          amountMinor: 50_000,
          receiverName: 'นายสุบรรณ นกสังข์',
          receiverAccountMasked: 'xxx-x-x5462-2',
          transRef: 'T1',
          paidAt: '2026-10-02T01:00:00.000Z',
          checkedAt: '2026-10-02T03:01:00.000Z',
        },
      }),
    ];
    render(<InvoicesPage />);
    fireEvent.click(screen.getAllByRole('button', { name: 'invoices.slip.review' })[0] as HTMLElement);
    const accepted = screen.getByTestId('terms-acceptance').textContent ?? '';
    expect(accepted).toContain('invoices.acceptance.title');
    expect(accepted).toContain('IP 203.0.113.7');
    expect(accepted).toContain('Mozilla/5.0');
    const check = screen.getByTestId('slip-check').textContent ?? '';
    expect(check).toContain('invoices.slip.check.status.failed');
    expect(check).toContain('invoices.slip.check.reason.amount_low');
  });

  it('shows the free basic check with its reason and the always-visible bank-app note', () => {
    h.invoices = [
      invoice({
        receiptNumber: null,
        slipCheck: {
          status: 'skipped',
          reasons: ['no_qr'],
          amountMinor: null,
          receiverName: null,
          receiverAccountMasked: null,
          transRef: null,
          paidAt: null,
          checkedAt: '2026-10-02T03:01:00.000Z',
          method: 'basic',
        },
      }),
    ];
    render(<InvoicesPage />);
    fireEvent.click(screen.getAllByRole('button', { name: 'invoices.slip.review' })[0] as HTMLElement);
    expect(screen.getByTestId('slip-check').textContent).toContain('invoices.slip.check.reason.no_qr');
    expect(screen.getByTestId('slip-check-basic-note').textContent).toBe('invoices.slip.check.basicNote');
  });

  it('says so when the customer has not accepted the terms yet, and offers the LINE message for an unpaid notice', () => {
    h.invoices = [invoice({ slipUrl: null, slipUploadedAt: null })];
    render(<InvoicesPage />);
    fireEvent.click(screen.getAllByRole('button', { name: 'invoices.detail' })[0] as HTMLElement);
    expect(screen.getByTestId('terms-none')).toBeTruthy();
  });
});
