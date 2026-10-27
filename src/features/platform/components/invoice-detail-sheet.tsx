import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { type Invoice, useConfirmPayment, usePlans, useRejectSlip } from '../api';
import { dmyBE } from '../billing-docs';
import { formatDate, formatDateTime, formatMoney, useIntlLocale } from '../format';
import { hasPendingSlip, slipCheckTone } from '../invoice-slip';
import { copyLineMessage } from './issue-invoice-dialog';

/** A slip is a photo or a PDF; the URL is presigned, so look at the file name in the path, not the query string. */
const isPdf = (url: string) => new URL(url, window.location.origin).pathname.toLowerCase().endsWith('.pdf');

function SlipFile({ url }: { url: string }) {
  const { t } = useTranslation('platform');
  const [broken, setBroken] = useState(false);
  return (
    <div className="grid gap-2">
      {isPdf(url) ? (
        <iframe title={t('invoices.slip.file')} src={url} className="h-96 w-full rounded-lg border" />
      ) : broken ? (
        <p className="text-sm text-destructive">{t('invoices.slip.broken')}</p>
      ) : (
        <img
          src={url}
          alt={t('invoices.slip.file')}
          className="max-h-96 w-full rounded-lg border bg-muted object-contain"
          onError={() => setBroken(true)}
        />
      )}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
      >
        <ExternalLink className="size-4" aria-hidden /> {t('invoices.slip.open')}
      </a>
    </div>
  );
}

/** The automatic slip check verdict (EasySlip, or the free basic QR + duplicate check) next to the slip; the admin still decides. */
function SlipCheckBox({
  check,
  totalMinor,
}: {
  check: NonNullable<Invoice['slipCheck']>;
  totalMinor: number;
}) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  return (
    <div className="grid gap-1.5 rounded-lg border p-3 text-sm" data-testid="slip-check">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{t('invoices.slip.check.title')}</span>
        <Badge variant={slipCheckTone[check.status]}>{t(`invoices.slip.check.status.${check.status}`)}</Badge>
      </div>
      {check.reasons.length > 0 ? (
        <p className="text-muted-foreground">
          {check.reasons.map((r) => t(`invoices.slip.check.reason.${r}`)).join(' · ')}
        </p>
      ) : null}
      {check.amountMinor !== null ? (
        <p>
          {t('invoices.slip.check.amount', {
            read: formatMoney(check.amountMinor, locale),
            due: formatMoney(totalMinor, locale),
          })}
        </p>
      ) : null}
      {check.receiverName ? <p>{t('invoices.slip.check.receiver', { name: check.receiverName })}</p> : null}
      {check.paidAt ? (
        <p>{t('invoices.slip.check.paidAt', { at: formatDateTime(check.paidAt, locale) })}</p>
      ) : null}
      {check.method === 'basic' ? (
        <p className="text-xs text-muted-foreground" data-testid="slip-check-basic-note">
          {t('invoices.slip.check.basicNote')}
        </p>
      ) : null}
    </div>
  );
}

