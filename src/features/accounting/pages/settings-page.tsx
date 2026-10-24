import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { type Company, type CompanyBody, fileDownloadUrl, useCompany, useSaveCompany } from '../api';
import { BankAccountsCard } from '../components/bank-accounts-card';
import { CategoriesCard } from '../components/categories-card';
import { FileField } from '../components/file-field';
import { FormField, SwitchRow } from '../components/form-field';
import {
  BANK_CARD_ID,
  type Bank,
  bankAccountError,
  THAI_BANKS,
  usedForSubscriptions,
} from '../lib/bank-accounts';
import { isValidNumberFormat, previewDocNumber } from '../lib/doc-number';
import { isOptionalEmailOk, isOptionalTaxIdOk, isValidThaiTaxId } from '../lib/tax-id';

type FormState = {
  legalName: string;
  legalNameEn: string;
  taxId: string;
  branchCode: string;
  branchName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logoFileId: string | null;
  vatRegistered: boolean;
  vatRatePct: string;
  prefixes: Company['prefixes'];
  numberFormat: string;
  seqDigits: string;
  defaultDueDays: string;
  quotationValidDays: string;
  defaultNote: string;
  bankAccounts: Bank[];
  issuer: string;
  approver: string;
};

const fromCompany = (c: Company): FormState => ({
  legalName: c.legalName,
  legalNameEn: c.legalNameEn ?? '',
  taxId: c.taxId ?? '',
  branchCode: c.branchCode,
  branchName: c.branchName ?? '',
  address: c.address ?? '',
  phone: c.phone ?? '',
  email: c.email ?? '',
  website: c.website ?? '',
  logoFileId: c.logoFileId,
  vatRegistered: c.vatRegistered,
  vatRatePct: String(c.vatRateBp / 100),
  prefixes: c.prefixes,
  numberFormat: c.numberFormat,
  seqDigits: String(c.seqDigits),
  defaultDueDays: String(c.defaultDueDays),
  quotationValidDays: String(c.quotationValidDays),
  defaultNote: c.defaultNote ?? '',
  bankAccounts: c.bankAccounts.map((b) => ({
    ...b,
    bankCode: b.bankCode ?? null,
    forSubscriptions: usedForSubscriptions(b),
  })),
  issuer: c.signers.issuer ?? '',
  approver: c.signers.approver ?? '',
});

const intIn = (s: string, min: number, max: number): number | null => {
  if (!/^\d+$/.test(s.trim())) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
};

function LogoPreview({ fileId }: { fileId: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (fileId)
      void fileDownloadUrl(fileId)
        .then((u) => live && setUrl(u))
        .catch(() => undefined); // best-effort preview: the logo is optional and the upload field reports real failures
    return () => {
      live = false;
    };
  }, [fileId]);
  if (!url) return null;
  return <img src={url} alt="" className="h-16 max-w-48 rounded-lg border bg-white object-contain p-1" />;
}

