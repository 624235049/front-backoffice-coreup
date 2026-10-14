import { zodResolver } from '@hookform/resolvers/zod';
import { Phone, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useMe } from '@/lib/me';
import { cn } from '@/lib/utils';
import {
  type Lead,
  type LeadStage,
  useAddLeadActivity,
  useConvertLead,
  useCreateLead,
  useLead,
  useLeads,
  usePatchLead,
  usePlans,
} from '../api';
import { INDUSTRY_KEYS } from '../components/common';
import { formatDateTime, useIntlLocale } from '../format';

/** Board columns in sales order (docs/02 §6.9: new → contacted → checked → proposal → won / lost; nurture parks a lead). */
const STAGES: LeadStage[] = ['new', 'contacted', 'checked', 'proposal', 'won', 'lost', 'nurture'];
const ACTIVITY_TYPES = ['call', 'chat', 'visit', 'meeting', 'note', 'proposal', 'free_check'] as const;

export function LeadsPage() {
  const { t } = useTranslation('platform');
  const leads = useLeads();
  const patch = usePatchLead();
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<LeadStage | null>(null);
  const [lostFor, setLostFor] = useState<Lead | null>(null);
  const [lostReason, setLostReason] = useState('');

  const move = (lead: Lead, stage: LeadStage) => {
    if (lead.stage === stage) return;
    if (stage === 'lost') {
      setLostFor(lead);
      return;
    }
    patch.mutate(
      { id: lead.id, body: { stage } },
      { onSuccess: () => toast.success(t('leads.moved', { stage: t(`leadStage.${stage}`) })) },
    );
  };

  return (
    <>
      <PageHeader
        title={t('leads.title')}
        description={t('leads.description')}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus /> {t('leads.add')}
          </Button>
        }
      />
      <QueryState
        query={leads}
        isEmpty={(rows) => rows.length === 0}
        empty={
          <EmptyState
            icon={Phone}
            title={t('leads.empty')}
            description={t('leads.emptyHint')}
            action={<Button onClick={() => setAdding(true)}>{t('leads.add')}</Button>}
          />
        }
        skeleton={<div className="h-64 animate-pulse rounded-xl bg-muted" aria-busy="true" />}
      >
        {(rows) => (
          <div className="flex gap-3 overflow-x-auto pb-4" data-testid="kanban">
            {STAGES.map((stage) => {
              const cards = rows.filter((l) => l.stage === stage);
              return (
                <section
                  key={stage}
                  aria-label={t(`leadStage.${stage}`)}
                  data-stage={stage}
                  className={cn(
                    'flex min-h-56 w-64 shrink-0 flex-col gap-2 rounded-xl bg-muted/50 p-2',
                    overStage === stage && 'ring-2 ring-primary',
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverStage(stage);
                  }}
                  onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOverStage(null);
                    const lead = rows.find((l) => l.id === (dragId ?? e.dataTransfer.getData('text/plain')));
                    if (lead) move(lead, stage);
                    setDragId(null);
                  }}
                >
                  <h2 className="flex items-center justify-between px-1 text-sm font-semibold">
                    {t(`leadStage.${stage}`)} <Badge variant="outline">{cards.length}</Badge>
                  </h2>
                  {cards.map((l) => (
                    <LeadCard
                      key={l.id}
                      lead={l}
                      onOpen={() => setSelected(l.id)}
                      onMove={(s) => move(l, s)}
                      onDragStart={() => setDragId(l.id)}
                    />
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </QueryState>

      <AddLeadDialog open={adding} onOpenChange={setAdding} />
      <LeadSheet id={selected} onClose={() => setSelected(null)} onMove={move} />

      <Dialog open={lostFor !== null} onOpenChange={(o) => !o && setLostFor(null)}>
        <DialogContent closeLabel={t('common.close')}>
          <DialogHeader>
            <DialogTitle>{t('leads.lostTitle', { name: lostFor?.businessName })}</DialogTitle>
            <DialogDescription>{t('leads.lostHint')}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            rows={3}
            aria-label={t('leads.lostReason')}
            placeholder={t('leads.lostReason')}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostFor(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={lostReason.trim().length === 0 || patch.isPending}
              onClick={() => {
                if (!lostFor) return;
                patch.mutate(
                  { id: lostFor.id, body: { stage: 'lost', lostReason: lostReason.trim() } },
                  {
                    onSuccess: () => {
                      setLostFor(null);
                      setLostReason('');
                    },
                  },
                );
              }}
            >
              {t('leads.markLost')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LeadCard({
  lead,
  onOpen,
  onMove,
  onDragStart,
}: {
  lead: Lead;
  onOpen: () => void;
  onMove: (s: LeadStage) => void;
  onDragStart: () => void;
}) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const overdue =
    lead.nextActionAt !== null &&
    new Date(lead.nextActionAt) < new Date() &&
    lead.stage !== 'won' &&
    lead.stage !== 'lost';
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', lead.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      className="cursor-grab rounded-lg border bg-card p-3 text-sm shadow-xs active:cursor-grabbing"
      data-lead-id={lead.id}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left font-medium hover:underline">
        {lead.businessName}
      </button>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {[
          lead.contactName,
          lead.industryKey ? t(`industry.${lead.industryKey}`, { defaultValue: lead.industryKey }) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </div>
      {lead.nextActionAt ? (
        <div
          className={cn('mt-1 text-xs', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}
        >
          {overdue ? `${t('leads.overdue')} · ` : ''}
          {t('leads.nextAction')}: {formatDateTime(lead.nextActionAt, locale)}
        </div>
      ) : null}
      <div className="mt-1 text-xs text-muted-foreground">{lead.ownerName ?? t('leads.noOwner')}</div>
      <Select value={lead.stage} onValueChange={(v) => onMove(v as LeadStage)}>
        <SelectTrigger className="mt-2 h-8 text-xs" aria-label={t('leads.moveTo')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STAGES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`leadStage.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </article>
  );
}

const addSchema = z.object({
  businessName: z.string().trim().min(1, 'validation.required'),
  contactName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  industryKey: z.string().optional(),
  message: z.string().trim().optional(),
});
type AddValues = z.infer<typeof addSchema>;

function AddLeadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation('platform');
  const { t: tc } = useTranslation('common');
  const create = useCreateLead();
  const form = useForm<AddValues>({
    resolver: zodResolver(addSchema),
    defaultValues: { businessName: '', contactName: '', phone: '', industryKey: undefined, message: '' },
  });
  const submit = form.handleSubmit(async (v) => {
    await create.mutateAsync({
      businessName: v.businessName,
      contactName: v.contactName || undefined,
      phone: v.phone || undefined,
      industryKey: v.industryKey || undefined,
      message: v.message || undefined,
      source: 'manual',
    });
    form.reset();
    onOpenChange(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle>{t('leads.add')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3" noValidate>
          <div>
            <Label htmlFor="lead-business">{t('leads.businessName')}</Label>
            <Input id="lead-business" {...form.register('businessName')} />
            {form.formState.errors.businessName ? (
              <p className="mt-1 text-xs text-destructive">
                {tc('validation.required', { defaultValue: 'Required' })}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lead-contact">{t('leads.contactName')}</Label>
              <Input id="lead-contact" {...form.register('contactName')} />
            </div>
            <div>
              <Label htmlFor="lead-phone">{t('leads.phone')}</Label>
              <Input id="lead-phone" inputMode="tel" {...form.register('phone')} />
            </div>
          </div>
          <div>
            <Label>{t('onboard.industry')}</Label>
            <Select value={form.watch('industryKey')} onValueChange={(v) => form.setValue('industryKey', v)}>
              <SelectTrigger aria-label={t('onboard.industry')}>
                <SelectValue placeholder="–" />
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
            <Label htmlFor="lead-message">{t('leads.message')}</Label>
            <Textarea id="lead-message" rows={3} {...form.register('message')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {t('leads.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LeadSheet({
  id,
  onClose,
  onMove,
}: {
  id: string | null;
  onClose: () => void;
  onMove: (lead: Lead, stage: LeadStage) => void;
}) {
  const { t } = useTranslation('platform');
  const { t: tc } = useTranslation('common');
  const locale = useIntlLocale();
  const lead = useLead(id);
  const patch = usePatchLead();
  const activity = useAddLeadActivity();
  const me = useMe();
  const [type, setType] = useState<(typeof ACTIVITY_TYPES)[number]>('call');
  const [note, setNote] = useState('');
  const [next, setNext] = useState('');
  const [converting, setConverting] = useState(false);
  const data = lead.data?.data;
  const myId = me.data?.user.id;

  return (
    <Sheet open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent closeLabel={tc('close')} className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{data?.businessName ?? t('leads.title')}</SheetTitle>
          <SheetDescription>{data ? t(`leadStage.${data.stage}`) : ''}</SheetDescription>
        </SheetHeader>
        <QueryState query={lead}>
          {({ data: d }) => (
            <div className="grid gap-4 px-4 pb-6 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">{t('leads.contactName')}</div>
                  {d.contactName ?? '–'}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('leads.phone')}</div>
                  {d.phone ?? '–'}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('leads.owner')}</div>
                  {d.ownerName ?? '–'}{' '}
                  {myId && d.ownerUserId !== myId ? (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => patch.mutate({ id: d.id, body: { ownerUserId: myId } })}
                    >
                      {t('leads.takeOver')}
                    </Button>
                  ) : null}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('leads.nextAction')}</div>
                  {d.nextActionAt ? formatDateTime(d.nextActionAt, locale) : '–'}
                </div>
              </div>
              {d.message ? <p className="rounded-md bg-muted/60 p-3">{d.message}</p> : null}
              {d.lostReason ? (
                <p className="text-destructive">
                  {t('leads.lostReason')}: {d.lostReason}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Select value={d.stage} onValueChange={(v) => onMove(d, v as LeadStage)}>
                  <SelectTrigger className="w-44" aria-label={t('leads.moveTo')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`leadStage.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {d.convertedTenantId ? (
                  <Badge variant="success">{t('leads.converted')}</Badge>
                ) : (
                  <Button onClick={() => setConverting(true)}>{t('leads.convert')}</Button>
                )}
              </div>

              <form
                className="grid gap-2 rounded-lg border p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  activity.mutate(
                    {
                      id: d.id,
                      body: {
                        type,
                        note: note.trim() || undefined,
                        nextActionAt: next ? new Date(next).toISOString() : undefined,
                      },
                    },
                    {
                      onSuccess: () => {
                        setNote('');
                        setNext('');
                      },
                    },
                  );
                }}
              >
                <div className="text-sm font-medium">{t('leads.logActivity')}</div>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger aria-label={t('leads.activityType')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((a) => (
                      <SelectItem key={a} value={a}>
                        {t(`activityType.${a}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={t('leads.activityNote')}
                  aria-label={t('leads.activityNote')}
                />
                <div>
                  <Label htmlFor="lead-next">{t('leads.nextAction')}</Label>
                  <Input
                    id="lead-next"
                    type="datetime-local"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={activity.isPending} className="justify-self-start">
                  {t('leads.addActivity')}
                </Button>
              </form>

              <ol className="grid gap-2">
                {d.activities.map((a) => (
                  <li key={a.id} className="rounded-md border px-3 py-2">
                    <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {t(`activityType.${a.type}`)} · {a.byName ?? '–'}
                      </span>
                      <span>{formatDateTime(a.at, locale)}</span>
                    </div>
                    {a.note ? <div className="mt-1">{a.note}</div> : null}
                  </li>
                ))}
              </ol>
              <ConvertDialog
                leadId={d.id}
                defaultIndustry={d.industryKey}
                open={converting}
                onOpenChange={setConverting}
                onDone={onClose}
              />
            </div>
          )}
        </QueryState>
      </SheetContent>
    </Sheet>
  );
}

const convertSchema = z.object({
  ownerEmail: z.string().trim().toLowerCase().pipe(z.email('validation.email')),
  ownerName: z.string().trim().optional(),
  planCode: z.string().min(1, 'validation.required'),
  engagementType: z.string().optional(),
  fee: z.string().optional(),
});

function ConvertDialog({
  leadId,
  defaultIndustry,
  open,
  onOpenChange,
  onDone,
}: {
  leadId: string;
  defaultIndustry: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation('platform');
  const { t: tc } = useTranslation('common');
  const plans = usePlans();
  const convert = useConvertLead();
  const form = useForm<z.infer<typeof convertSchema>>({
    resolver: zodResolver(convertSchema),
    defaultValues: { ownerEmail: '', ownerName: '', planCode: '', engagementType: 'none', fee: '' },
  });
  const industries = useMemo(() => INDUSTRY_KEYS as readonly string[], []);
  const errors = form.formState.errors;
  const submit = form.handleSubmit(async (v) => {
    const fee = v.fee ? Math.round(Number.parseFloat(v.fee.replace(/,/g, '')) * 100) : 0;
    const res = await convert.mutateAsync({
      id: leadId,
      body: {
        ownerEmail: v.ownerEmail,
        ownerName: v.ownerName || undefined,
        planCode: v.planCode,
        industryKey: defaultIndustry && industries.includes(defaultIndustry) ? defaultIndustry : undefined,
        engagement:
          v.engagementType && v.engagementType !== 'none'
            ? {
                type: v.engagementType as 'audit',
                feeMinor: Number.isFinite(fee) ? fee : 0,
                billing: 'one_time',
              }
            : undefined,
      },
    });
    toast.success(t('leads.convertedToast'));
    onOpenChange(false);
    onDone();
    void res;
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle>{t('leads.convert')}</DialogTitle>
          <DialogDescription>{t('leads.convertHint')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cv-email">{t('onboard.ownerEmail')}</Label>
              <Input id="cv-email" type="email" {...form.register('ownerEmail')} />
              {errors.ownerEmail ? (
                <p className="mt-1 text-xs text-destructive">
                  {tc('validation.email', { defaultValue: 'Invalid email' })}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="cv-owner">{t('onboard.ownerName')}</Label>
              <Input id="cv-owner" {...form.register('ownerName')} />
            </div>
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
            {errors.planCode ? (
              <p className="mt-1 text-xs text-destructive">
                {tc('validation.required', { defaultValue: 'Required' })}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('leads.firstEngagement')}</Label>
              <Select
                value={form.watch('engagementType')}
                onValueChange={(v) => form.setValue('engagementType', v)}
              >
                <SelectTrigger aria-label={t('leads.firstEngagement')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('leads.noEngagement')}</SelectItem>
                  {(
                    ['free_check', 'workshop', 'small_shop_setup', 'audit', 'reset_90', 'retainer'] as const
                  ).map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`engagementType.${k}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cv-fee">{t('engagements.fee')}</Label>
              <Input id="cv-fee" inputMode="decimal" placeholder="0" {...form.register('fee')} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={convert.isPending}>
              {t('leads.convertSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
