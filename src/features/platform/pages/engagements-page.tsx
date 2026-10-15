import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { Briefcase, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useInvalidToast } from '@/lib/form-errors';
import { useCan } from '@/lib/permissions';
import { type Engagement, useCreateEngagement, useEngagements, useTenants } from '../api';
import { formatDate, formatMoney, parseBahtToMinor, useIntlLocale } from '../format';

export const ENGAGEMENT_TYPES = [
  'free_check',
  'workshop',
  'small_shop_setup',
  'audit',
  'reset_90',
  'retainer',
] as const;
const STATUSES = ['proposed', 'active', 'completed', 'cancelled'] as const;

export function EngagementStatusBadge({ status }: { status: Engagement['status'] }) {
  const { t } = useTranslation('platform');
  const tone = {
    proposed: 'secondary',
    active: 'success',
    completed: 'outline',
    cancelled: 'destructive',
  } as const;
  return <Badge variant={tone[status]}>{t(`engagementStatus.${status}`)}</Badge>;
}

export function EngagementsPage() {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const [status, setStatus] = useState<string>('__all__');
  const [creating, setCreating] = useState(false);
  const canWrite = useCan('platform:read');
  const engagements = useEngagements({
    status: status === '__all__' ? undefined : (status as Engagement['status']),
  });

  return (
    <>
      <PageHeader
        title={t('engagements.title')}
        description={t('engagements.description')}
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus /> {t('engagements.add')}
            </Button>
          ) : null
        }
      />
      <div className="mb-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48" aria-label={t('engagements.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('engagements.allStatuses')}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`engagementStatus.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <QueryState
        query={engagements}
        isEmpty={(rows) => rows.length === 0}
        empty={
          <EmptyState
            icon={Briefcase}
            title={t('engagements.empty')}
            description={t('engagements.emptyHint')}
          />
        }
      >
        {(rows) => (
          <>
            <ul className="grid gap-2 lg:hidden">
              {rows.map((e) => (
                <li key={e.id}>
                  <Link
                    to="/platform/engagements/$id"
                    params={{ id: e.id }}
                    className="block rounded-lg border bg-card p-4 active:bg-accent"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 font-semibold">{e.tenantName}</div>
                      <EngagementStatusBadge status={e.status} />
                    </div>
                    <div className="mt-1 text-sm">{t(`engagementType.${e.type}`)}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {formatDate(e.startsOn, locale)} – {formatDate(e.endsOn, locale)}
                    </div>
                    <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
                      <span>
                        {formatMoney(e.feeMinor, locale)}
                        {e.billing === 'monthly' ? ` ${t('engagements.perMonth')}` : ''}
                      </span>
                      <span className="text-muted-foreground">
                        {e.tasksTotal === 0 ? '–' : `${e.tasksDone}/${e.tasksTotal}`}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-lg border lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('engagements.col.shop')}</TableHead>
                    <TableHead>{t('engagements.col.type')}</TableHead>
                    <TableHead>{t('engagements.col.status')}</TableHead>
                    <TableHead>{t('engagements.col.period')}</TableHead>
                    <TableHead>{t('engagements.col.consultant')}</TableHead>
                    <TableHead className="text-right">{t('engagements.col.fee')}</TableHead>
                    <TableHead className="text-right">{t('engagements.col.progress')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Link
                          to="/platform/engagements/$id"
                          params={{ id: e.id }}
                          className="font-medium hover:underline"
                        >
                          {e.tenantName}
                        </Link>
                      </TableCell>
                      <TableCell>{t(`engagementType.${e.type}`)}</TableCell>
                      <TableCell>
                        <EngagementStatusBadge status={e.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(e.startsOn, locale)} – {formatDate(e.endsOn, locale)}
                      </TableCell>
                      <TableCell>{e.leadConsultantName ?? '–'}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(e.feeMinor, locale)}
                        {e.billing === 'monthly' ? (
                          <span className="text-xs text-muted-foreground"> {t('engagements.perMonth')}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        {e.tasksTotal === 0 ? '–' : `${e.tasksDone}/${e.tasksTotal}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </QueryState>
      <CreateEngagementDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

const schema = z.object({
  tenantId: z.string().min(1, 'validation.required'),
  type: z.enum(ENGAGEMENT_TYPES),
  status: z.enum(STATUSES),
  startsOn: z.string().optional(),
  endsOn: z.string().optional(),
  fee: z.string().optional(),
  billing: z.enum(['one_time', 'monthly']),
});

function CreateEngagementDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation('platform');
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const tenants = useTenants({});
  const create = useCreateEngagement();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantId: '',
      type: 'reset_90',
      status: 'proposed',
      startsOn: '',
      endsOn: '',
      fee: '',
      billing: 'one_time',
    },
  });
  const invalid = useInvalidToast<z.infer<typeof schema>>();
  const submit = form.handleSubmit(async (v) => {
    const fee = v.fee ? parseBahtToMinor(v.fee) : 0;
    if (fee === null) {
      form.setError('fee', { message: 'validation.amount' });
      return;
    }
    const res = await create.mutateAsync({
      tenantId: v.tenantId,
      type: v.type,
      status: v.status,
      startsOn: v.startsOn || undefined,
      endsOn: v.endsOn || undefined,
      feeMinor: fee,
      billing: v.billing,
    });
    toast.success(t('engagements.created'));
    onOpenChange(false);
    form.reset();
    void navigate({ to: '/platform/engagements/$id', params: { id: res.data.id } });
  }, invalid);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle>{t('engagements.add')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3" noValidate>
          <div>
            <Label>{t('engagements.col.shop')}</Label>
            <Select
              value={form.watch('tenantId')}
              onValueChange={(v) => form.setValue('tenantId', v, { shouldValidate: true })}
            >
              <SelectTrigger aria-label={t('engagements.col.shop')}>
                <SelectValue placeholder={t('engagements.pickShop')} />
              </SelectTrigger>
              <SelectContent>
                {(tenants.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.tenantId ? (
              <p className="mt-1 text-xs text-destructive">
                {tc('validation.required', { defaultValue: 'Required' })}
              </p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t('engagements.col.type')}</Label>
              <Select
                value={form.watch('type')}
                onValueChange={(v) => form.setValue('type', v as (typeof ENGAGEMENT_TYPES)[number])}
              >
                <SelectTrigger aria-label={t('engagements.col.type')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENGAGEMENT_TYPES.map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`engagementType.${k}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('engagements.col.status')}</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(v) => form.setValue('status', v as (typeof STATUSES)[number])}
              >
                <SelectTrigger aria-label={t('engagements.col.status')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`engagementStatus.${k}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="eg-start">{t('engagements.startsOn')}</Label>
              <Input id="eg-start" type="date" {...form.register('startsOn')} />
            </div>
            <div>
              <Label htmlFor="eg-end">{t('engagements.endsOn')}</Label>
              <Input id="eg-end" type="date" {...form.register('endsOn')} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="eg-fee">{t('engagements.fee')}</Label>
              <Input id="eg-fee" inputMode="decimal" placeholder="0" {...form.register('fee')} />
              {form.formState.errors.fee ? (
                <p className="mt-1 text-xs text-destructive">{t('engagements.badAmount')}</p>
              ) : null}
            </div>
            <div>
              <Label>{t('engagements.billing')}</Label>
              <Select
                value={form.watch('billing')}
                onValueChange={(v) => form.setValue('billing', v as 'one_time' | 'monthly')}
              >
                <SelectTrigger aria-label={t('engagements.billing')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">{t('engagements.oneTime')}</SelectItem>
                  <SelectItem value="monthly">{t('engagements.monthly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('engagements.playbookHint')}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {t('engagements.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