function CompanyForm({ company }: { company: Company }) {
  const { t } = useTranslation('accounting');
  const [f, setF] = useState<FormState>(() => fromCompany(company));
  const [touched, setTouched] = useState(false);
  const save = useSaveCompany();
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const vatRateBp = (() => {
    const n = Number(f.vatRatePct);
    return Number.isFinite(n) && n >= 0 && n <= 20 ? Math.round(n * 100) : null;
  })();
  const errors = {
    legalName: f.legalName.trim() === '' ? t('validation.required') : undefined,
    taxId: !isOptionalTaxIdOk(f.taxId)
      ? t('validation.taxId')
      : f.vatRegistered && !isValidThaiTaxId(f.taxId.trim())
        ? t('settings.taxIdRequiredForVat')
        : undefined,
    address: f.vatRegistered && f.address.trim() === '' ? t('settings.addressRequiredForVat') : undefined,
    branchCode: /^\d{5}$/.test(f.branchCode) ? undefined : t('validation.branchCode'),
    email: isOptionalEmailOk(f.email) ? undefined : t('validation.email'),
    vatRate: vatRateBp === null ? t('validation.invalid') : undefined,
    numberFormat: isValidNumberFormat(f.numberFormat) ? undefined : t('settings.numberFormatInvalid'),
    seqDigits: intIn(f.seqDigits, 2, 8) === null ? t('validation.invalid') : undefined,
    dueDays: intIn(f.defaultDueDays, 0, 365) === null ? t('validation.invalid') : undefined,
    validDays: intIn(f.quotationValidDays, 0, 365) === null ? t('validation.invalid') : undefined,
    prefixes: Object.values(f.prefixes).some((p) => !/^[A-Za-z0-9]{1,10}$/.test(p))
      ? t('settings.prefixInvalid')
      : undefined,
    banks: f.bankAccounts.map(bankAccountError).find(Boolean) ? t('settings.bankInvalid') : undefined,
  };
  const show = (e: string | undefined) => (touched ? e : undefined);

  const submit = async () => {
    setTouched(true);
    const firstError = Object.values(errors).find(Boolean);
    if (firstError) return void toast.error(firstError, { id: 'settings-invalid' });
    const body: CompanyBody = {
      legalName: f.legalName.trim(),
      legalNameEn: f.legalNameEn.trim() || null,
      taxId: f.taxId.trim() || null,
      branchCode: f.branchCode,
      branchName: f.branchName.trim() || null,
      address: f.address.trim() || null,
      phone: f.phone.trim() || null,
      email: f.email.trim() || null,
      website: f.website.trim() || null,
      logoFileId: f.logoFileId,
      vatRegistered: f.vatRegistered,
      vatRateBp: vatRateBp ?? 700,
      prefixes: f.prefixes,
      numberFormat: f.numberFormat,
      seqDigits: intIn(f.seqDigits, 2, 8) ?? 4,
      defaultDueDays: intIn(f.defaultDueDays, 0, 365) ?? 30,
      quotationValidDays: intIn(f.quotationValidDays, 0, 365) ?? 30,
      defaultNote: f.defaultNote.trim() || null,
      bankAccounts: f.bankAccounts.map((b) => ({
        ...b,
        bankName: b.bankName?.trim() || (b.kind === 'promptpay' ? THAI_BANKS.PROMPTPAY.nameTh : null),
        accountName: b.accountName?.trim() || null,
        branch: b.branch?.trim() || null,
        accountNo: b.accountNo.trim(),
        forSubscriptions: usedForSubscriptions(b),
      })),
      signers: { issuer: f.issuer.trim() || null, approver: f.approver.trim() || null },
    };
    await save.mutateAsync(body);
    toast.success(t('settings.saved'));
  };

  const now = new Date();
  const sample = (prefix: string) =>
    isValidNumberFormat(f.numberFormat)
      ? previewDocNumber({
          format: f.numberFormat,
          prefix,
          seqDigits: intIn(f.seqDigits, 2, 8) ?? 4,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        })
      : '–';
  // deep link from the nav ("บัญชีรับเงินบริษัท"): the card only exists once the company has loaded
  useEffect(() => {
    if (window.location.hash === `#${BANK_CARD_ID}`) document.getElementById(BANK_CARD_ID)?.scrollIntoView();
  }, []);

  const prefixKeys = [
    ['quotation', 'quotation'],
    ['invoice', 'invoice'],
    ['receipt', 'receipt'],
    ['taxInvoice', 'tax_invoice'],
    ['creditNote', 'credit_note'],
  ] as const;

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.identity')}</CardTitle>
          <CardDescription>{t('settings.identityHint')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={t('settings.legalName')}
              htmlFor="co-name"
              required
              error={show(errors.legalName)}
            >
              <Input
                id="co-name"
                value={f.legalName}
                maxLength={200}
                onChange={(e) => set('legalName', e.target.value)}
              />
            </FormField>
            <FormField label={t('settings.legalNameEn')} htmlFor="co-name-en">
              <Input
                id="co-name-en"
                value={f.legalNameEn}
                maxLength={200}
                onChange={(e) => set('legalNameEn', e.target.value)}
              />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label={t('contacts.taxId')} htmlFor="co-tax" error={show(errors.taxId)}>
              <Input
                id="co-tax"
                inputMode="numeric"
                maxLength={13}
                value={f.taxId}
                onChange={(e) => set('taxId', e.target.value.replace(/\D/g, ''))}
              />
            </FormField>
            <FormField
              label={t('contacts.branchCode')}
              htmlFor="co-branch"
              error={show(errors.branchCode)}
              hint={t('contacts.branchHint')}
            >
              <Input
                id="co-branch"
                inputMode="numeric"
                maxLength={5}
                value={f.branchCode}
                onChange={(e) => set('branchCode', e.target.value.replace(/\D/g, ''))}
              />
            </FormField>
            <FormField label={t('settings.branchName')} htmlFor="co-branch-name">
              <Input
                id="co-branch-name"
                value={f.branchName}
                maxLength={120}
                onChange={(e) => set('branchName', e.target.value)}
              />
            </FormField>
          </div>
          <FormField label={t('contacts.address')} htmlFor="co-addr" error={show(errors.address)}>
            <Textarea
              id="co-addr"
              rows={2}
              value={f.address}
              onChange={(e) => set('address', e.target.value)}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label={t('contacts.phone')} htmlFor="co-phone">
              <Input
                id="co-phone"
                inputMode="tel"
                value={f.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </FormField>
            <FormField label={t('contacts.email')} htmlFor="co-email" error={show(errors.email)}>
              <Input
                id="co-email"
                type="email"
                value={f.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </FormField>
            <FormField label={t('settings.website')} htmlFor="co-web">
              <Input
                id="co-web"
                value={f.website}
                maxLength={200}
                onChange={(e) => set('website', e.target.value)}
              />
            </FormField>
          </div>
          <FormField label={t('settings.logo')} hint={t('settings.logoHint')}>
            <div className="flex flex-wrap items-center gap-3">
              <LogoPreview fileId={f.logoFileId} />
              <FileField
                fileId={f.logoFileId}
                onChange={(id) => set('logoFileId', id)}
                purpose="accounting_file"
                accept="image/png,image/jpeg,image/webp"
                label={t('settings.uploadLogo')}
                maxMb={5}
              />
            </div>
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.vatSection')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SwitchRow
            checked={f.vatRegistered}
            onCheckedChange={(v) => set('vatRegistered', v)}
            label={t('settings.vatRegistered')}
            hint={t('settings.vatRegisteredHint')}
          />
          {f.vatRegistered ? (
            <FormField
              label={t('settings.vatRate')}
              htmlFor="co-vat"
              error={show(errors.vatRate)}
              className="max-w-40"
            >
              <Input
                id="co-vat"
                inputMode="decimal"
                value={f.vatRatePct}
                onChange={(e) => set('vatRatePct', e.target.value)}
              />
            </FormField>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.numbering')}</CardTitle>
          <CardDescription>{t('settings.numberingHint')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {prefixKeys.map(([key, typeKey]) => (
              <FormField key={key} label={t(`docType.${typeKey}`)} htmlFor={`co-prefix-${key}`}>
                <Input
                  id={`co-prefix-${key}`}
                  value={f.prefixes[key]}
                  maxLength={10}
                  onChange={(e) => set('prefixes', { ...f.prefixes, [key]: e.target.value.toUpperCase() })}
                />
                <span className="font-mono text-xs text-muted-foreground">{sample(f.prefixes[key])}</span>
              </FormField>
            ))}
          </div>
          {errors.prefixes && touched ? <p className="text-xs text-destructive">{errors.prefixes}</p> : null}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <FormField
              label={t('settings.numberFormat')}
              htmlFor="co-format"
              error={show(errors.numberFormat)}
              hint={t('settings.numberFormatHint')}
            >
              <Input
                id="co-format"
                className="font-mono"
                value={f.numberFormat}
                maxLength={40}
                onChange={(e) => set('numberFormat', e.target.value)}
              />
            </FormField>
            <FormField label={t('settings.seqDigits')} htmlFor="co-digits" error={show(errors.seqDigits)}>
              <Input
                id="co-digits"
                inputMode="numeric"
                value={f.seqDigits}
                onChange={(e) => set('seqDigits', e.target.value)}
              />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('settings.defaultDueDays')} htmlFor="co-due" error={show(errors.dueDays)}>
              <Input
                id="co-due"
                inputMode="numeric"
                value={f.defaultDueDays}
                onChange={(e) => set('defaultDueDays', e.target.value)}
              />
            </FormField>
            <FormField
              label={t('settings.quotationValidDays')}
              htmlFor="co-valid"
              error={show(errors.validDays)}
            >
              <Input
                id="co-valid"
                inputMode="numeric"
                value={f.quotationValidDays}
                onChange={(e) => set('quotationValidDays', e.target.value)}
              />
            </FormField>
          </div>
          <FormField label={t('settings.defaultNote')} htmlFor="co-note" hint={t('settings.defaultNoteHint')}>
            <Textarea
              id="co-note"
              rows={3}
              value={f.defaultNote}
              onChange={(e) => set('defaultNote', e.target.value)}
            />
          </FormField>
        </CardContent>
      </Card>

      <BankAccountsCard
        accounts={f.bankAccounts}
        onChange={(next) => set('bankAccounts', next)}
        showErrors={touched}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.signers')}</CardTitle>
          <CardDescription>{t('settings.signersHint')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('settings.issuer')} htmlFor="co-issuer">
            <Input
              id="co-issuer"
              value={f.issuer}
              maxLength={120}
              onChange={(e) => set('issuer', e.target.value)}
            />
          </FormField>
          <FormField label={t('settings.approver')} htmlFor="co-approver">
            <Input
              id="co-approver"
              value={f.approver}
              maxLength={120}
              onChange={(e) => set('approver', e.target.value)}
            />
          </FormField>
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-20 flex justify-end lg:bottom-4">
        <Button size="lg" className="shadow-lg" onClick={() => void submit()} disabled={save.isPending}>
          <Save /> {t('save')}
        </Button>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation('accounting');
  const company = useCompany();
  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.description')} />
      <QueryState query={company}>
        {(c) => (
          <div className="grid gap-5">
            <CompanyForm key={c.updatedAt} company={c} />
            <CategoriesCard />
          </div>
        )}
      </QueryState>
    </>
  );
}
