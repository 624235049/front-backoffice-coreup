import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { todayBangkok, useIntlLocale } from '@/features/platform/format';
import { type PaymentBody, type PaymentMethod, useCompany } from '../api';
import { formatAmount, formatBp } from '../lib/format';
import { DateField } from './date-pickers';
import { FileField } from './file-field';
import { FormField, SwitchRow } from './form-field';
import { MoneyInput } from './money-input';

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['cash', 'transfer', 'promptpay', 'card', 'cheque'];
const WHT_RATES = [0, 100, 200, 300, 500] as const;

/** WHT = round_half_away(base × bp / 10000), integers only. */
const whtOf = (base: number, bp: number) => Math.floor((base * bp * 2 + 10_000) / 20_000);

/**
 * Record a payment on an invoice, or the cash received for a direct receipt / tax invoice.
 * WHT is what the customer deducted: cash + WHT together settle the invoice.
 */
export function PaymentDialog({
  open,
  onOpenChange,
  title,
  description,
  balanceMinor,
  whtBaseMinor,
  defaultWhtBp = 0,
  withIssueReceiptSwitch,
  mustSettleFull,
  submitLabel,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Amount still to be settled (cash + WHT). */
  balanceMinor: number;
  /** Pre-VAT base the customer withholds on. */
  whtBaseMinor: number;
  defaultWhtBp?: number;
  /** Invoices: let the person skip issuing the receipt now. */
  withIssueReceiptSwitch?: boolean;
  /** Cash sale: the cash + WHT must equal the whole total. */
  mustSettleFull?: boolean;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (body: PaymentBody) => void;
}) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const company = useCompany();
  const listId = useId();
  const [paidOn, setPaidOn] = useState(todayBangkok());
  const [method, setMethod] = useState<PaymentMethod>('transfer');
  const [account, setAccount] = useState('');
  const [reference, setReference] = useState('');
  const [whtBp, setWhtBp] = useState<number>(0);
  const [whtMinor, setWhtMinor] = useState<number | null>(null);
  const [amountMinor, setAmountMinor] = useState<number | null>(null);
  const [certId, setCertId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [issueReceipt, setIssueReceipt] = useState(true);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    const wht = whtOf(whtBaseMinor, defaultWhtBp);
    setPaidOn(todayBangkok());
    setMethod('transfer');
    setAccount('');
    setReference('');
    setWhtBp(defaultWhtBp);
    setWhtMinor(wht === 0 ? null : wht);
    setAmountMinor(Math.max(balanceMinor - wht, 0));
    setCertId(null);
    setNote('');
    setIssueReceipt(true);
    setTouched(false);
  }, [open, balanceMinor, whtBaseMinor, defaultWhtBp]);

  const pickRate = (bp: number) => {
    const wht = whtOf(whtBaseMinor, bp);
    setWhtBp(bp);
    setWhtMinor(wht === 0 ? null : wht);
    setAmountMinor(Math.max(balanceMinor - wht, 0));
  };

  const wht = whtMinor ?? 0;
  const amount = amountMinor ?? 0;
  const errors = {
    amount: amountMinor === null || (amount === 0 && wht === 0) ? t('validation.required') : undefined,
    over:
      amount + wht > balanceMinor
        ? t('payment.over', { max: formatAmount(balanceMinor, locale) })
        : undefined,
    short:
      mustSettleFull && amount + wht < balanceMinor
        ? t('payment.mustSettle', { total: formatAmount(balanceMinor, locale) })
        : undefined,
    date: paidOn === '' ? t('validation.required') : undefined,
  };
  const firstError = errors.date
    ? t('payment.reason.date')
    : errors.amount
      ? t('payment.reason.amount')
      : (errors.over ?? errors.short);
  const accounts = (company.data?.bankAccounts ?? []).map((a) =>
    [a.bankName ?? (a.kind === 'promptpay' ? 'PromptPay' : ''), a.accountNo].filter(Boolean).join(' '),
  );

  const submit = () => {
    setTouched(true);
    if (firstError) return void toast.error(firstError, { id: 'payment-invalid' });
    onSubmit({
      paidOn,
      method,
      account: account.trim() || null,
      reference: reference.trim() || null,
      amountMinor: amount,
      whtMinor: wht,
      whtCertificateFileId: certId,
      note: note.trim() || null,
      issueReceipt: withIssueReceiptSwitch ? issueReceipt : true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={t('payment.paidOn')}
              htmlFor="pay-date"
              required
              error={touched ? errors.date : undefined}
            >
              <DateField
                id="pay-date"
                className="sm:w-full"
                value={paidOn}
                onChange={(v) => v && setPaidOn(v)}
                label={t('payment.paidOn')}
              />
            </FormField>
            <FormField label={t('payment.method')} htmlFor="pay-method">
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger id="pay-method">
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
            <FormField label={t('payment.account')} htmlFor="pay-account" hint={t('payment.accountHint')}>
              <Input
                id="pay-account"
                list={listId}
                value={account}
                maxLength={120}
                onChange={(e) => setAccount(e.target.value)}
              />
              <datalist id={listId}>
                {accounts.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </FormField>
            <FormField label={t('payment.reference')} htmlFor="pay-ref">
              <Input
                id="pay-ref"
                value={reference}
                maxLength={120}
                onChange={(e) => setReference(e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid gap-4 rounded-xl bg-navy-50/60 p-3 sm:grid-cols-3">
            <FormField label={t('payment.whtRate')} htmlFor="pay-wht-rate">
              <Select value={String(whtBp)} onValueChange={(v) => pickRate(Number(v))}>
                <SelectTrigger id="pay-wht-rate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WHT_RATES.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {r === 0 ? t('wht.none') : formatBp(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t('payment.whtAmount')} htmlFor="pay-wht" hint={t('payment.whtHint')}>
              <MoneyInput
                id="pay-wht"
                value={whtMinor}
                placeholder="0.00"
                onChange={(v) => {
                  setWhtMinor(v);
                  setAmountMinor(Math.max(balanceMinor - (v ?? 0), 0));
                }}
              />
            </FormField>
            <FormField
              label={t('payment.amount')}
              htmlFor="pay-amount"
              required
              error={touched ? (errors.amount ?? errors.over ?? errors.short) : undefined}
              hint={t('payment.balance', { amount: formatAmount(balanceMinor, locale) })}
            >
              <MoneyInput id="pay-amount" value={amountMinor} onChange={setAmountMinor} />
            </FormField>
          </div>

          {wht > 0 ? (
            <FormField label={t('payment.whtCertificate')}>
              <FileField
                fileId={certId}
                onChange={setCertId}
                purpose="accounting_file"
                accept="application/pdf,image/*"
                label={t('payment.attachCertificate')}
              />
            </FormField>
          ) : null}

          <FormField label={t('payment.note')} htmlFor="pay-note">
            <Textarea id="pay-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>

          {withIssueReceiptSwitch ? (
            <SwitchRow
              checked={issueReceipt}
              onCheckedChange={setIssueReceipt}
              label={company.data?.vatRegistered ? t('payment.issueTaxInvoice') : t('payment.issueReceipt')}
            />
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
