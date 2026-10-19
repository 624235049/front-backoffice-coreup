import { Plus, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  BANK_CARD_ID,
  BANK_CODES,
  type Bank,
  type BankChoice,
  type BankCode,
  bankAccountError,
  bankChoice,
  chooseBank,
  OTHER_BANK,
  THAI_BANKS,
  usedForSubscriptions,
} from '../lib/bank-accounts';
import { buildPromptPayPayload } from '../lib/promptpay';
import { FormField, SwitchRow } from './form-field';

/** Sample amount drawn in the QR preview: the real amount is put in when the invoice is issued. */
const SAMPLE_AMOUNT_MINOR = 100_000;

/** Bank logo (`public/banks/<code>.png`); no code or no picture: a coloured circle with the short code / name. */
export function BankIcon({
  code,
  name,
  className,
}: {
  code?: BankCode | null;
  name?: string | null;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (code && !broken) {
    return (
      <img
        src={`/banks/${code}.png`}
        alt=""
        aria-hidden
        className={cn('size-6 shrink-0 rounded-full', className)}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full text-[8px] font-bold text-white',
        className,
      )}
      style={{ backgroundColor: code ? THAI_BANKS[code].color : '#94a3b8' }}
    >
      {(code ?? name ?? '?').slice(0, 4)}
    </span>
  );
}

/** The "บัญชีรับเงิน" card: bank picker, details, "use for shop packages" switch and a preview of what shops see. */
export function BankAccountsCard({
  accounts,
  onChange,
  showErrors,
}: {
  accounts: Bank[];
  onChange: (next: Bank[]) => void;
  showErrors: boolean;
}) {
  const { t, i18n } = useTranslation('accounting');
  const en = i18n.language === 'en';
  const setBank = (i: number, next: Bank) => onChange(accounts.map((b, idx) => (idx === i ? next : b)));

  return (
    <Card id={BANK_CARD_ID} className="scroll-mt-4">
      <CardHeader>
        <CardTitle className="text-base">{t('settings.bankSection')}</CardTitle>
        <CardDescription>{t('settings.bankHint')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('settings.noBanks')}</p>
        ) : null}
        {accounts.map((b, i) => {
          const choice = bankChoice(b);
          const err = showErrors ? bankAccountError(b) : undefined;
          const isPromptPay = b.kind === 'promptpay';
          return (
            <div key={b.id} className="grid gap-3 rounded-xl border p-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2.75rem]">
                <FormField label={t('settings.bankName')}>
                  <Select value={choice} onValueChange={(v) => setBank(i, chooseBank(b, v as BankChoice))}>
                    <SelectTrigger aria-label={t('settings.bankName')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BANK_CODES.map((code) => (
                        <SelectItem key={code} value={code}>
                          <span className="flex items-center gap-2">
                            <BankIcon code={code} />
                            {en ? THAI_BANKS[code].nameEn : THAI_BANKS[code].nameTh}
                          </span>
                        </SelectItem>
                      ))}
                      <SelectItem value={OTHER_BANK}>
                        <span className="flex items-center gap-2">
                          <BankIcon name={b.bankName} />
                          {t('settings.bankOther')}
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                {choice === OTHER_BANK ? (
                  <FormField
                    label={t('settings.bankOtherName')}
                    error={err === 'bankName' ? t('settings.bankNameRequired') : undefined}
                  >
                    <Input
                      value={b.bankName ?? ''}
                      maxLength={60}
                      aria-label={t('settings.bankOtherName')}
                      onChange={(e) => setBank(i, { ...b, bankName: e.target.value })}
                    />
                  </FormField>
                ) : null}
                <FormField
                  label={t('settings.accountName')}
                  error={err === 'accountName' ? t('settings.accountNameRequired') : undefined}
                >
                  <Input
                    value={b.accountName ?? ''}
                    maxLength={100}
                    aria-label={t('settings.accountName')}
                    onChange={(e) => setBank(i, { ...b, accountName: e.target.value })}
                  />
                </FormField>
                <FormField
                  label={isPromptPay ? t('settings.promptpayId') : t('settings.accountNo')}
                  hint={isPromptPay ? t('settings.promptpayHint') : undefined}
                  error={
                    err === 'accountNo'
                      ? t('settings.bankNoRequired')
                      : err === 'promptpayId'
                        ? t('settings.promptpayInvalid')
                        : undefined
                  }
                >
                  <Input
                    value={b.accountNo}
                    inputMode={isPromptPay ? 'numeric' : 'text'}
                    maxLength={isPromptPay ? 20 : 40}
                    aria-label={isPromptPay ? t('settings.promptpayId') : t('settings.accountNo')}
                    onChange={(e) => setBank(i, { ...b, accountNo: e.target.value })}
                  />
                </FormField>
                {!isPromptPay ? (
                  <FormField label={t('settings.bankBranch')}>
                    <Input
                      value={b.branch ?? ''}
                      maxLength={80}
                      aria-label={t('settings.bankBranch')}
                      onChange={(e) => setBank(i, { ...b, branch: e.target.value })}
                    />
                  </FormField>
                ) : null}
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={t('doc.line.remove')}
                    onClick={() => onChange(accounts.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <SwitchRow
                checked={usedForSubscriptions(b)}
                onCheckedChange={(v) => setBank(i, { ...b, forSubscriptions: v })}
                label={t('settings.forSubscriptions')}
                hint={t('settings.forSubscriptionsHint')}
              />
            </div>
          );
        })}
        <div>
          <Button
            type="button"
            variant="outline"
            blockedReason={accounts.length >= 10 && t('settings.bankLimit')}
            onClick={() =>
              onChange([
                ...accounts,
                {
                  id: crypto.randomUUID().slice(0, 8),
                  kind: 'bank',
                  bankCode: null,
                  bankName: null,
                  accountName: null,
                  accountNo: '',
                  branch: null,
                  forSubscriptions: true,
                },
              ])
            }
          >
            <Plus /> {t('settings.addBank')}
          </Button>
        </div>
        <ShopPreview accounts={accounts} />
      </CardContent>
    </Card>
  );
}

