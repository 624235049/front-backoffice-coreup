import { Link, useNavigate } from '@tanstack/react-router';
import { Save, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { todayBangkok } from '@/features/platform/format';
import {
  type Company,
  type Expense,
  type ExpenseBody,
  type PaymentMethod,
  useCompany,
  useCreateExpense,
  useDeleteExpense,
  useExpense,
  useExpenseCategories,
  useUpdateExpense,
  type VatMode,
  type WhtBp,
} from '../api';
import { ContactPicker } from '../components/contact-picker';
import { DateField } from '../components/date-pickers';
import { FileField } from '../components/file-field';
import { FormField, SwitchRow } from '../components/form-field';
import { LinesEditor } from '../components/lines-editor';
import { MoneyInput } from '../components/money-input';
import { PAYMENT_METHODS } from '../components/payment-dialog';
import { TotalsPanel } from '../components/totals-panel';
import { calcTotals } from '../lib/calc';
import {
  type EditorLine,
  emptyLine,
  isBlankLine,
  newLineKey,
  toCalcLines,
  toLineBody,
  validateEditor,
} from '../lib/editor';
import { formatBp } from '../lib/format';

const WHT_OPTIONS: readonly WhtBp[] = [0, 100, 200, 300, 500];

type FormState = {
  contactId: string | null;
  contactName: string;
  vendorName: string;
  expenseDate: string;
  categoryId: string;
  reference: string;
  description: string;
  vatMode: VatMode;
  vatClaimable: boolean;
  whtBp: WhtBp;
  discountMinor: number | null;
  lines: EditorLine[];
  /** one amount (a single line) vs itemised lines */
  itemised: boolean;
  paymentStatus: 'unpaid' | 'paid';
  paidOn: string;
  paymentMethod: PaymentMethod;
  paymentAccount: string;
  receiptFileId: string | null;
  note: string;
};

function initial(company: Company, expense?: Expense): FormState {
  if (expense) {
    return {
      contactId: expense.contactId,
      contactName: expense.contactId ? expense.vendorName : '',
      vendorName: expense.contactId ? '' : expense.vendorName,
      expenseDate: expense.expenseDate,
      categoryId: expense.categoryId,
      reference: expense.reference ?? '',
      description: expense.description ?? '',
      vatMode: expense.vatMode,
      vatClaimable: expense.vatClaimable,
      whtBp: expense.whtBp as WhtBp,
      discountMinor: expense.discountMinor === 0 ? null : expense.discountMinor,
      lines: expense.lines.map((l) => ({
        key: newLineKey(),
        itemId: null,
        description: l.description,
        qty: String(l.qty),
        unit: '',
        unitPriceMinor: l.unitPriceMinor,
        discountMinor: l.discountMinor === 0 ? null : l.discountMinor,
        vatType: l.vatType,
      })),
      itemised: expense.lines.length > 1,
      paymentStatus: expense.paymentStatus,
      paidOn: expense.paidOn ?? todayBangkok(),
      paymentMethod: expense.paymentMethod ?? 'transfer',
      paymentAccount: expense.paymentAccount ?? '',
      receiptFileId: expense.receiptFileId,
      note: expense.note ?? '',
    };
  }
  return {
    contactId: null,
    contactName: '',
    vendorName: '',
    expenseDate: todayBangkok(),
    categoryId: '',
    reference: '',
    description: '',
    vatMode: company.vatRegistered ? 'exclusive' : 'none',
    vatClaimable: company.vatRegistered,
    whtBp: 0,
    discountMinor: null,
    lines: [emptyLine(company.vatRegistered ? 'vat' : 'none')],
    itemised: false,
    paymentStatus: 'unpaid',
    paidOn: todayBangkok(),
    paymentMethod: 'transfer',
    paymentAccount: '',
    receiptFileId: null,
    note: '',
  };
}

function ExpenseForm({ company, expense }: { company: Company; expense?: Expense }) {
  const { t } = useTranslation('accounting');
  const navigate = useNavigate();
  const categories = useExpenseCategories();
  const [f, setF] = useState<FormState>(() => initial(company, expense));
  const [touched, setTouched] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const remove = useDeleteExpense();
  const busy = create.isPending || update.isPending || remove.isPending;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const vatEnabled = company.vatRegistered && f.vatMode !== 'none';

  const totals = useMemo(
    () =>
      calcTotals({
        lines: toCalcLines(f.lines),
        discountMinor: f.discountMinor ?? 0,
        vatMode: f.vatMode,
        vatRateBp: company.vatRateBp,
        whtBp: f.whtBp,
      }),
    [f.lines, f.discountMinor, f.vatMode, f.whtBp, company.vatRateBp],
  );

  const lineErrors = validateEditor({
    contactId: 'x',
    contactName: '',
    docDate: f.expenseDate,
    dueDate: '',
    reference: '',
    vatMode: f.vatMode,
    whtBp: f.whtBp,
    discountMinor: f.discountMinor,
    lines: f.lines,
    note: '',
    internalNote: '',
    refDocumentId: null,
  });
  const errors = {
    vendor: !f.contactId && f.vendorName.trim() === '' ? t('expense.pickVendor') : undefined,
    category: f.categoryId === '' ? t('validation.required') : undefined,
    amount:
      lineErrors.lines || lineErrors.price || lineErrors.qty || (f.itemised && lineErrors.description)
        ? t('expense.needAmount')
        : undefined,
    paidOn: f.paymentStatus === 'paid' && f.paidOn === '' ? t('validation.required') : undefined,
  };

  // single-amount mode edits the first line only
  const first = f.lines[0] ?? emptyLine();
  const setFirst = (patch: Partial<EditorLine>) =>
    set('lines', [{ ...first, ...patch, description: first.description || f.description }]);

  const submit = async () => {
    setTouched(true);
    const reason =
      errors.vendor ??
      (errors.category ? t('expense.reason.category') : undefined) ??
      errors.amount ??
      (errors.paidOn ? t('expense.reason.paidOn') : undefined) ??
      (totals.totalMinor <= 0 ? t('expense.reason.zeroTotal') : undefined);
    if (reason) return toast.error(reason, { id: 'expense-block' });
    const lines = f.itemised
      ? f.lines.filter((l) => !isBlankLine(l)).map(toLineBody)
      : [
          {
            ...toLineBody({ ...first, qty: '1' }),
            description: f.description.trim() || t('expense.defaultLine'),
          },
        ];
    const body: ExpenseBody = {
      contactId: f.contactId,
      vendorName: f.contactId ? null : f.vendorName.trim(),
      expenseDate: f.expenseDate,
      categoryId: f.categoryId,
      reference: f.reference.trim() || null,
      description: f.description.trim() || null,
      vatMode: f.vatMode,
      vatClaimable: vatEnabled ? f.vatClaimable : false,
      whtBp: f.whtBp,
      discountMinor: f.discountMinor ?? 0,
      lines: lines.map(({ itemId: _i, unit: _u, ...l }) => l),
      paymentStatus: f.paymentStatus,
      paidOn: f.paymentStatus === 'paid' ? f.paidOn : null,
      paymentMethod: f.paymentStatus === 'paid' ? f.paymentMethod : null,
      paymentAccount: f.paymentStatus === 'paid' ? f.paymentAccount.trim() || null : null,
      receiptFileId: f.receiptFileId,
      note: f.note.trim() || null,
    };
    if (expense) await update.mutateAsync({ id: expense.id, body });
    else await create.mutateAsync(body);
    toast.success(t('expense.saved'));
    void navigate({ to: '/accounting/expenses' as never });
  };

  const show = (e: string | undefined) => (touched ? e : undefined);

  return (
    <>
      <PageHeader
        title={expense ? t('expense.edit') : t('expense.add')}
        description={
          <Link to={'/accounting/expenses' as never} className="hover:underline">
            ← {t('expense.title')}
          </Link>
        }
        actions={
          expense ? (
            <Button variant="outline" onClick={() => setDeleting(true)} disabled={busy}>
              <Trash2 /> {t('expense.delete')}
            </Button>
          ) : undefined
        }
      />
      <div className="grid items-start gap-5 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('expense.detailsSection')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label={t('expense.vendor')}
                  required
                  error={show(errors.vendor)}
                  hint={t('expense.vendorHint')}
                >
                  <ContactPicker
                    kind="vendor"
                    value={f.contactId}
                    label={f.contactName}
                    invalid={touched && Boolean(errors.vendor)}
                    onChange={(c) =>
                      setF((s) => ({ ...s, contactId: c?.id ?? null, contactName: c?.name ?? '' }))
                    }
                  />
                </FormField>
                <FormField label={t('expense.vendorFreeText')} htmlFor="ex-vendor">
                  <Input
                    id="ex-vendor"
                    value={f.vendorName}
                    maxLength={200}
                    disabled={f.contactId !== null}
                    onChange={(e) => set('vendorName', e.target.value)}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label={t('expense.date')} htmlFor="ex-date" required>
                  <DateField
                    id="ex-date"
                    className="sm:w-full"
                    value={f.expenseDate}
                    onChange={(v) => v && set('expenseDate', v)}
                    label={t('expense.date')}
                  />
                </FormField>
                <FormField
                  label={t('expense.category')}
                  htmlFor="ex-cat"
                  required
                  error={show(errors.category)}
                >
                  <Select value={f.categoryId} onValueChange={(v) => set('categoryId', v)}>
                    <SelectTrigger id="ex-cat">
                      <SelectValue placeholder={t('expense.pickCategory')} />
                    </SelectTrigger>
                    <SelectContent>
                      {(categories.data ?? [])
                        .filter((c) => c.isActive || c.id === f.categoryId)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label={t('expense.reference')} htmlFor="ex-ref" hint={t('expense.referenceHint')}>
                  <Input
                    id="ex-ref"
                    value={f.reference}
                    maxLength={120}
                    onChange={(e) => set('reference', e.target.value)}
                  />
                </FormField>
              </div>
              <FormField label={t('expense.descriptionLabel')} htmlFor="ex-desc">
                <Input
                  id="ex-desc"
                  value={f.description}
                  maxLength={500}
                  onChange={(e) => set('description', e.target.value)}
                />
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">{t('expense.amountSection')}</CardTitle>
              <SwitchRow
                checked={f.itemised}
                onCheckedChange={(v) => {
                  if (v && !f.lines[0]?.description) set('lines', [{ ...first, description: f.description }]);
                  set('itemised', v);
                }}
                label={t('expense.itemised')}
              />
            </CardHeader>
            <CardContent className="grid gap-4">
              {f.itemised ? (
                <LinesEditor
                  lines={f.lines}
                  onChange={(lines) => set('lines', lines)}
                  vatEnabled={vatEnabled}
                  defaultVatType={vatEnabled ? 'vat' : 'none'}
                  errors={touched ? lineErrors : {}}
                  suggestItems={false}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label={
                      vatEnabled && f.vatMode === 'inclusive'
                        ? t('expense.amountInclVat')
                        : t('expense.amount')
                    }
                    htmlFor="ex-amount"
                    required
                    error={show(errors.amount)}
                  >
                    <MoneyInput
                      id="ex-amount"
                      value={first.unitPriceMinor}
                      onChange={(v) => setFirst({ unitPriceMinor: v, qty: '1' })}
                    />
                  </FormField>
                  {vatEnabled ? (
                    <FormField label={t('doc.line.vatType')} htmlFor="ex-vattype">
                      <Select
                        value={first.vatType}
                        onValueChange={(v) => setFirst({ vatType: v as EditorLine['vatType'] })}
                      >
                        <SelectTrigger id="ex-vattype">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(['vat', 'none', 'exempt'] as const).map((v) => (
                            <SelectItem key={v} value={v}>
                              {t(`vatType.${v}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                  ) : null}
                </div>
              )}
              {f.itemised && touched && errors.amount ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.amount}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('expense.paymentSection')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={t('expense.paymentStatus')} htmlFor="ex-pstatus">
                  <Select
                    value={f.paymentStatus}
                    onValueChange={(v) => set('paymentStatus', v as 'unpaid' | 'paid')}
                  >
                    <SelectTrigger id="ex-pstatus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unpaid">{t('expense.status.unpaid')}</SelectItem>
                      <SelectItem value="paid">{t('expense.status.paid')}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                {f.paymentStatus === 'paid' ? (
                  <FormField
                    label={t('expense.paidOn')}
                    htmlFor="ex-paidon"
                    required
                    error={show(errors.paidOn)}
                  >
                    <DateField
                      id="ex-paidon"
                      className="sm:w-full"
                      value={f.paidOn}
                      onChange={(v) => v && set('paidOn', v)}
                      label={t('expense.paidOn')}
                    />
                  </FormField>
                ) : null}
              </div>
              {f.paymentStatus === 'paid' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label={t('payment.method')} htmlFor="ex-method">
                    <Select
                      value={f.paymentMethod}
                      onValueChange={(v) => set('paymentMethod', v as PaymentMethod)}
                    >
                      <SelectTrigger id="ex-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {t(`method.${m}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label={t('payment.account')} htmlFor="ex-account">
                    <Input
                      id="ex-account"
                      value={f.paymentAccount}
                      maxLength={120}
                      onChange={(e) => set('paymentAccount', e.target.value)}
                    />
                  </FormField>
                </div>
              ) : null}
              <FormField label={t('expense.receipt')} hint={t('expense.receiptHint')}>
                <FileField
                  fileId={f.receiptFileId}
                  onChange={(id) => set('receiptFileId', id)}
                  purpose="expense_receipt"
                  accept="application/pdf,image/*"
                  label={t('expense.attachReceipt')}
                />
              </FormField>
              <FormField label={t('expense.note')} htmlFor="ex-note">
                <Textarea
                  id="ex-note"
                  rows={2}
                  value={f.note}
                  onChange={(e) => set('note', e.target.value)}
                />
              </FormField>
            </CardContent>
          </Card>
        </div>

        <aside className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-4 lg:sticky lg:top-20">
          <Card>
            <CardContent className="grid gap-4 pt-6">
              {company.vatRegistered ? (
                <>
                  <FormField label={t('doc.vatMode')} htmlFor="ex-vatmode">
                    <Select
                      value={f.vatMode}
                      onValueChange={(v) =>
                        setF((s) => ({
                          ...s,
                          vatMode: v as VatMode,
                          lines:
                            s.vatMode === 'none' && v !== 'none'
                              ? s.lines.map((l) =>
                                  l.vatType === 'none' ? { ...l, vatType: 'vat' as const } : l,
                                )
                              : s.lines,
                        }))
                      }
                    >
                      <SelectTrigger id="ex-vatmode">
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
                  {f.vatMode !== 'none' ? (
                    <SwitchRow
                      checked={f.vatClaimable}
                      onCheckedChange={(v) => set('vatClaimable', v)}
                      label={t('expense.vatClaimable')}
                      hint={t('expense.vatClaimableHint')}
                    />
                  ) : null}
                </>
              ) : null}
              <FormField label={t('doc.docDiscount')} htmlFor="ex-discount">
                <MoneyInput
                  id="ex-discount"
                  value={f.discountMinor}
                  placeholder="0.00"
                  onChange={(v) => set('discountMinor', v)}
                />
              </FormField>
              <FormField label={t('expense.whtDeducted')} htmlFor="ex-wht" hint={t('expense.whtHint')}>
                <Select value={String(f.whtBp)} onValueChange={(v) => set('whtBp', Number(v) as WhtBp)}>
                  <SelectTrigger id="ex-wht">
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
          <TotalsPanel totals={totals} vatMode={f.vatMode} vatRateBp={company.vatRateBp} whtBp={f.whtBp} />
          <div className="grid gap-2">
            <Button size="lg" onClick={() => void submit()} disabled={busy}>
              <Save /> {t('save')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => void navigate({ to: '/accounting/expenses' as never })}
              disabled={busy}
            >
              {t('cancel')}
            </Button>
          </div>
        </aside>
      </div>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t('expense.deleteTitle')}
        description={t('expense.deleteBody')}
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          expense &&
          void remove.mutateAsync(expense.id).then(() => {
            toast.success(t('expense.deleted'));
            void navigate({ to: '/accounting/expenses' as never });
          })
        }
      />
    </>
  );
}

export function ExpenseFormPage({ id }: { id?: string }) {
  const company = useCompany();
  const expense = useExpense(id);
  return (
    <QueryState query={company}>
      {(c) =>
        id ? (
          <QueryState query={expense}>
            {(e) => <ExpenseForm key={`${e.id}:${e.updatedAt}`} company={c} expense={e} />}
          </QueryState>
        ) : (
          <ExpenseForm company={c} />
        )
      }
    </QueryState>
  );
}
