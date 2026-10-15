import { useNavigate } from '@tanstack/react-router';
import { Save, Send, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { todayBangkok } from '@/features/platform/format';
import {
  type AccDocument,
  type Company,
  type DocType,
  type PaymentInput,
  useCreateDocument,
  useDeleteDocument,
  useIssueDocument,
  useUpdateDocument,
  type VatMode,
  type WhtBp,
} from '../api';
import { A4Link } from '../components/a4-actions';
import { ContactPicker } from '../components/contact-picker';
import { DateField } from '../components/date-pickers';
import { FormField } from '../components/form-field';
import { LinesEditor } from '../components/lines-editor';
import { MoneyInput } from '../components/money-input';
import { PaymentDialog } from '../components/payment-dialog';
import { TotalsPanel } from '../components/totals-panel';
import { DOC_KINDS, detailPath, kindOf, listPath } from '../lib/doc-meta';
import {
  addDays,
  type EditorState,
  editorTotals,
  fromDocument,
  newEditorState,
  toBody,
  validateEditor,
} from '../lib/editor';
import { formatBp } from '../lib/format';

const WHT_OPTIONS: readonly WhtBp[] = [0, 100, 200, 300, 500];

/**
 * Create / edit a DRAFT of any sales document (quotation, invoice, receipt / tax invoice, credit note).
 * Issued documents are immutable and shown by DocumentView instead.
 */
export function DocumentEditor({
  type,
  company,
  doc,
}: {
  type: DocType;
  company: Company;
  doc?: AccDocument;
}) {
  const { t } = useTranslation('accounting');
  const navigate = useNavigate();
  const kind = kindOf(type);
  const isQuotation = type === 'quotation';
  const isDirectReceipt = type === 'receipt' || type === 'tax_invoice';
  const vatEnabled = company.vatRegistered;

  const [state, setState] = useState<EditorState>(() => {
    if (doc) return fromDocument(doc);
    const today = todayBangkok();
    const days = isQuotation ? company.quotationValidDays : company.defaultDueDays;
    return newEditorState({
      today,
      dueDate: type === 'invoice' || isQuotation ? addDays(today, days) : '',
      vatRegistered: vatEnabled,
      defaultNote: company.defaultNote,
    });
  });
  const [touched, setTouched] = useState(false);
  const [confirmIssue, setConfirmIssue] = useState(false);
  const [paying, setPaying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const create = useCreateDocument();
  const update = useUpdateDocument();
  const issue = useIssueDocument();
  const remove = useDeleteDocument();
  const busy = create.isPending || update.isPending || issue.isPending || remove.isPending;

  const totals = useMemo(() => editorTotals(state, company.vatRateBp), [state, company.vatRateBp]);
  const errors = validateEditor(state);
  const set = <K extends keyof EditorState>(k: K, v: EditorState[K]) => setState((s) => ({ ...s, [k]: v }));
  const defaultVat = vatEnabled && state.vatMode !== 'none' ? 'vat' : 'none';

  const goTo = (saved: { id: string; type: DocType }) =>
    void navigate({ to: detailPath(saved.type, saved.id) as never, replace: true });

  /** Persist the draft. Returns the saved document (create or update). */
  const save = async (issueNow: boolean, payment?: PaymentInput | null) => {
    const body = toBody(state, type, issueNow);
    if (!doc) {
      return create.mutateAsync({ ...body, payment: payment ?? null });
    }
    const updated = await update.mutateAsync({ id: doc.id, body });
    return issueNow ? issue.mutateAsync({ id: doc.id, payment: payment ?? null }) : updated;
  };

  const onSaveDraft = async () => {
    setTouched(true);
    if (Object.keys(errors).length > 0) return toast.error(t('doc.fixErrors'));
    const saved = await save(false);
    toast.success(t('doc.draftSaved'));
    goTo(saved);
  };

  const requestIssue = () => {
    setTouched(true);
    if (Object.keys(errors).length > 0) return toast.error(t('doc.fixErrors'));
    if (isDirectReceipt) setPaying(true);
    else setConfirmIssue(true);
  };

  const doIssue = async (payment?: PaymentInput | null) => {
    const saved = await save(true, payment);
    toast.success(t('doc.issued', { number: saved.number ?? '' }));
    setConfirmIssue(false);
    setPaying(false);
    goTo(saved);
  };

  const dueLabel = isQuotation ? t('doc.validUntil') : t('doc.dueDate');
  const showDue = type === 'invoice' || isQuotation;

  return (
    <>
      <PageHeader
        title={
          doc
            ? `${t(`docType.${type}`)} ${t('doc.draftTag')}`
            : t(`list.${kind === 'receipt' ? 'receipt' : kind}.add`)
        }
        description={t('doc.editorHint')}
        actions={
          doc ? (
            <>
              <A4Link source={{ kind: 'document', id: doc.id }} />
              <Button variant="outline" onClick={() => setDeleting(true)} disabled={busy}>
                <Trash2 /> {t('doc.deleteDraft')}
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="grid items-start gap-5 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('doc.customerSection')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <FormField
                label={t('contacts.customer')}
                required
                error={touched && errors.contact ? t('doc.pickCustomer') : undefined}
              >
                <ContactPicker
                  kind="customer"
                  value={state.contactId}
                  label={state.contactName}
                  invalid={touched && Boolean(errors.contact)}
                  onChange={(c) =>
                    setState((s) => ({ ...s, contactId: c?.id ?? null, contactName: c?.name ?? '' }))
                  }
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label={t('doc.docDate')} htmlFor="doc-date" required>
                  <DateField
                    id="doc-date"
                    className="sm:w-full"
                    value={state.docDate}
                    onChange={(v) => v && set('docDate', v)}
                    label={t('doc.docDate')}
                  />
                </FormField>
                {showDue ? (
                  <FormField
                    label={dueLabel}
                    htmlFor="doc-due"
                    error={touched && errors.dueDate ? t('doc.dueBeforeDate') : undefined}
                  >
                    <DateField
                      id="doc-due"
                      className="sm:w-full"
                      value={state.dueDate}
                      onChange={(v) => set('dueDate', v)}
                      label={dueLabel}
                      clearable
                    />
                  </FormField>
                ) : null}
                <FormField label={t('doc.reference')} htmlFor="doc-ref" hint={t('doc.referenceHint')}>
                  <Input
                    id="doc-ref"
                    value={state.reference}
                    maxLength={120}
                    onChange={(e) => set('reference', e.target.value)}
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('doc.linesSection')}</CardTitle>
            </CardHeader>
            <CardContent>
              <LinesEditor
                lines={state.lines}
                onChange={(lines) => set('lines', lines)}
                vatEnabled={vatEnabled && state.vatMode !== 'none'}
                defaultVatType={defaultVat}
                errors={touched ? errors : {}}
              />
              {touched && errors.lines ? (
                <p className="mt-2 text-sm text-destructive" role="alert">
                  {t('doc.needLine')}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              <FormField label={t('doc.note')} htmlFor="doc-note" hint={t('doc.noteHint')}>
                <Textarea
                  id="doc-note"
                  rows={3}
                  value={state.note}
                  onChange={(e) => set('note', e.target.value)}
                />
              </FormField>
              <FormField label={t('doc.internalNote')} htmlFor="doc-inote" hint={t('doc.internalNoteHint')}>
                <Textarea
                  id="doc-inote"
                  rows={3}
                  value={state.internalNote}
                  onChange={(e) => set('internalNote', e.target.value)}
                />
              </FormField>
            </CardContent>
          </Card>
        </div>

        <aside className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-4 lg:sticky lg:top-20">
          <Card>
            <CardContent className="grid gap-4 pt-6">
              {vatEnabled ? (
                <FormField label={t('doc.vatMode')} htmlFor="doc-vatmode">
                  <Select
                    value={state.vatMode}
                    onValueChange={(v) =>
                      setState((s) => ({
                        ...s,
                        vatMode: v as VatMode,
                        // leaving "no VAT" mode: lines that were defaulted to none become VAT lines again
                        lines:
                          s.vatMode === 'none' && v !== 'none'
                            ? s.lines.map((l) =>
                                l.vatType === 'none' ? { ...l, vatType: 'vat' as const } : l,
                              )
                            : s.lines,
                      }))
                    }
                  >
                    <SelectTrigger id="doc-vatmode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['exclusive', 'inclusive', 'none'] as const).map((m) => (
                        <SelectItem key={m} value={m}>
                          {t(`vatMode.${m}`, { rate: formatBp(company.vatRateBp) })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              ) : null}
              <FormField label={t('doc.docDiscount')} htmlFor="doc-discount" hint={t('doc.docDiscountHint')}>
                <MoneyInput
                  id="doc-discount"
                  value={state.discountMinor}
                  placeholder="0.00"
                  onChange={(v) => set('discountMinor', v)}
                />
              </FormField>
              <FormField label={t('doc.wht')} htmlFor="doc-wht" hint={t('doc.whtHint')}>
                <Select value={String(state.whtBp)} onValueChange={(v) => set('whtBp', Number(v) as WhtBp)}>
                  <SelectTrigger id="doc-wht">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WHT_OPTIONS.map((r) => (
                      <SelectItem key={r} value={String(r)}>
                        {r === 0 ? t('wht.none') : formatBp(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </CardContent>
          </Card>

          <TotalsPanel
            totals={totals}
            vatMode={state.vatMode}
            vatRateBp={company.vatRateBp}
            whtBp={state.whtBp}
          />

          <div className="grid gap-2">
            <Button size="lg" onClick={requestIssue} disabled={busy}>
              <Send /> {isQuotation ? t('doc.sendQuotation') : t('doc.issue')}
            </Button>
            <Button variant="outline" onClick={() => void onSaveDraft()} disabled={busy}>
              <Save /> {t('doc.saveDraft')}
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                void navigate({ to: listPath(DOC_KINDS.includes(kind) ? kind : 'invoice') as never })
              }
              disabled={busy}
            >
              {t('cancel')}
            </Button>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmIssue}
        onOpenChange={setConfirmIssue}
        title={isQuotation ? t('doc.confirmSendTitle') : t('doc.confirmIssueTitle')}
        description={isQuotation ? t('doc.confirmSendBody') : t('doc.confirmIssueBody')}
        confirmLabel={isQuotation ? t('doc.sendQuotation') : t('doc.issue')}
        pending={busy}
        onConfirm={() => void doIssue()}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t('doc.deleteDraftTitle')}
        description={t('doc.deleteDraftBody')}
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          doc &&
          void remove.mutateAsync(doc.id).then(() => {
            toast.success(t('doc.draftDeleted'));
            void navigate({ to: listPath(kind) as never });
          })
        }
      />
      <PaymentDialog
        open={paying}
        onOpenChange={setPaying}
        title={t('payment.cashSaleTitle')}
        description={t('payment.cashSaleHint')}
        balanceMinor={totals.totalMinor}
        whtBaseMinor={totals.taxableMinor + totals.exemptMinor}
        defaultWhtBp={state.whtBp}
        submitLabel={t('doc.issue')}
        pending={busy}
        onSubmit={({ issueReceipt: _ignored, ...payment }) => void doIssue(payment)}
      />
    </>
  );
}
