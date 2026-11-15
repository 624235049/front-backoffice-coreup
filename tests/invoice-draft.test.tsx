import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type * as ReactI18next from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoicesPage } from '@/features/platform/pages/invoices-page';
import { ApiError } from '@/lib/api';

const h = vi.hoisted(() => ({
  send: vi.fn(),
  sendAsync: vi.fn(async () => ({ data: { number: 'INV-1' } })),
  del: vi.fn(),
  patch: vi.fn(),
  confirm: vi.fn(),
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
  invoices: [] as unknown[],
}));

vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('@/lib/membership', () => ({ useMembership: () => ({ permissions: ['platform:billing'] }) }));
// keys + their interpolation values, so a test can see WHICH email / total a dialog shows
vi.mock('react-i18next', async (orig) => ({
  ...(await orig<typeof ReactI18next>()),
  useTranslation: () => ({
    t: (k: string, o?: object) => (o ? `${k} ${JSON.stringify(o)}` : k),
    i18n: { language: 'th' },
  }),
}));
vi.mock('@/features/accounting/components/a4-actions', () => ({ A4Link: () => null }));
vi.mock('@/features/platform/api', () => ({
  useInvoices: () => ({ isPending: false, isError: false, data: h.invoices }),
  useShopPicker: () => ({ data: [] }),
  usePlans: () => ({ data: [] }),
  useAddons: () => ({ data: undefined }),
  useConfirmPayment: () => ({ mutate: h.confirm, isPending: false }),
  useRejectSlip: () => ({ mutate: vi.fn(), isPending: false }),
  usePatchInvoice: () => ({ mutate: h.patch, mutateAsync: vi.fn(async () => ({})), isPending: false }),
  useCreateInvoice: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateOtherInvoice: () => ({ mutate: vi.fn(), isPending: false }),
  useGenerateInvoices: () => ({ mutate: vi.fn(), isPending: false }),
  useSendInvoice: () => ({ mutate: h.send, mutateAsync: h.sendAsync, isPending: false }),
  useDeleteInvoice: () => ({ mutate: h.del, isPending: false }),
}));

const invoice = (over: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  tenantId: 'shop-1',
  tenantName: 'ร้านสปา',
  number: 'DRAFT-abc',
  source: 'engagement',
  sourceId: null,
  status: 'draft',
  issuedOn: '2026-11-02',
  dueOn: '2026-11-16',
  amountMinor: 400_000,
  vatMinor: 28_000,
  totalMinor: 428_000,
  slipUrl: null,
  slipUploadedAt: null,
  slipNote: null,
  slipCheck: null,
  planName: 'ค่าย้ายระบบ',
  periodStart: null,
  periodEnd: null,
  receiptNumber: null,
  payUrl: 'https://app.coreup.pro/pay/tok',
  termsAcceptance: null,
  selfServe: false,
  addon: null,
  recipients: ['owner@spa.test'],
  otherLines: [
    { description: 'ค่าย้ายระบบ', quantity: 1.5, unitMinor: 200_000, amountMinor: 300_000, note: null },
    { description: 'ค่าพัฒนาเพิ่ม', quantity: 2, unitMinor: 50_000, amountMinor: 100_000, note: null },
  ],
  ...over,
});

/** The send dialogs ask for the team PIN: a masked numeric field; the confirm stays off until 4–8 digits are in. */
const typePin = (dialogId: string, pin = '1111') =>
  fireEvent.change(screen.getByTestId(`${dialogId}-pin`), { target: { value: pin } });
const pinError = (code: string, status: number, details: unknown) =>
  new ApiError({ status, code, message: code, details });

const clickAll = (name: string) =>
  fireEvent.click(screen.getAllByRole('button', { name: new RegExp(name) })[0] as HTMLElement);