/** Proof that the payer accepted the terms on the pay page. */
function Acceptance({ a }: { a: NonNullable<Invoice['termsAcceptance']> }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  return (
    <div className="grid gap-1 rounded-lg border bg-muted/40 p-3 text-sm" data-testid="terms-acceptance">
      <p className="font-medium">{t('invoices.acceptance.title', { version: a.version })}</p>
      <p>{t('invoices.acceptance.by', { name: a.name, at: formatDateTime(a.acceptedAt, locale) })}</p>
      <p className="break-all text-xs text-muted-foreground">
        {[
          a.ip ? `IP ${a.ip}` : null,
          a.userId ? t('invoices.acceptance.signedIn') : t('invoices.acceptance.anonymous'),
          a.userAgent,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  );
}

function Review({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const confirm = useConfirmPayment();
  const reject = useRejectSlip();
  const plans = usePlans();
  const [note, setNote] = useState('');
  const busy = confirm.isPending || reject.isPending;
  const pending = hasPendingSlip(invoice);
  const open = invoice.status === 'issued' || invoice.status === 'overdue';
  const plan = (plans.data ?? []).find((p) => p.id === invoice.sourceId);

  const rows: [string, string][] = [
    [t('invoices.col.shop'), invoice.tenantName],
    [
      t('invoices.col.source'),
      `${t(`invoiceSource.${invoice.source}`)}${invoice.selfServe ? ` · ${t('invoices.selfServe')}` : ''}`,
    ],
    ...(invoice.planName ? ([[t('invoices.col.plan'), invoice.planName]] as [string, string][]) : []),
    ...(invoice.periodStart && invoice.periodEnd
      ? ([[t('invoices.col.period'), `${dmyBE(invoice.periodStart)}–${dmyBE(invoice.periodEnd)}`]] as [
          string,
          string,
        ][])
      : []),
    [t('invoices.col.total'), formatMoney(invoice.totalMinor, locale)],
    [t('invoices.col.due'), formatDate(invoice.dueOn, locale)],
    ...(invoice.receiptNumber
      ? ([[t('invoices.col.receipt'), invoice.receiptNumber]] as [string, string][])
      : []),
    ...(invoice.slipUploadedAt
      ? ([[t('invoices.slip.sentAt'), formatDateTime(invoice.slipUploadedAt, locale)]] as [string, string][])
      : []),
  ];

  return (
    <div className="grid gap-5">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {invoice.source === 'subscription' ? (
        invoice.termsAcceptance ? (
          <Acceptance a={invoice.termsAcceptance} />
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="terms-none">
            {t('invoices.acceptance.none')}
          </p>
        )
      ) : null}
      {open && plan ? (
        <Button
          variant="outline"
          data-testid="copy-line-message"
          onClick={() =>
            void copyLineMessage(invoice, plan).then(
              () => toast.success(t('issueInvoice.copied')),
              () => toast.error(t('issueInvoice.copyFailed')),
            )
          }
        >
          {t('issueInvoice.copyLine')}
        </Button>
      ) : null}
      {pending ? (
        <>
          {invoice.slipCheck ? (
            <SlipCheckBox check={invoice.slipCheck} totalMinor={invoice.totalMinor} />
          ) : null}
          {invoice.slipUrl ? (
            <SlipFile url={invoice.slipUrl} />
          ) : (
            <p className="text-sm">{t('invoices.slip.none')}</p>
          )}
          <Button
            disabled={busy}
            onClick={() =>
              confirm.mutate(invoice.id, {
                onSuccess: () => {
                  toast.success(
                    t(`invoices.slip.confirmedToast.${invoice.addon ?? 'plan'}`, { number: invoice.number }),
                  );
                  onClose();
                },
              })
            }
          >
            {t('invoices.slip.confirm')}
          </Button>
          <p className="-mt-3 text-xs text-muted-foreground">{t('invoices.slip.confirmHint')}</p>
          <div className="grid gap-2 border-t pt-4">
            <Label htmlFor="slip-note">{t('invoices.slip.noteLabel')}</Label>
            <Textarea
              id="slip-note"
              rows={3}
              maxLength={500}
              value={note}
              placeholder={t('invoices.slip.notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              variant="outline"
              className="text-destructive"
              disabled={busy}
              blockedReason={note.trim() === '' && t('invoices.slip.noteNeeded')}
              onClick={() =>
                reject.mutate(
                  { id: invoice.id, note: note.trim() },
                  {
                    onSuccess: () => {
                      toast.success(t('invoices.slip.rejectedToast', { number: invoice.number }));
                      onClose();
                    },
                  },
                )
              }
            >
              {t('invoices.slip.reject')}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Invoice detail: package, period, who accepted the terms, the copyable LINE message — and for a transfer waiting to
 * be confirmed the slip next to the automatic check, then "confirm" (opens the package, issues the receipt) or "reject".
 */
export function InvoiceDetailSheet({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const { t } = useTranslation('platform');
  return (
    <Sheet open={invoice !== null} onOpenChange={(o) => (o ? undefined : onClose())}>
      <SheetContent closeLabel={t('common.close')} className="overflow-y-auto p-4 sm:max-w-lg">
        <SheetHeader className="p-0">
          <SheetTitle>
            {invoice && hasPendingSlip(invoice)
              ? t('invoices.slip.title', { number: invoice.number })
              : t('invoices.detailTitle', { number: invoice?.number })}
          </SheetTitle>
          <SheetDescription>{t('invoices.slip.description')}</SheetDescription>
        </SheetHeader>
        {invoice ? <Review key={invoice.id} invoice={invoice} onClose={onClose} /> : null}
      </SheetContent>
    </Sheet>
  );
}
