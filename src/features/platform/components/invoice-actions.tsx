import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { type Invoice, useDeleteInvoice, useInvoices, usePatchInvoice, useSendInvoice } from '../api';
import { dmyBE } from '../billing-docs';
import { formatDate, formatMoney, useIntlLocale } from '../format';
import { isOtherInvoice, mailsBill } from '../invoice-slip';

/** A draft has no INV number yet (its stored number is a placeholder), so the screens say "ฉบับร่าง" instead. */
export function useNumberLabel() {
  const { t } = useTranslation('platform');
  return (i: Pick<Invoice, 'status' | 'number'>) =>
    i.status === 'draft' ? t('invoices.draft.number') : i.number;
}

/** The confirm dialogs of the invoice flow share one shell: title, what will happen, what the invoice is, two buttons. */
function ConfirmDialog({
  testId,
  title,
  description,
  confirmLabel,
  destructive,
  pending,
  blockedReason,
  onClose,
  onConfirm,
  children,
}: {
  testId: string;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  pending: boolean;
  blockedReason?: string | false;
  onClose: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation('platform');
  // a second click inside the same frame (before `pending` is rendered) must not fire the action again
  const fired = useRef(false);
  useEffect(() => {
    if (!pending) fired.current = false;
  }, [pending]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        closeLabel={t('common.close')}
        className="max-h-[92dvh] overflow-y-auto"
        data-testid={testId}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending}
            blockedReason={blockedReason}
            data-testid={`${testId}-confirm`}
            onClick={() => {
              if (fired.current) return;
              fired.current = true;
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** What the customer is billed: the shop, the lines (or the package), the total and the dates. */
function InvoiceFacts({ invoice, recipients }: { invoice: Invoice; recipients?: boolean }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const numberLabel = useNumberLabel();
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm" data-testid="invoice-facts">
      <dt className="text-muted-foreground">{t('invoices.col.shop')}</dt>
      <dd className="font-medium">{invoice.tenantName}</dd>
      <dt className="text-muted-foreground">{t('invoices.col.number')}</dt>
      <dd className="font-medium">{numberLabel(invoice)}</dd>
      {recipients ? (
        <>
          <dt className="text-muted-foreground">{t('invoices.draft.recipients')}</dt>
          <dd className="min-w-0 font-medium" data-testid="recipients">
            {!mailsBill(invoice) ? (
              <span className="text-muted-foreground">{t('invoices.draft.noMailKind')}</span>
            ) : invoice.recipients.length > 0 ? (
              invoice.recipients.map((e) => (
                <span key={e} className="block break-all">
                  {e}
                </span>
              ))
            ) : (
              <span className="text-destructive">{t('invoices.draft.noRecipients')}</span>
            )}
          </dd>
        </>
      ) : null}
      <dt className="text-muted-foreground">{t('invoices.draft.items')}</dt>
      <dd className="min-w-0 font-medium" data-testid="items">
        {isOtherInvoice(invoice) ? (
          invoice.otherLines.map((l, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: read-only list
            <span key={i} className="block break-words">
              {l.description} × {l.quantity} — {formatMoney(l.amountMinor, locale)}
            </span>
          ))
        ) : (
          <>
            {invoice.planName ?? '–'}
            {invoice.periodStart && invoice.periodEnd ? (
              <span className="block text-xs font-normal text-muted-foreground">
                {dmyBE(invoice.periodStart)}–{dmyBE(invoice.periodEnd)}
              </span>
            ) : null}
          </>
        )}
      </dd>
      <dt className="text-muted-foreground">{t('invoices.col.total')}</dt>
      <dd className="font-medium" data-testid="total">
        {formatMoney(invoice.totalMinor, locale)}
      </dd>
      <dt className="text-muted-foreground">{t('invoices.col.due')}</dt>
      <dd className="font-medium">{formatDate(invoice.dueOn, locale)}</dd>
    </dl>
  );
}

/**
 * "ส่งให้ลูกค้า": the only step that emails the bill. Shows who gets the email and what is billed; a package invoice can
 * void the shop's older unpaid package invoices in the same step (moved here from creation: a draft must not touch the
 * shop's current bill before it is sent).
 */
export function SendInvoiceDialog({
  invoice,
  onClose,
  onSent,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSent?: (sent: Invoice) => void;
}) {
  const { t } = useTranslation('platform');
  const send = useSendInvoice();
  const patch = usePatchInvoice();
  const [voidOlder, setVoidOlder] = useState(false); // voiding a shop's older notice is opt-in, never the default
  const issued = useInvoices({ tenantId: invoice.tenantId, status: 'issued', source: 'subscription' });
  const overdue = useInvoices({ tenantId: invoice.tenantId, status: 'overdue', source: 'subscription' });
  const older = invoice.sourceId
    ? [...(issued.data ?? []), ...(overdue.data ?? [])].filter(
        (i) => i.tenantId === invoice.tenantId && i.id !== invoice.id && i.sourceId !== null,
      )
    : [];
  // money may be on its way for an old invoice with a slip: voiding it is refused (same rule as a shop's own checkout)
  const inReview = older.some((i) => i.slipUploadedAt !== null);

  return (
    <ConfirmDialog
      testId="send-invoice"
      title={t('invoices.draft.sendTitle')}
      description={t('invoices.draft.sendHint')}
      confirmLabel={t('invoices.draft.send')}
      pending={send.isPending}
      blockedReason={voidOlder && inReview && t('invoices.draft.paymentInReview')}
      onClose={onClose}
      onConfirm={() =>
        send.mutate(invoice.id, {
          onSuccess: async (res) => {
            let failed = 0;
            if (voidOlder)
              for (const i of older) {
                try {
                  await patch.mutateAsync({ id: i.id, body: { status: 'void' } });
                } catch {
                  failed++; // the mutation already toasted the API's reason
                }
              }
            toast.success(t('invoices.draft.sentToast', { number: res.data.number }));
            if (failed > 0) toast.error(t('invoices.draft.voidOlderFailed', { count: failed }));
            onSent?.(res.data);
            onClose();
          },
        })
      }
    >
      <InvoiceFacts invoice={invoice} recipients />
      {older.length > 0 ? (
        <label className="flex items-start gap-2 text-sm" htmlFor="void-older">
          <Checkbox
            id="void-older"
            checked={voidOlder}
            onCheckedChange={(v) => setVoidOlder(v === true)}
            className="mt-0.5"
          />
          <span>{t('invoices.draft.voidOlder', { count: older.length })}</span>
        </label>
      ) : null}
      {voidOlder && inReview ? (
        <p className="text-sm text-destructive" role="alert" data-testid="older-in-review">
          {t('invoices.draft.paymentInReview')}
        </p>
      ) : null}
      <p className="rounded-md bg-muted p-2 text-xs" data-testid="send-warning">
        {t(
          mailsBill(invoice) && invoice.recipients.length > 0
            ? 'invoices.draft.sendWarning'
            : 'invoices.draft.sendWarningNoMail',
        )}
      </p>
    </ConfirmDialog>
  );
}

/** "ยกเลิกบิล": asks first and says plainly that nobody is emailed or told. */
export function VoidInvoiceDialog({
  invoice,
  onClose,
  onDone,
}: {
  invoice: Invoice;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { t } = useTranslation('platform');
  const patch = usePatchInvoice();
  const numberLabel = useNumberLabel();
  return (
    <ConfirmDialog
      testId="void-invoice"
      title={t('invoices.voidTitle', { number: numberLabel(invoice) })}
      description={t('invoices.voidHint')}
      confirmLabel={t('invoices.void')}
      destructive
      pending={patch.isPending}
      onClose={onClose}
      onConfirm={() =>
        patch.mutate(
          { id: invoice.id, body: { status: 'void' } },
          {
            onSuccess: () => {
              toast.success(t('invoices.voidedToast', { number: numberLabel(invoice) }));
              onDone?.();
              onClose();
            },
          },
        )
      }
    >
      <InvoiceFacts invoice={invoice} />
      <p className="rounded-md bg-muted p-2 text-xs" data-testid="void-no-mail">
        {t('invoices.voidNoMail')}
      </p>
      {invoice.status === 'paid' ? (
        <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive" data-testid="void-paid-warning">
          {t('invoices.voidPaidWarning', { receipt: invoice.receiptNumber ?? '-' })}
        </p>
      ) : null}
    </ConfirmDialog>
  );
}

/** Delete a draft for good (it was never sent and holds no number). */
export function DeleteDraftDialog({
  invoice,
  onClose,
  onDone,
}: {
  invoice: Invoice;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { t } = useTranslation('platform');
  const del = useDeleteInvoice();
  return (
    <ConfirmDialog
      testId="delete-draft"
      title={t('invoices.draft.deleteTitle')}
      description={t('invoices.draft.deleteHint')}
      confirmLabel={t('invoices.draft.delete')}
      destructive
      pending={del.isPending}
      onClose={onClose}
      onConfirm={() =>
        del.mutate(invoice.id, {
          onSuccess: () => {
            toast.success(t('invoices.draft.deletedToast'));
            onDone?.();
            onClose();
          },
        })
      }
    >
      <InvoiceFacts invoice={invoice} />
    </ConfirmDialog>
  );
}

/**
 * "ยืนยันรับเงิน": confirming also emails the receipt (package and one-off invoices) — say to whom before it happens.
 * The caller runs the right mutation (`confirm-payment`, or the status PATCH for a consulting invoice).
 */
export function ConfirmPaymentDialog({
  invoice,
  pending,
  onClose,
  onConfirm,
}: {
  invoice: Invoice;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation('platform');
  const numberLabel = useNumberLabel();
  const mailsReceipt = mailsBill(invoice);
  const mail = !mailsReceipt
    ? t('invoices.confirmPay.noMail')
    : invoice.recipients.length > 0
      ? t('invoices.confirmPay.mail', { email: invoice.recipients.join(', ') })
      : t('invoices.confirmPay.noRecipient');
  return (
    <ConfirmDialog
      testId="confirm-payment"
      title={t('invoices.confirmPay.title', { number: numberLabel(invoice) })}
      description={t('invoices.confirmPay.hint')}
      confirmLabel={t('invoices.confirmPay.button')}
      pending={pending}
      onClose={onClose}
      onConfirm={onConfirm}
    >
      <InvoiceFacts invoice={invoice} />
      <p className="rounded-md bg-muted p-2 text-xs" data-testid="receipt-mail">
        {mail}
      </p>
    </ConfirmDialog>
  );
}

/**
 * "ส่งที่เลือก": one confirm for several drafts (the monthly run makes one per shop). Lists every shop with who gets the
 * email and the total; then sends them one after the other — each send is its own atomic step, so a failure leaves the
 * rest sent and the failed one still a draft.
 */
export function BulkSendDialog({
  invoices,
  onClose,
  onDone,
}: {
  invoices: Invoice[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const send = useSendInvoice();
  const [busy, setBusy] = useState(false);
  const total = invoices.reduce((s, i) => s + i.totalMinor, 0);

  const run = async () => {
    setBusy(true);
    let ok = 0;
    for (const i of invoices) {
      try {
        await send.mutateAsync(i.id);
        ok++;
      } catch {
        // the failed one shows its own reason (toast from the mutation) and stays a draft
      }
    }
    setBusy(false);
    const done = t('invoices.draft.bulkDone', { ok, total: invoices.length });
    if (ok === invoices.length) toast.success(done);
    else toast.warning(done);
    onDone();
    onClose();
  };

  return (
    <ConfirmDialog
      testId="bulk-send"
      title={t('invoices.draft.bulkTitle', { count: invoices.length })}
      description={t('invoices.draft.bulkHint')}
      confirmLabel={t('invoices.draft.bulkSend', { count: invoices.length })}
      pending={busy}
      onClose={onClose}
      onConfirm={() => void run()}
    >
      <ul className="grid max-h-[40dvh] gap-2 overflow-y-auto text-sm" data-testid="bulk-list">
        {invoices.map((i) => (
          <li key={i.id} className="rounded-md border p-2" data-testid="bulk-row">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 break-words font-medium">{i.tenantName}</span>
              <span className="whitespace-nowrap">{formatMoney(i.totalMinor, locale)}</span>
            </div>
            <div className="break-all text-xs text-muted-foreground">
              {!mailsBill(i)
                ? t('invoices.draft.noMailKind')
                : i.recipients.length > 0
                  ? i.recipients.join(', ')
                  : t('invoices.draft.noRecipients')}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm font-medium" data-testid="bulk-total">
        {t('invoices.draft.bulkTotal', { total: formatMoney(total, locale) })}
      </p>
      <p className="rounded-md bg-muted p-2 text-xs">{t('invoices.draft.sendWarning')}</p>
    </ConfirmDialog>
  );
}
