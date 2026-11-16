import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as MailApi from '@/features/mail/api';
import type { MailContext, MailPreview, OutboundEmail } from '@/features/mail/api';
import { DocumentMailCard } from '@/features/mail/components/document-mail-card';
import { MailComposer } from '@/features/mail/components/mail-composer';
import common from '@/locales/th/common.json';
import mail from '@/locales/th/mail.json';
import platform from '@/locales/th/platform.json';

const h = vi.hoisted(() => ({
  ctx: null as unknown,
  preview: null as unknown,
  previewBodies: [] as unknown[],
  pdf: { status: 'ready', jobId: 'job-1', filename: 'QT.pdf', retry: vi.fn() },
  send: vi.fn(),
  makeLink: vi.fn(),
  outbox: { isPending: false, isError: false, data: { pages: [{ data: [] as unknown[] }] } },
  roles: ['platform_sales'] as string[],
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock('@/lib/membership', () => ({ useMembership: () => ({ roles: h.roles, permissions: [] }) }));
vi.mock('@/features/mail/api', async (orig) => ({
  ...(await orig<typeof MailApi>()),
  useMailContext: () => ({ isPending: false, isError: false, data: h.ctx }),
  useMailPreview: (body: unknown) => {
    h.previewBodies.push(body);
    return {
      data: body ? h.preview : undefined,
      isFetching: false,
      isPlaceholderData: false,
      isError: false,
    };
  },
  useMailPdf: () => h.pdf,
  useSendMail: () => ({ mutateAsync: h.send, isPending: false }),
  useMakeQuoteLink: () => ({ mutateAsync: h.makeLink, isPending: false }),
  useOutbox: () => h.outbox,
}));

const i18n = i18next.createInstance();
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'th',
    resources: { th: { mail, platform, common } },
    defaultNS: 'mail',
    interpolation: { escapeValue: false },
  });
});
beforeEach(() => {
  h.ctx = ctx();
  h.preview = preview();
  h.previewBodies = [];
  h.pdf = { status: 'ready', jobId: 'job-1', filename: 'QT.pdf', retry: vi.fn() };
  h.send.mockResolvedValue({ duplicate: false, email: {} });
  h.roles = ['platform_sales'];
  h.outbox = { isPending: false, isError: false, data: { pages: [{ data: [] }] } };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function ctx(over: Partial<MailContext> = {}): MailContext {
  return {
    kind: 'quotation',
    from: 'ฝ่ายขาย CoreUp Business Solutions <sales@coreup.pro>',
    replyTo: 'sales@coreup.pro',
    bcc: 'coreup.pro@gmail.com',
    me: { email: 'owner@coreup.pro' },
    document: {
      id: 'd1',
      type: 'quotation',
      number: 'QT-000000-0001',
      customerName: 'บริษัท ตัวอย่าง จำกัด',
      project: 'ระบบจองคิว',
      totalMinor: 1_200_000,
      status: 'sent',
    },
    to: 'customer@example.test',
    subject: 'ใบเสนอราคา QT-000000-0001 – ระบบจองคิว',
    body: 'เรียน บริษัท ตัวอย่าง จำกัด\n\nหากมีข้อสงสัย โทร 093-975-1589\nwww.coreup.pro',
    shareUrl: null,
    canMakeLink: true,
    needsPin: false,
    ...over,
  };
}
function preview(over: Partial<MailPreview> = {}): MailPreview {
  return {
    from: 'ฝ่ายขาย CoreUp Business Solutions <sales@coreup.pro>',
    replyTo: 'sales@coreup.pro',
    to: ['customer@example.test'],
    cc: [],
    bcc: ['coreup.pro@gmail.com'],
    subject: 'ใบเสนอราคา QT-000000-0001 – ระบบจองคิว',
    html: '<div>เรียน <a href="https://www.coreup.pro">www.coreup.pro</a></div>',
    text: 'x',
    attachments: [{ name: 'QT-000000-0001.pdf', size: 1000 }],
    isTest: false,
    ...over,
  };
}

const show = (kind: 'quotation' | 'invoice' | 'free' = 'quotation') =>
  render(
    <I18nextProvider i18n={i18n}>
      <MailComposer kind={kind} documentId={kind === 'free' ? undefined : 'd1'} onClose={vi.fn()} />
    </I18nextProvider>,
  );
const sendButton = () => screen.getByTestId('mail-send');

describe('MailComposer', () => {
  it('prefills the letter from the template and shows the live preview: sender, recipient, subject, PDF chip, rendered HTML with the link', async () => {
    show();
    expect((screen.getByLabelText('ถึง') as HTMLInputElement).value).toBe('customer@example.test');
    expect((screen.getByLabelText('หัวข้อ') as HTMLInputElement).value).toBe(
      'ใบเสนอราคา QT-000000-0001 – ระบบจองคิว',
    );
    expect((screen.getByLabelText('เนื้อหา') as HTMLTextAreaElement).value).toContain('www.coreup.pro');
    await waitFor(() => expect(screen.getByTestId('mail-preview-frame')).toBeTruthy());
    const head = screen.getByTestId('mail-preview-head').textContent ?? '';
    expect(head).toContain('ฝ่ายขาย CoreUp Business Solutions <sales@coreup.pro>');
    expect(head).toContain('customer@example.test');
    expect(head).toContain('coreup.pro@gmail.com');
    expect(head).toContain('ลูกค้าไม่เห็น');
    expect(screen.getByTestId('mail-preview').textContent).toContain('QT-000000-0001.pdf');
    expect(screen.getByTestId('mail-preview-frame').getAttribute('srcdoc')).toContain(
      '<a href="https://www.coreup.pro">',
    );
    expect(screen.getByTestId('mail-preview-frame').getAttribute('sandbox')).toBe('');
    expect(screen.getByTestId('mail-preview').textContent).toContain('sales@coreup.pro (Gmail CoreUp)');
  });

  it('asks for the preview of the preview body with the PDF job and the typed recipients', async () => {
    show();
    fireEvent.change(screen.getByLabelText('CC (ถ้ามี)'), { target: { value: 'a@x.com, b@y.com' } });
    await waitFor(() =>
      expect(h.previewBodies.at(-1)).toMatchObject({
        kind: 'quotation',
        documentId: 'd1',
        to: ['customer@example.test'],
        cc: ['a@x.com', 'b@y.com'],
        attachPdf: true,
        pdfJobId: 'job-1',
        test: false,
      }),
    );
  });

  it('the real send waits for the preview of the current text, a bad address, and a PDF still rendering', async () => {
    show();
    // right after typing the preview is of older text: blocked with the reason
    fireEvent.change(screen.getByLabelText('เนื้อหา'), { target: { value: 'ข้อความใหม่' } });
    fireEvent.click(sendButton());
    expect(h.toast.warning).toHaveBeenCalledWith(mail.problem.previewFirst, expect.anything());
    await waitFor(() => expect(sendButton().getAttribute('data-blocked')).toBeNull());

    fireEvent.change(screen.getByLabelText('ถึง'), { target: { value: 'not-an-email' } });
    expect(sendButton().getAttribute('data-blocked')).toBe('true');
    fireEvent.click(sendButton());
    expect(h.toast.warning).toHaveBeenCalledWith('อีเมลไม่ถูกต้อง: not-an-email', expect.anything());
    fireEvent.change(screen.getByLabelText('ถึง'), { target: { value: '' } });
    fireEvent.click(sendButton());
    expect(h.toast.warning).toHaveBeenCalledWith(mail.problem.noRecipient, expect.anything());
    fireEvent.change(screen.getByLabelText('ถึง'), { target: { value: 'a@b.com' } });

    cleanup();
    h.pdf = {
      status: 'rendering',
      jobId: null as unknown as string,
      filename: null as unknown as string,
      retry: vi.fn(),
    };
    show();
    await waitFor(() => expect(screen.getByTestId('mail-preview-frame')).toBeTruthy());
    fireEvent.click(sendButton());
    expect(h.toast.warning).toHaveBeenCalledWith(mail.problem.pdfRendering, expect.anything());
    expect(h.send).not.toHaveBeenCalled();
  });

  it('one confirm shows the recipient; a double click on "ส่ง" sends once, with the same idempotency key on a retry', async () => {
    let release: (v: unknown) => void = () => undefined;
    h.send.mockImplementationOnce(
      () =>
        new Promise((r) => {
          release = r;
        }),
    );
    show();
    await waitFor(() => expect(sendButton().getAttribute('data-blocked')).toBeNull());
    fireEvent.click(sendButton());
    const dialog = await screen.findByText(mail.confirm.title);
    expect(dialog).toBeTruthy();
    const summary = screen.getByTestId('mail-confirm-summary').textContent ?? '';
    expect(summary).toContain('customer@example.test');
    expect(summary).toContain('sales@coreup.pro');
    expect(screen.getByText(/coreup\.pro@gmail\.com \(ลูกค้าไม่เห็น\)/)).toBeTruthy();

    const buttons = screen.getAllByRole('button', { name: 'ส่งให้ลูกค้า' });
    const confirm = buttons.at(-1) as HTMLElement;
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(h.send).toHaveBeenCalledTimes(1);
    const first = h.send.mock.calls[0]?.[0];
    expect(first).toMatchObject({
      kind: 'quotation',
      documentId: 'd1',
      to: ['customer@example.test'],
      test: false,
      attachPdf: true,
      pdfJobId: 'job-1',
    });
    expect(first.pin).toBeUndefined();
    release({ duplicate: false, email: {} });
    await waitFor(() => expect(h.toast.success).toHaveBeenCalled());
  });

  it('a retry after a 503 / network error keeps the same idempotency key; an edited text gets a new one', async () => {
    h.send.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 503 }));
    h.send.mockRejectedValueOnce(new Error('network'));
    show();
    const press = async () => {
      await waitFor(() => expect(sendButton().getAttribute('data-blocked')).toBeNull());
      fireEvent.click(sendButton());
      const buttons = await screen.findAllByRole('button', { name: 'ส่งให้ลูกค้า' });
      fireEvent.click(buttons.at(-1) as HTMLElement);
    };
    await press();
    await waitFor(() => expect(h.send).toHaveBeenCalledTimes(1));
    await press();
    await waitFor(() => expect(h.send).toHaveBeenCalledTimes(2));
    expect(h.send.mock.calls[1]?.[0].idempotencyKey).toBe(h.send.mock.calls[0]?.[0].idempotencyKey);
    fireEvent.change(screen.getByLabelText('เนื้อหา'), { target: { value: 'ข้อความที่แก้แล้ว' } });
    await press();
    await waitFor(() => expect(h.send).toHaveBeenCalledTimes(3));
    expect(h.send.mock.calls[2]?.[0].idempotencyKey).not.toBe(h.send.mock.calls[0]?.[0].idempotencyKey);
  });

  it('the sample goes to the logged-in user only (a read-only address), flagged test, without CC, with no confirm for a quotation', async () => {
    show();
    const to = screen.getByLabelText(mail.test.label) as HTMLInputElement;
    expect(to.value).toBe('owner@coreup.pro');
    expect(to.readOnly).toBe(true);
    fireEvent.change(screen.getByLabelText('CC (ถ้ามี)'), { target: { value: 'a@x.com' } });
    fireEvent.click(screen.getByTestId('mail-send-test'));
    await waitFor(() => expect(h.send).toHaveBeenCalledTimes(1));
    expect(h.send.mock.calls[0]?.[0]).toMatchObject({
      test: true,
      to: ['owner@coreup.pro'],
      cc: [],
      kind: 'quotation',
      documentId: 'd1',
    });
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('ส่งตัวอย่างถึง owner@coreup.pro แล้ว'));
    // two samples are two intents: two keys
    fireEvent.click(screen.getByTestId('mail-send-test'));
    await waitFor(() => expect(h.send).toHaveBeenCalledTimes(2));
    expect(h.send.mock.calls[1]?.[0].idempotencyKey).not.toBe(h.send.mock.calls[0]?.[0].idempotencyKey);
  });

  it('without an account email there is no sample', () => {
    h.ctx = ctx({ me: { email: '' } });
    show();
    fireEvent.click(screen.getByTestId('mail-send-test'));
    expect(h.toast.warning).toHaveBeenCalledWith(mail.problem.testAddress, expect.anything());
    expect(h.send).not.toHaveBeenCalled();
  });

  it('an invoice asks for the team PIN on the confirm (and on a sample), and sends it with the request', async () => {
    h.ctx = ctx({
      kind: 'invoice',
      needsPin: true,
      canMakeLink: false,
      document: {
        ...(ctx().document as NonNullable<MailContext['document']>),
        type: 'invoice',
        number: 'IV-202611-0001',
      },
    });
    show('invoice');
    await waitFor(() => expect(sendButton().getAttribute('data-blocked')).toBeNull());
    fireEvent.click(sendButton());
    const pin = await screen.findByTestId('mail-pin-pin');
    expect(screen.getByTestId('mail-confirm-summary').textContent).toContain('customer@example.test');
    fireEvent.change(pin, { target: { value: '1111' } });
    fireEvent.click(screen.getByTestId('mail-pin-confirm'));
    await waitFor(() => expect(h.send).toHaveBeenCalledTimes(1));
    expect(h.send.mock.calls[0]?.[0]).toMatchObject({ kind: 'invoice', pin: '1111', test: false });
  });

  it('free-form: no document, no PDF switch, nothing prefilled but the template', async () => {
    h.ctx = ctx({
      kind: 'free',
      document: null,
      to: '',
      subject: 'CoreUp Business Solutions',
      body: 'เรียน ท่านผู้เกี่ยวข้อง',
      canMakeLink: false,
    });
    show('free');
    expect(screen.queryByLabelText(/แนบ PDF/)).toBeNull();
    expect(screen.queryByTestId('mail-link')).toBeNull();
    expect((screen.getByLabelText('ถึง') as HTMLInputElement).value).toBe('');
    fireEvent.click(sendButton());
    expect(h.toast.warning).toHaveBeenCalledWith(mail.problem.noRecipient, expect.anything());
  });

  it('offers to create the link, and the letter gets the link line', async () => {
    h.makeLink.mockResolvedValue({ url: 'https://coreup.biz/q/tok' });
    h.ctx = ctx({ body: 'ก\n\nหากมีข้อสงสัย ข' });
    show();
    fireEvent.click(within(screen.getByTestId('mail-link')).getByRole('button', { name: 'สร้างลิงก์' }));
    await waitFor(() =>
      expect((screen.getByLabelText('เนื้อหา') as HTMLTextAreaElement).value).toContain(
        '(ดูใบเสนอราคาออนไลน์ได้ที่ https://coreup.biz/q/tok)',
      ),
    );
  });
});