/** What a shop owner sees when paying a package: the accounts flagged for subscriptions, plus a PromptPay QR. */
function ShopPreview({ accounts }: { accounts: Bank[] }) {
  const { t } = useTranslation('accounting');
  const shown = accounts.filter(
    (b) => usedForSubscriptions(b) && b.accountNo.trim() !== '' && !bankAccountError(b),
  );
  const promptPay = shown.find((b) => b.kind === 'promptpay');
  return (
    <section aria-label={t('settings.previewTitle')} className="grid gap-3 rounded-xl bg-muted/40 p-3">
      <div>
        <h3 className="text-sm font-semibold">{t('settings.previewTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('settings.previewHint')}</p>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('settings.previewEmpty')}</p>
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          <ul className="grid min-w-0 flex-1 gap-2">
            {shown.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
                <BankIcon
                  code={b.bankCode ?? (b.kind === 'promptpay' ? 'PROMPTPAY' : null)}
                  name={b.bankName}
                  className="size-8"
                />
                <div className="min-w-0">
                  <div className="font-medium">{b.bankName}</div>
                  <div className="font-mono">{b.accountNo}</div>
                  <div className="text-xs text-muted-foreground">
                    {[b.accountName, b.branch].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {promptPay ? (
            <figure className="grid justify-items-center gap-1">
              <div className="rounded-lg border bg-white p-2">
                <QRCodeSVG
                  value={buildPromptPayPayload(promptPay.accountNo, SAMPLE_AMOUNT_MINOR)}
                  size={140}
                />
              </div>
              <figcaption className="text-xs text-muted-foreground">{t('settings.previewQr')}</figcaption>
            </figure>
          ) : null}
        </div>
      )}
    </section>
  );
}
