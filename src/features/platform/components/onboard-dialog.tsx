import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ExternalLink, Eye, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { PhoneInput } from '@/components/phone-input';
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInvalidToast } from '@/lib/form-errors';
import { useCan } from '@/lib/permissions';
import { normalizeMobileE164 } from '@/lib/phone';
import { useCreateTenant, usePlans } from '../api';
import { usePlanLabel } from '../format';
import { sellablePlans } from '../plan-families';
import { bookingUrlFor, buildNewShopMessage } from '../user-helpers';
import { INDUSTRY_KEYS } from './common';
import { ImpersonateDialog } from './impersonate-dialog';
import { PlanPicker } from './plan-picker';
import { CopyButton } from './user-actions';

const schema = z.object({
  name: z.string().trim().min(1, 'validation.required'),
  industryKey: z.string().min(1, 'validation.required'),
  ownerEmail: z.string().trim().toLowerCase().pipe(z.email('validation.email')),
  ownerPhone: z
    .string()
    .min(1, 'validation.required')
    .refine((v) => normalizeMobileE164(v) !== null, 'phoneInput.invalid'),
  ownerName: z.string().trim().optional(),
  planCode: z.string().min(1, 'validation.required'),
  status: z.enum(['trial', 'active']),
  ownerAccount: z.enum(['password', 'invite']),
  branches: z.array(z.object({ name: z.string().trim().min(1, 'validation.required') })).min(1),
});
type Values = z.infer<typeof schema>;

/** What the result screen shows: kept in component state only, shown once, never persisted. */
interface Done {
  tenantId: string;
  slug: string;
  name: string;
  trial: boolean;
  credentials: { email: string; password: string; loginUrl: string };
}

function ResultRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <code
        className={`select-all break-all rounded-md border bg-muted px-3 py-1.5 text-sm ${mono ? 'font-mono text-base tracking-wide' : ''}`}
      >
        {value}
      </code>
    </div>
  );
}