describe('DocumentMailCard', () => {
  const sent = (over: Partial<OutboundEmail> = {}): OutboundEmail => ({
    id: 'm1',
    kind: 'quotation',
    isTest: false,
    documentId: 'd1',
    documentNumber: 'QT-000000-0001',
    from: 'x',
    to: ['customer@example.test'],
    cc: [],
    bcc: [],
    subject: 's',
    attachments: [],
    status: 'delivered',
    error: null,
    sentBy: { id: 'u1', name: 'Owner' },
    resendId: 'r1',
    createdAt: '2026-11-16T05:29:00.000Z',
    sentAt: '2026-11-16T05:30:00.000Z',
    deliveredAt: '2026-11-16T05:30:30.000Z',
    openedAt: null,
    failedAt: null,
    ...over,
  });
  const card = (type: 'quotation' | 'invoice' = 'quotation') =>
    render(
      <I18nextProvider i18n={i18n}>
        <DocumentMailCard doc={{ id: 'd1', type }} />
      </I18nextProvider>,
    );

  it('lists what was sent: "ส่งเมลแล้ว 16 พ.ย. 12:30 → address · ถึงแล้ว"', () => {
    h.outbox = {
      isPending: false,
      isError: false,
      data: {
        pages: [
          { data: [sent(), sent({ id: 'm2', isTest: true, status: 'sent', to: ['owner@coreup.pro'] })] },
        ],
      },
    };
    card();
    const lines = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(lines[0]).toContain('ส่งเมลแล้ว 16 พ.ย. 12:30 → customer@example.test · ถึงแล้ว');
    expect(lines[1]).toContain('ส่งตัวอย่าง');
    expect(lines[1]).toContain('ตัวอย่าง');
    expect(screen.getByText(/ลูกค้าตอบกลับไปที่ sales@coreup.pro \(Gmail CoreUp\)/)).toBeTruthy();
  });

  it('empty history says so; the button is for the owner and sales (quotation), open for an invoice', () => {
    card();
    expect(screen.getByText(mail.card.empty)).toBeTruthy();
    expect(screen.getByTestId('mail-open')).toBeTruthy();
    cleanup();
    h.roles = ['platform_admin'];
    card();
    expect(screen.queryByTestId('mail-open')).toBeNull();
    cleanup();
    card('invoice');
    expect(screen.getByTestId('mail-open')).toBeTruthy();
  });
});
