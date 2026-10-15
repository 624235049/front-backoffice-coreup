import { Link, useNavigate } from '@tanstack/react-router';
import {
  Ban,
  Banknote,
  CircleCheck,
  CircleX,
  ClockAlert,
  FileMinus2,
  FilePlus2,
  Paperclip,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, useIntlLocale } from '@/features/platform/format';
import { cn } from '@/lib/utils';
import {
  type AccDocument,
  type Payment,
  useConvertDocument,
  useQuotationStatus,
  useRecordPayment,
  useVoidDocument,
  useVoidPayment,
} from '../api';
import { A4Link, ExcelButton, PdfDownloadButton } from '../components/a4-actions';
import { DocStatusBadge } from '../components/badges';
import { DataTable, DtCell, DtHead, DtRow, DtTh } from '../components/data-table';
import { openFile } from '../components/file-field';
import { PaymentDialog } from '../components/payment-dialog';
import { TotalsPanel } from '../components/totals-panel';
import { VoidDialog } from '../components/void-dialog';
import { detailPath, kindOf, listPath } from '../lib/doc-meta';
import { formatAmount, formatQty } from '../lib/format';

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2 py-1 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** Issued / sent / paid / void documents: read-only with the actions that are valid for the current status. */
export function DocumentView({ doc }: { doc: AccDocument }) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const navigate = useNavigate();
  const kind = kindOf(doc.type);
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);

  const convert = useConvertDocument();
  const voidDoc = useVoidDocument();
  const voidPayment = useVoidPayment();
  const quotationStatus = useQuotationStatus();
  const recordPayment = useRecordPayment();

  const isVoid = doc.status === 'void';
  const isInvoice = doc.type === 'invoice';
  const isQuotation = doc.type === 'quotation';
  const canVoid = !isVoid && doc.status !== 'draft';
  const canPay = isInvoice && (doc.status === 'issued' || doc.status === 'partially_paid');
  const canCredit = (isInvoice || doc.type === 'tax_invoice') && !isVoid && doc.status !== 'draft';
  const canConvertQuotation = isQuotation && (doc.status === 'sent' || doc.status === 'accepted');
  const canMarkQuotation = isQuotation && (doc.status === 'sent' || doc.status === 'accepted');

  const totals = {
    linesTotalMinor: doc.linesTotalMinor,
    discountMinor: doc.discountMinor,
    taxableMinor: doc.taxableMinor,
    exemptMinor: doc.exemptMinor,
    vatMinor: doc.vatMinor,
    totalMinor: doc.totalMinor,
    whtMinor: doc.whtMinor,
    netMinor: doc.netMinor,
  };

  const goto = (d: { id: string; type: AccDocument['type'] }) =>
    void navigate({ to: detailPath(d.type, d.id) as never });

  const convertTo = async (to: 'invoice' | 'credit_note') => {
    const created = await convert.mutateAsync({ id: doc.id, to });
    toast.success(t(to === 'invoice' ? 'doc.convertedToInvoice' : 'doc.creditNoteCreated'));
    goto(created);
  };

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span>
              {t(`docType.${doc.type}`)} <span className="font-mono text-xl">{doc.number}</span>
            </span>
            <DocStatusBadge status={doc.status} overdue={doc.overdue} />
          </span>
        }
        description={
          <Link to={listPath(kind) as never} className="hover:underline">
            ← {t(`list.${kind}.title`)}
          </Link>
        }
        actions={
          <>
            <A4Link source={{ kind: 'document', id: doc.id }} />
            <PdfDownloadButton source={{ kind: 'document', id: doc.id }} />
            <ExcelButton source={{ kind: 'document', id: doc.id }} />
            {canPay ? (
              <Button onClick={() => setPaying(true)}>
                <Banknote /> {t('doc.recordPayment')}
              </Button>
            ) : null}
            {canConvertQuotation ? (
              <Button onClick={() => void convertTo('invoice')} disabled={convert.isPending}>
                <FilePlus2 /> {t('doc.convertToInvoice')}
              </Button>
            ) : null}
            {canCredit ? (
              <Button
                variant="outline"
                onClick={() => void convertTo('credit_note')}
                disabled={convert.isPending}
              >
                <FileMinus2 /> {t('doc.issueCreditNote')}
              </Button>
            ) : null}
            {canVoid ? (
              <Button variant="outline" className="text-destructive" onClick={() => setVoiding(true)}>
                <Ban /> {t('doc.void')}
              </Button>
            ) : null}
          </>
        }
      />

      {isVoid ? (
        <div
          className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="status"
        >
          <strong>{t('doc.voidedBanner')}</strong>
          {doc.voidReason ? ` — ${doc.voidReason}` : ''}
          {doc.voidedAt ? ` (${formatDate(doc.voidedAt, locale)})` : ''}
        </div>
      ) : null}

      {canMarkQuotation ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-navy-50 px-4 py-3">
          <span className="mr-2 text-sm font-medium text-navy-900">{t('doc.quotationAnswer')}</span>
          {doc.status === 'sent' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void quotationStatus.mutateAsync({ id: doc.id, status: 'accepted' })}
            >
              <CircleCheck /> {t('status.accepted')}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void quotationStatus.mutateAsync({ id: doc.id, status: 'rejected' })}
          >
            <CircleX /> {t('status.rejected')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void quotationStatus.mutateAsync({ id: doc.id, status: 'expired' })}
          >
            <ClockAlert /> {t('status.expired')}
          </Button>
        </div>
      ) : null}

      <div className="grid items-start gap-5 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('doc.customerSection')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <InfoRow label={t('contacts.name')}>
                  {doc.contactId ? <span className="font-medium">{doc.contact.name}</span> : doc.contact.name}
                </InfoRow>
                {doc.contact.taxId ? (
                  <InfoRow label={t('contacts.taxId')}>
                    {doc.contact.taxId}
                    {doc.contact.branchCode
                      ? ` · ${t('contacts.branchShort')} ${doc.contact.branchCode}`
                      : ''}
                  </InfoRow>
                ) : null}
                {doc.contact.address ? (
                  <InfoRow label={t('contacts.address')}>{doc.contact.address}</InfoRow>
                ) : null}
                <InfoRow label={t('doc.docDate')}>{formatDate(doc.docDate, locale)}</InfoRow>
                {doc.dueDate ? (
                  <InfoRow label={isQuotation ? t('doc.validUntil') : t('doc.dueDate')}>
                    {formatDate(doc.dueDate, locale)}
                  </InfoRow>
                ) : null}
                {doc.reference ? <InfoRow label={t('doc.reference')}>{doc.reference}</InfoRow> : null}
                {doc.refDocumentNumber && doc.refDocumentId ? (
                  <InfoRow label={t('doc.refDocument')}>
                    <Link
                      to={`/accounting/invoices/${doc.refDocumentId}` as never}
                      className="text-mint-700 hover:underline"
                    >
                      {doc.refDocumentNumber}
                    </Link>
                  </InfoRow>
                ) : null}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('doc.linesSection')}</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <DataTable maxHeight="max-h-none">
                <DtHead>
                  <DtTh className="w-10">#</DtTh>
                  <DtTh>{t('doc.line.description')}</DtTh>
                  <DtTh num>{t('doc.line.qty')}</DtTh>
                  <DtTh>{t('doc.line.unit')}</DtTh>
                  <DtTh num>{t('doc.line.unitPrice')}</DtTh>
                  <DtTh num>{t('doc.line.discount')}</DtTh>
                  <DtTh num>{t('doc.line.amount')}</DtTh>
                </DtHead>
                <tbody>
                  {doc.lines.map((l, i) => (
                    <DtRow key={l.id}>
                      <DtCell className="text-muted-foreground">{i + 1}</DtCell>
                      <DtCell className="min-w-48 whitespace-pre-wrap">
                        {l.description}
                        {l.vatType !== 'vat' && doc.vatMode !== 'none' ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({t(`vatType.${l.vatType}`)})
                          </span>
                        ) : null}
                      </DtCell>
                      <DtCell num>{formatQty(l.qty, locale)}</DtCell>
                      <DtCell>{l.unit ?? ''}</DtCell>
                      <DtCell num>{formatAmount(l.unitPriceMinor, locale)}</DtCell>
                      <DtCell num>{l.discountMinor ? formatAmount(l.discountMinor, locale) : '–'}</DtCell>
                      <DtCell num className="font-medium">
                        {formatAmount(l.amountMinor, locale)}
                      </DtCell>
                    </DtRow>
                  ))}
                </tbody>
              </DataTable>
              {doc.note ? (
                <div className="mt-4 text-sm">
                  <div className="text-xs text-muted-foreground">{t('doc.note')}</div>
                  <p className="whitespace-pre-wrap">{doc.note}</p>
                </div>
              ) : null}
              {doc.internalNote ? (
                <div className="mt-3 text-sm">
                  <div className="text-xs text-muted-foreground">{t('doc.internalNote')}</div>
                  <p className="whitespace-pre-wrap">{doc.internalNote}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {isInvoice && doc.payments.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('doc.paymentsSection')}</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <DataTable maxHeight="max-h-none">
                  <DtHead>
                    <DtTh>{t('payment.paidOn')}</DtTh>
                    <DtTh>{t('payment.method')}</DtTh>
                    <DtTh num>{t('payment.amount')}</DtTh>
                    <DtTh num>{t('payment.whtAmount')}</DtTh>
                    <DtTh>{t('doc.receiptCol')}</DtTh>
                    <DtTh>{t('col.status')}</DtTh>
                    <DtTh />
                  </DtHead>
                  <tbody>
                    {doc.payments.map((p) => (
                      <DtRow key={p.id} className={cn(p.status === 'void' && 'opacity-60')}>
                        <DtCell className="whitespace-nowrap">{formatDate(p.paidOn, locale)}</DtCell>
                        <DtCell>
                          {t(`method.${p.method}`)}
                          {p.account ? (
                            <span className="block text-xs text-muted-foreground">{p.account}</span>
                          ) : null}
                        </DtCell>
                        <DtCell num>{formatAmount(p.amountMinor, locale)}</DtCell>
                        <DtCell num>
                          {p.whtMinor > 0 ? formatAmount(p.whtMinor, locale) : '–'}
                          {p.whtCertificateFileId ? (
                            <button
                              type="button"
                              className="ml-2 inline-flex items-center text-mint-700 hover:underline"
                              aria-label={t('payment.whtCertificate')}
                              onClick={() =>
                                void openFile(p.whtCertificateFileId as string).catch(() =>
                                  toast.error(t('file.openFailed')),
                                )
                              }
                            >
                              <Paperclip className="size-3.5" />
                            </button>
                          ) : null}
                        </DtCell>
                        <DtCell className="whitespace-nowrap">
                          {p.receiptId ? (
                            <Link
                              to={`/accounting/receipts/${p.receiptId}` as never}
                              className="font-mono text-xs text-mint-700 hover:underline"
                            >
                              {p.receiptNumber ?? t('draftNumber')}
                            </Link>
                          ) : (
                            '–'
                          )}
                        </DtCell>
                        <DtCell>
                          <span className={p.status === 'void' ? 'text-destructive' : 'text-success'}>
                            {t(`payment.status.${p.status}`)}
                          </span>
                        </DtCell>
                        <DtCell>
                          {p.status === 'active' && !isVoid ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => setVoidingPayment(p)}
                            >
                              {t('payment.void')}
                            </Button>
                          ) : null}
                        </DtCell>
                      </DtRow>
                    ))}
                  </tbody>
                </DataTable>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-4 lg:sticky lg:top-20">
          <TotalsPanel totals={totals} vatMode={doc.vatMode} vatRateBp={doc.vatRateBp} whtBp={doc.whtBp}>
            {isInvoice && !isVoid ? (
              <div className="mt-2 border-t pt-2 text-sm">
                <div className="flex justify-between py-0.5 text-muted-foreground">
                  <span>{t('doc.settled')}</span>
                  <span className="tabular-nums">{formatAmount(doc.settledMinor, locale)}</span>
                </div>
                {doc.creditedMinor > 0 ? (
                  <div className="flex justify-between py-0.5 text-muted-foreground">
                    <span>{t('doc.credited')}</span>
                    <span className="tabular-nums">{formatAmount(doc.creditedMinor, locale)}</span>
                  </div>
                ) : null}
                <div
                  className={cn(
                    'flex justify-between py-0.5 font-semibold',
                    doc.balanceMinor > 0 ? 'text-warning' : 'text-success',
                  )}
                >
                  <span>{t('doc.balance')}</span>
                  <span className="tabular-nums">{formatAmount(doc.balanceMinor, locale)}</span>
                </div>
              </div>
            ) : null}
          </TotalsPanel>

          {doc.related.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('doc.relatedSection')}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1.5">
                {doc.related.map((r) => (
                  <Link
                    key={r.id}
                    to={detailPath(r.type, r.id) as never}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm hover:bg-mint-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs text-muted-foreground">
                        {t(`doc.relation.${r.relation}`)}
                      </span>
                      <span className="block truncate font-mono text-xs">
                        {t(`docType.${r.type}`)} {r.number ?? t('draftNumber')}
                      </span>
                    </span>
                    <DocStatusBadge status={r.status} />
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>

      <PaymentDialog
        open={paying}
        onOpenChange={setPaying}
        title={t('doc.recordPayment')}
        description={doc.number ?? undefined}
        balanceMinor={doc.balanceMinor}
        whtBaseMinor={doc.taxableMinor + doc.exemptMinor}
        defaultWhtBp={doc.whtBp}
        withIssueReceiptSwitch
        submitLabel={t('payment.save')}
        pending={recordPayment.isPending}
        onSubmit={(body) =>
          void recordPayment.mutateAsync({ id: doc.id, body }).then((res) => {
            setPaying(false);
            if (res.receipt) {
              const receipt = res.receipt;
              toast.success(t('payment.recordedWithReceipt', { number: receipt.number ?? '' }), {
                action: { label: t('payment.openReceipt'), onClick: () => goto(receipt) },
              });
            } else toast.success(t('payment.recorded'));
          })
        }
      />
      <VoidDialog
        open={voiding}
        onOpenChange={setVoiding}
        title={t('void.title', { number: doc.number ?? '' })}
        description={t('void.description')}
        pending={voidDoc.isPending}
        onConfirm={(reason) =>
          void voidDoc.mutateAsync({ id: doc.id, reason }).then(() => {
            setVoiding(false);
            toast.success(t('void.done'));
          })
        }
      />
      <VoidDialog
        open={voidingPayment !== null}
        onOpenChange={(o) => !o && setVoidingPayment(null)}
        title={t('payment.voidTitle')}
        description={t('payment.voidDescription')}
        pending={voidPayment.isPending}
        onConfirm={(reason) =>
          voidingPayment &&
          void voidPayment.mutateAsync({ id: voidingPayment.id, reason }).then(() => {
            setVoidingPayment(null);
            toast.success(t('void.done'));
          })
        }
      />
    </>
  );
}