beforeEach(() => {
  h.invoices = [invoice()];
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('draft invoice: nothing is sent until the team confirms', () => {
  it('the row shows "ฉบับร่าง" instead of the placeholder number; "send" opens a confirm with recipient, total and lines', () => {
    render(<InvoicesPage />);
    expect(document.body.textContent).not.toContain('DRAFT-abc');
    fireEvent.click(screen.getAllByTestId('row-send')[0] as HTMLElement);
    const dlg = screen.getByTestId('send-invoice');
    expect(within(dlg).getByTestId('recipients').textContent).toBe('owner@spa.test');
    expect(within(dlg).getByTestId('total').textContent).toContain('4,280');
    const items = within(dlg).getByTestId('items').textContent ?? '';
    expect(items).toContain('ค่าย้ายระบบ × 1.5');
    expect(items).toContain('ค่าพัฒนาเพิ่ม × 2');
    expect(within(dlg).getByTestId('send-warning').textContent).toContain('invoices.draft.sendWarning');
    // opening the dialog sent nothing
    expect(h.sendAsync).not.toHaveBeenCalled();
  });

  it('sending needs the team PIN: masked numeric field, confirm off until 4–8 digits; Enter or the button sends once', async () => {
    h.sendAsync.mockImplementationOnce(() => new Promise(() => {})); // stays pending: the dialog stays open
    render(<InvoicesPage />);
    fireEvent.click(screen.getAllByTestId('row-send')[0] as HTMLElement);
    const pin = screen.getByTestId('send-invoice-pin') as HTMLInputElement;
    const confirm = screen.getByTestId('send-invoice-confirm') as HTMLButtonElement;
    expect(pin.type).toBe('password');
    expect(pin.inputMode).toBe('numeric');
    expect(confirm.disabled).toBe(true);
    typePin('send-invoice', '12a');
    expect(pin.value).toBe('12'); // digits only
    expect(confirm.disabled).toBe(true);
    fireEvent.keyDown(pin, { key: 'Enter' });
    expect(h.sendAsync).not.toHaveBeenCalled();
    typePin('send-invoice');
    expect(confirm.disabled).toBe(false);
    fireEvent.keyDown(pin, { key: 'Enter' });
    expect(h.sendAsync).toHaveBeenCalledWith({ id: 'inv-1', pin: '1111' });
    // a fast second go never sends twice
    fireEvent.click(confirm);
    fireEvent.keyDown(pin, { key: 'Enter' });
    expect(h.sendAsync).toHaveBeenCalledTimes(1);
  });

  it('a wrong PIN stays in the dialog with the attempts left, clears the field and sends nothing else', async () => {
    h.sendAsync.mockRejectedValueOnce(
      pinError('ISSUE_PIN_WRONG', 403, { reason: 'pin_wrong', attemptsLeft: 3 }),
    );
    render(<InvoicesPage />);
    fireEvent.click(screen.getAllByTestId('row-send')[0] as HTMLElement);
    typePin('send-invoice', '9999');
    fireEvent.click(screen.getByTestId('send-invoice-confirm'));
    await vi.waitFor(() =>
      expect(screen.getByTestId('send-invoice-pin-msg').textContent).toContain('"count":3'),
    );
    expect(screen.getByTestId('send-invoice-pin-msg').textContent).toContain('issuePin.wrong');
    expect((screen.getByTestId('send-invoice-pin') as HTMLInputElement).value).toBe('');
    expect(screen.getByTestId('send-invoice')).toBeTruthy(); // still open, the draft is still a draft
    expect(h.toast.error).not.toHaveBeenCalled();
  });

  it('after too many wrong PINs the lock (429) is explained with the minutes to wait', async () => {
    h.sendAsync.mockRejectedValueOnce(
      pinError('RATE_LIMITED', 429, { reason: 'pin_locked', retryAfterSeconds: 600 }),
    );
    render(<InvoicesPage />);
    fireEvent.click(screen.getAllByTestId('row-send')[0] as HTMLElement);
    typePin('send-invoice');
    fireEvent.click(screen.getByTestId('send-invoice-confirm'));
    await vi.waitFor(() =>
      expect(screen.getByTestId('send-invoice-pin-msg').textContent).toContain('issuePin.locked'),
    );
    expect(screen.getByTestId('send-invoice-pin-msg').textContent).toContain('"minutes":10');
  });

  it('cancel closes the confirm without sending', () => {
    render(<InvoicesPage />);
    fireEvent.click(screen.getAllByTestId('row-send')[0] as HTMLElement);
    fireEvent.click(
      within(screen.getByTestId('send-invoice')).getByRole('button', { name: /common.cancel/ }),
    );
    expect(screen.queryByTestId('send-invoice')).toBeNull();
    expect(h.send).not.toHaveBeenCalled();
  });

  it('a shop with no owner email is told that no email will go out', () => {
    h.invoices = [invoice({ recipients: [] })];
    render(<InvoicesPage />);
    fireEvent.click(screen.getAllByTestId('row-send')[0] as HTMLElement);
    const dlg = screen.getByTestId('send-invoice');
    expect(within(dlg).getByTestId('recipients').textContent).toContain('invoices.draft.noRecipients');
    expect(within(dlg).getByTestId('send-warning').textContent).toContain('sendWarningNoMail');
  });

  it('the detail shows the draft banner with edit / delete / send / void; delete and void ask first', () => {
    render(<InvoicesPage />);
    clickAll('invoices.detail');
    expect(screen.getByTestId('draft-banner').textContent).toContain('invoices.draft.banner');
    for (const id of ['draft-send', 'draft-edit', 'draft-delete', 'void-button'])
      expect(screen.getByTestId(id)).toBeTruthy();

    fireEvent.click(screen.getByTestId('draft-delete'));
    expect(h.del).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('delete-draft-confirm'));
    expect(h.del).toHaveBeenCalledWith('inv-1', expect.anything());
  });

  it('void ("ยกเลิกบิล") asks first and says no email goes out', () => {
    render(<InvoicesPage />);
    clickAll('invoices.detail');
    fireEvent.click(screen.getByTestId('void-button'));
    expect(screen.getByTestId('void-no-mail').textContent).toBe('invoices.voidNoMail');
    expect(h.patch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('void-invoice-confirm'));
    expect(h.patch).toHaveBeenCalledWith({ id: 'inv-1', body: { status: 'void' } }, expect.anything());
  });

  it('an issued invoice can be voided from its row with the same confirm', () => {
    h.invoices = [invoice({ status: 'issued', number: 'INV-202611-0001' })];
    render(<InvoicesPage />);
    clickAll('invoices.void');
    expect(screen.getByTestId('void-no-mail')).toBeTruthy();
    fireEvent.click(screen.getByTestId('void-invoice-confirm'));
    expect(h.patch).toHaveBeenCalledWith({ id: 'inv-1', body: { status: 'void' } }, expect.anything());
  });

  it('a paid invoice can be voided: the confirm warns that its receipt is voided too and sends no email', () => {
    h.invoices = [invoice({ status: 'paid', number: 'INV-202611-0007', receiptNumber: 'RE-202611-0003' })];
    render(<InvoicesPage />);
    fireEvent.click(screen.getAllByTestId('row-void-paid')[0] as HTMLElement);
    expect(screen.getByTestId('void-no-mail')).toBeTruthy();
    expect(screen.getByTestId('void-paid-warning').textContent).toContain('RE-202611-0003');
    expect(h.patch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('void-invoice-confirm'));
    expect(h.patch).toHaveBeenCalledWith({ id: 'inv-1', body: { status: 'void' } }, expect.anything());
  });
});

describe('send: voiding the older notice is opt-in', () => {
  const pkgDraft = () =>
    invoice({ source: 'subscription', sourceId: 'plan-1', otherLines: [], planName: 'Pro' });
  const old = (over: Record<string, unknown> = {}) =>
    invoice({
      id: 'old',
      status: 'issued',
      number: 'INV-OLD',
      source: 'subscription',
      sourceId: 'plan-0',
      otherLines: [],
      ...over,
    });

  it('the box starts unticked; with a slip in review, ticking it blocks the send with a visible reason', async () => {
    h.invoices = [pkgDraft(), old({ slipUploadedAt: '2026-11-01T03:00:00.000Z' })];
    render(<InvoicesPage />);
    fireEvent.click(screen.getAllByTestId('row-send')[0] as HTMLElement);
    const box = screen.getByRole('checkbox', { name: /voidOlder/ });
    expect(box.getAttribute('data-state')).toBe('unchecked');
    expect(screen.queryByTestId('older-in-review')).toBeNull();
    // unticked: sending is allowed even though the old notice has a slip
    fireEvent.click(box);
    expect(screen.getByTestId('older-in-review').textContent).toContain('invoices.draft.paymentInReview');
    typePin('send-invoice');
    fireEvent.click(screen.getByTestId('send-invoice-confirm'));
    expect(h.sendAsync).not.toHaveBeenCalled();
    fireEvent.click(box);
    fireEvent.click(screen.getByTestId('send-invoice-confirm'));
    await vi.waitFor(() => expect(h.sendAsync).toHaveBeenCalledTimes(1));
  });
});

describe('confirm payment states where the receipt email goes', () => {
  it('a package invoice: the receipt goes to the owner email, shown before confirming', () => {
    h.invoices = [invoice({ status: 'issued', source: 'subscription', otherLines: [], number: 'INV-1' })];
    render(<InvoicesPage />);
    clickAll('invoices.markPaid');
    expect(screen.getByTestId('receipt-mail').textContent).toContain('owner@spa.test');
    expect(screen.getByTestId('receipt-mail').textContent).toContain('invoices.confirmPay.mail');
    expect(h.confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('confirm-payment-confirm'));
    expect(h.confirm).toHaveBeenCalledWith('inv-1', expect.anything());
  });

  it('a shop without an owner email: says no receipt email is sent', () => {
    h.invoices = [invoice({ status: 'issued', source: 'subscription', otherLines: [], recipients: [] })];
    render(<InvoicesPage />);
    clickAll('invoices.markPaid');
    expect(screen.getByTestId('receipt-mail').textContent).toBe('invoices.confirmPay.noRecipient');
  });

  it('a consulting invoice: says no receipt email is sent', () => {
    h.invoices = [invoice({ status: 'issued', otherLines: [] })];
    render(<InvoicesPage />);
    clickAll('invoices.markPaid');
    expect(screen.getByTestId('receipt-mail').textContent).toBe('invoices.confirmPay.noMail');
  });
});

describe('send several drafts at once', () => {
  const two = () => [
    invoice({ id: 'a', tenantName: 'ร้าน ก', recipients: ['a@shop.test'], totalMinor: 100_000 }),
    invoice({
      id: 'b',
      tenantName: 'ร้าน ข',
      recipients: ['b@shop.test', 'c@shop.test'],
      totalMinor: 250_000,
    }),
    invoice({ id: 'c', tenantName: 'ร้าน ค', status: 'issued', number: 'INV-9' }),
  ];

  it('needs a selection; one confirm lists every shop, its recipients and the grand total, then sends each', async () => {
    h.invoices = two();
    render(<InvoicesPage />);
    fireEvent.click(screen.getByTestId('bulk-send-open'));
    expect(screen.queryByTestId('bulk-send')).toBeNull();
    expect(h.toast.warning).toHaveBeenCalled();

    fireEvent.click(
      screen.getAllByRole('checkbox', { name: /invoices.draft.pick.*ร้าน ก/ })[0] as HTMLElement,
    );
    fireEvent.click(
      screen.getAllByRole('checkbox', { name: /invoices.draft.pick.*ร้าน ข/ })[0] as HTMLElement,
    );
    fireEvent.click(screen.getByTestId('bulk-send-open'));

    const dlg = screen.getByTestId('bulk-send');
    const rows = within(dlg).getAllByTestId('bulk-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('ร้าน ก');
    expect(rows[0]?.textContent).toContain('a@shop.test');
    expect(rows[1]?.textContent).toContain('b@shop.test, c@shop.test');
    expect(within(dlg).getByTestId('bulk-total').textContent).toContain('3,500');
    expect(h.sendAsync).not.toHaveBeenCalled();

    // one PIN for the whole batch
    expect((screen.getByTestId('bulk-send-confirm') as HTMLButtonElement).disabled).toBe(true);
    typePin('bulk-send');
    fireEvent.click(screen.getByTestId('bulk-send-confirm'));
    await vi.waitFor(() => expect(h.sendAsync).toHaveBeenCalledTimes(2));
    expect(h.sendAsync.mock.calls.map((c) => (c as unknown as [{ id: string; pin: string }])[0])).toEqual([
      { id: 'a', pin: '1111' },
      { id: 'b', pin: '1111' },
    ]);
  });

  it('a wrong PIN on the first one stops the batch: nothing else is sent and the dialog shows why', async () => {
    h.invoices = two();
    h.sendAsync.mockRejectedValueOnce(
      pinError('ISSUE_PIN_WRONG', 403, { reason: 'pin_wrong', attemptsLeft: 4 }),
    );
    render(<InvoicesPage />);
    fireEvent.click(
      screen.getAllByRole('checkbox', { name: /invoices.draft.pick.*ร้าน ก/ })[0] as HTMLElement,
    );
    fireEvent.click(
      screen.getAllByRole('checkbox', { name: /invoices.draft.pick.*ร้าน ข/ })[0] as HTMLElement,
    );
    fireEvent.click(screen.getByTestId('bulk-send-open'));
    typePin('bulk-send', '0000');
    fireEvent.click(screen.getByTestId('bulk-send-confirm'));
    await vi.waitFor(() =>
      expect(screen.getByTestId('bulk-send-pin-msg').textContent).toContain('issuePin.wrong'),
    );
    expect(h.sendAsync).toHaveBeenCalledTimes(1);
  });
});