/** docs/02 §6.9: onboard a shop from an industry template (tenant, branches, owner, services, checklists …). */
export function OnboardDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (tenantId: string) => void;
}) {
  const { t } = useTranslation('platform');
  const { t: tc } = useTranslation('common');
  const plans = usePlans();
  const planLabel = usePlanLabel();
  const create = useCreateTenant();
  const canImpersonate = useCan('platform:impersonate');
  const [done, setDone] = useState<Done | null>(null);
  const [impersonate, setImpersonate] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      industryKey: 'generic',
      ownerEmail: '',
      ownerPhone: '',
      ownerName: '',
      planCode: '',
      status: 'trial',
      ownerAccount: 'password',
      branches: [{ name: '' }],
    },
  });
  const branches = useFieldArray({ control: form.control, name: 'branches' });
  const invalid = useInvalidToast<Values>();
  // only what is sold on the pricing page (never an internal ฿0 plan), starting on Pro
  const sellable = sellablePlans(plans.data);
  const planCode = form.watch('planCode');
  useEffect(() => {
    if (sellable.defaultCode && !planCode) form.setValue('planCode', sellable.defaultCode);
  }, [sellable.defaultCode, planCode, form]);
  const errors = form.formState.errors;
  const err = (key?: string) =>
    key ? <p className="mt-1 text-xs text-destructive">{tc(key, { defaultValue: key })}</p> : null;
  const ownerAccount = form.watch('ownerAccount');

  const submit = form.handleSubmit(async (v) => {
    const res = await create.mutateAsync({
      name: v.name,
      industryKey: v.industryKey,
      ownerEmail: v.ownerEmail,
      ownerPhone: v.ownerPhone,
      ownerName: v.ownerName || undefined,
      planCode: v.planCode,
      status: v.status,
      ownerAccount: v.ownerAccount,
      branches: v.branches.map((b) => ({ name: b.name })),
    });
    const { tenantId, slug, ownerCredentials, ownerExisted, passwordResetSent } = res.data;
    form.reset();
    if (ownerCredentials) {
      // the password is shown once: stay on the result screen until the team closes it
      setDone({ tenantId, slug, name: v.name, trial: v.status === 'trial', credentials: ownerCredentials });
      return;
    }
    toast.success(
      ownerExisted
        ? t('onboard.createdExisting')
        : passwordResetSent
          ? t('onboard.createdWithMail')
          : t('onboard.created'),
    );
    onOpenChange(false);
    onCreated(tenantId);
  }, invalid);

  const closeResult = () => {
    const tenantId = done?.tenantId;
    setDone(null);
    onOpenChange(false);
    if (tenantId) onCreated(tenantId);
  };

  if (done) {
    const message = buildNewShopMessage({
      shop: done.name,
      slug: done.slug,
      email: done.credentials.email,
      password: done.credentials.password,
      loginUrl: done.credentials.loginUrl,
      trial: done.trial,
    });
    return (
      <>
        <Dialog open={open} onOpenChange={(o) => (o ? undefined : closeResult())}>
          <DialogContent
            closeLabel={tc('close')}
            className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
            // the password is shown once: a stray click outside must not throw it away
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="size-5 text-success" aria-hidden />
                {t('onboard.result.title')}
              </DialogTitle>
              <DialogDescription>{t('onboard.result.description')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3" role="status" data-testid="onboard-result">
              <ResultRow label={t('onboard.name')} value={done.name} />
              <ResultRow label={t('onboard.result.bookingLink')} value={bookingUrlFor(done.slug)} />
              <ResultRow label={t('onboard.result.loginUrl')} value={done.credentials.loginUrl} />
              <ResultRow label={t('onboard.ownerEmail')} value={done.credentials.email} />
              <ResultRow label={t('onboard.result.password')} value={done.credentials.password} mono />
              <p className="flex items-start gap-2 text-sm text-warning">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t('onboard.result.onceWarning')}
              </p>
            </div>
            <DialogFooter className="sm:flex-wrap">
              <CopyButton
                value={done.credentials.password}
                label={t('onboard.result.copyPassword')}
                copiedLabel={t('onboard.result.copied')}
              />
              <CopyButton
                value={message}
                label={t('onboard.result.copyMessage')}
                copiedLabel={t('onboard.result.copied')}
                variant="outline"
              />
              {canImpersonate ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setImpersonate(true)}>
                  <Eye /> {t('impersonate.button')}
                </Button>
              ) : null}
              <Button type="button" size="sm" onClick={closeResult}>
                <ExternalLink /> {t('onboard.result.goToShop')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ImpersonateDialog
          tenantId={done.tenantId}
          tenantName={done.name}
          open={impersonate}
          onOpenChange={setImpersonate}
        />
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tc('close')} className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('onboard.title')}</DialogTitle>
          <DialogDescription>{t('onboard.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div>
            <Label htmlFor="ob-name">{t('onboard.name')}</Label>
            <Input id="ob-name" {...form.register('name')} />
            {err(errors.name?.message)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('onboard.industry')}</Label>
              <Select
                value={form.watch('industryKey')}
                onValueChange={(v) => form.setValue('industryKey', v)}
              >
                <SelectTrigger aria-label={t('onboard.industry')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`industry.${k}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('onboard.plan')}</Label>
              <Select
                value={form.watch('planCode')}
                onValueChange={(v) => form.setValue('planCode', v, { shouldValidate: true })}
              >
                <SelectTrigger aria-label={t('onboard.plan')}>
                  <SelectValue placeholder={t('onboard.planPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {sellable.plans.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {planLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {err(errors.planCode?.message)}
            </div>
          </div>
          <PlanPicker
            plans={plans.data ?? []}
            onPick={(code) => {
              if (sellable.plans.some((p) => p.code === code)) {
                form.setValue('planCode', code, { shouldValidate: true });
              }
            }}
          />
          <div>
            <Label htmlFor="ob-owner">{t('onboard.ownerName')}</Label>
            <Input id="ob-owner" autoComplete="off" {...form.register('ownerName')} />
          </div>
          <div>
            <Label htmlFor="ob-email">{t('onboard.ownerEmail')}</Label>
            <Input
              id="ob-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              {...form.register('ownerEmail')}
            />
            {err(errors.ownerEmail?.message)}
          </div>
          <div>
            <Label htmlFor="ob-phone">{t('onboard.ownerPhone')}</Label>
            <PhoneInput
              id="ob-phone"
              value={form.watch('ownerPhone')}
              onChange={(v) => form.setValue('ownerPhone', v, { shouldValidate: form.formState.isSubmitted })}
              invalid={!!errors.ownerPhone}
              errorText={false}
            />
            {err(errors.ownerPhone?.message)}
          </div>
          <div>
            <Label>{t('onboard.status')}</Label>
            <Select
              value={form.watch('status')}
              onValueChange={(v) => form.setValue('status', v as 'trial' | 'active')}
            >
              <SelectTrigger aria-label={t('onboard.status')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">{t('tenantStatus.trial')}</SelectItem>
                <SelectItem value="active">{t('tenantStatus.active')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t('onboard.branches')}</legend>
            {branches.fields.map((f, i) => (
              <div key={f.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <Input
                    aria-label={t('onboard.branchName', { n: i + 1 })}
                    placeholder={t('onboard.branchName', { n: i + 1 })}
                    {...form.register(`branches.${i}.name`)}
                  />
                  {err(errors.branches?.[i]?.name?.message)}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  blockedReason={branches.fields.length === 1 && t('onboard.needOneBranch')}
                  onClick={() => branches.remove(i)}
                  aria-label={tc('delete')}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() => branches.append({ name: '' })}
            >
              <Plus /> {t('onboard.addBranch')}
            </Button>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t('onboard.account.legend')}</legend>
            {(['password', 'invite'] as const).map((m) => (
              <label key={m} className="flex min-h-11 cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="ob-account"
                  value={m}
                  checked={ownerAccount === m}
                  onChange={() => form.setValue('ownerAccount', m)}
                  className="mt-1 size-4"
                />
                <span>
                  {t(`onboard.account.${m}`)}
                  <span className="block text-xs text-muted-foreground">{t(`onboard.account.${m}Hint`)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t('onboard.creating') : t('onboard.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
