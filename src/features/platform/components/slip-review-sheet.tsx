import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { type Invoice, useConfirmPayment, useRejectSlip } from '../api';
import { formatDate, formatDateTime, formatMoney, useIntlLocale } from '../format';

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

function Review({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const confirm = useConfirmPayment();
  const reject = useRejectSlip();
  const [note, setNote] = useState('');
  const busy = confirm.isPending || reject.isPending;

  const rows: [string, string][] = [
    [t('invoices.col.shop'), invoice.tenantName],
    [t('invoices.col.source'), t(`invoiceSource.${invoice.source}`)],
    [t('invoices.col.total'), formatMoney(invoice.totalMinor, locale)],
    [t('invoices.col.due'), formatDate(invoice.dueOn, locale)],
    [t('invoices.slip.sentAt'), formatDateTime(invoice.slipUploadedAt, locale)],
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
              toast.success(t('invoices.slip.confirmedToast', { number: invoice.number }));
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
    </div>
  );
}

/** Slip review: the uploaded slip next to the invoice, then "confirm" (opens the package) or "reject" (with a note). */
export function SlipReviewSheet({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const { t } = useTranslation('platform');
  return (
    <Sheet open={invoice !== null} onOpenChange={(o) => (o ? undefined : onClose())}>
      <SheetContent closeLabel={t('common.close')} className="overflow-y-auto p-4 sm:max-w-lg">
        <SheetHeader className="p-0">
          <SheetTitle>{t('invoices.slip.title', { number: invoice?.number })}</SheetTitle>
          <SheetDescription>{t('invoices.slip.description')}</SheetDescription>
        </SheetHeader>
        {invoice ? <Review key={invoice.id} invoice={invoice} onClose={onClose} /> : null}
      </SheetContent>
    </Sheet>
  );
}
