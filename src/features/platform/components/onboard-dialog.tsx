import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
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
import { useCreateTenant, usePlans } from '../api';
import { INDUSTRY_KEYS } from './common';

const schema = z.object({
  name: z.string().trim().min(1, 'validation.required'),
  industryKey: z.string().min(1, 'validation.required'),
  ownerEmail: z.email('validation.email'),
  ownerName: z.string().trim().optional(),
  planCode: z.string().min(1, 'validation.required'),
  status: z.enum(['trial', 'active']),
  branches: z.array(z.object({ name: z.string().trim().min(1, 'validation.required') })).min(1),
});
type Values = z.infer<typeof schema>;

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
  const create = useCreateTenant();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      industryKey: 'generic',
      ownerEmail: '',
      ownerName: '',
      planCode: '',
      status: 'trial',
      branches: [{ name: '' }],
    },
  });
  const branches = useFieldArray({ control: form.control, name: 'branches' });
  const errors = form.formState.errors;
  const err = (key?: string) =>
    key ? <p className="mt-1 text-xs text-destructive">{tc(key, { defaultValue: key })}</p> : null;

  const submit = form.handleSubmit(async (v) => {
    const res = await create.mutateAsync({
      name: v.name,
      industryKey: v.industryKey,
      ownerEmail: v.ownerEmail,
      ownerName: v.ownerName || undefined,
      planCode: v.planCode,
      status: v.status,
      branches: v.branches.map((b) => ({ name: b.name })),
    });
    toast.success(res.data.passwordResetSent ? t('onboard.createdWithMail') : t('onboard.created'));
    form.reset();
    onOpenChange(false);
    onCreated(res.data.tenantId);
  });

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
                  {(plans.data ?? [])
                    .filter((p) => p.active)
                    .map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {err(errors.planCode?.message)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ob-email">{t('onboard.ownerEmail')}</Label>
              <Input id="ob-email" type="email" inputMode="email" {...form.register('ownerEmail')} />
              {err(errors.ownerEmail?.message)}
            </div>
            <div>
              <Label htmlFor="ob-owner">{t('onboard.ownerName')}</Label>
              <Input id="ob-owner" {...form.register('ownerName')} />
            </div>
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
                  disabled={branches.fields.length === 1}
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
