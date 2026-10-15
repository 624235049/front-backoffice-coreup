import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { CheckCheck, Copy, MessageCircle, Phone, Plus } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
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
import { useInvalidToast } from '@/lib/form-errors';
import { cn } from '@/lib/utils';
import {
  type Lead,
  type LeadDetail,
  type LeadStage,
  useAddLeadActivity,
  useConvertLead,
  useCreateLead,
  useLead,
  useLeadAssignees,
  useLeads,
  usePatchLead,
  usePlans,
} from '../api';
import { INDUSTRY_KEYS } from '../components/common';
import { formatDateTime, parseBahtToMinor, useIntlLocale } from '../format';

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
  const [mobileStage, setMobileStage] = useState<LeadStage | null>(null);

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
        {(rows) => {
          // phone: one stage at a time (chips), desktop/iPad: the whole board
          const shown: LeadStage =
            mobileStage ?? STAGES.find((s) => rows.some((l) => l.stage === s)) ?? 'new';
          return (
            <>
              <nav
                className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden"
                aria-label={t('leads.stagePicker')}
              >
                {STAGES.map((s) => {
                  const n = rows.filter((l) => l.stage === s).length;
                  return (
                    <Button
                      key={s}
                      size="sm"
                      className="h-11 shrink-0"
                      variant={shown === s ? 'default' : 'outline'}
                      aria-pressed={shown === s}
                      onClick={() => setMobileStage(s)}
                    >
                      {t(`leadStage.${s}`)} <span className="tabular-nums">{n}</span>
                    </Button>
                  );
                })}
              </nav>
              <div className="flex gap-3 overflow-x-auto pb-4" data-testid="kanban">
                {STAGES.map((stage) => {
                  const cards = rows
                    .filter((l) => l.stage === stage)
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
                  return (
                    <section
                      key={stage}
                      aria-label={t(`leadStage.${stage}`)}
                      data-stage={stage}
                      className={cn(
                        'flex min-h-56 w-full flex-col gap-2 rounded-xl bg-muted/50 p-2 md:w-64 md:shrink-0',
                        stage !== shown && 'hidden md:flex',
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
                        const lead = rows.find(
                          (l) => l.id === (dragId ?? e.dataTransfer.getData('text/plain')),
                        );
                        if (lead) move(lead, stage);
                        setDragId(null);
                      }}
                    >
                      <h2 className="flex items-center justify-between px-1 text-sm font-semibold">
                        {t(`leadStage.${stage}`)}{' '}
                        <Badge variant={stage === 'new' && cards.length > 0 ? 'destructive' : 'outline'}>
                          {cards.length}
                        </Badge>
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
            </>
          );
        }}
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
            <Button
              variant="outline"
              onClick={() => {
                setLostFor(null);
                setLostReason('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={patch.isPending}
              blockedReason={lostReason.trim().length === 0 && t('leads.lostReasonNeeded')}
              onClick={() => {
                if (!lostFor) return;
                patch.mutate(
                  { id: lostFor.id, body: { stage: 'lost', lostReason: lostReason.trim() } },
                  {
                    onSuccess: () => {
                      setLostFor(null);
                      setLostReason('');
                      toast.success(t('leads.lostToast'));
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
      className={cn(
        'cursor-grab rounded-lg border bg-card p-3 text-sm shadow-xs active:cursor-grabbing',
        lead.stage === 'new' && 'border-destructive/40 bg-destructive/5',
      )}
      data-lead-id={lead.id}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left font-medium hover:underline">
        {lead.stage === 'new' ? (
          <Badge variant="destructive" className="mr-1.5 align-middle">
            {t('leads.newBadge')}
          </Badge>
        ) : null}
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
      {lead.phone || lead.lineId ? (
        <div className="mt-1 text-xs">
          {[lead.phone, lead.lineId ? `LINE ${lead.lineId}` : null].filter(Boolean).join(' · ')}
        </div>
      ) : null}
      <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(lead.createdAt, locale)}</div>
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
        <SelectTrigger className="mt-2 text-xs" aria-label={t('leads.moveTo')}>
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
  const invalid = useInvalidToast<AddValues>();
  const submit = form.handleSubmit(async (v) => {
    await create.mutateAsync({
      businessName: v.businessName,
      contactName: v.contactName || undefined,
      phone: v.phone || undefined,
      industryKey: v.industryKey || undefined,
      message: v.message || undefined,
      source: 'manual',
    });
    toast.success(t('leads.addedToast'));
    form.reset();
    onOpenChange(false);
  }, invalid);
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
  const activity = useAddLeadActivity();
  const [type, setType] = useState<(typeof ACTIVITY_TYPES)[number]>('call');
  const [note, setNote] = useState('');
  const [next, setNext] = useState('');
  const [converting, setConverting] = useState(false);
  const data = lead.data?.data;

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
              <LeadQuickActions d={d} />
              <LeadDetails d={d} />
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
                        toast.success(t('leads.activityToast'));
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
                <Button
                  type="submit"
                  disabled={activity.isPending}
                  blockedReason={note.trim() === '' && next === '' && t('leads.activityEmpty')}
                  className="justify-self-start"
                >
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

/** Call / copy number / open LINE / mark contacted / hand over to a teammate: what a salesperson does first. */
function LeadQuickActions({ d }: { d: LeadDetail }) {
  const { t } = useTranslation('platform');
  const patch = usePatchLead();
  const assignees = useLeadAssignees();
  const copy = async () => {
    if (!d.phone) return;
    try {
      await navigator.clipboard.writeText(d.phone);
      toast.success(t('leads.copied'));
    } catch {
      toast.error(t('leads.copyFailed', { phone: d.phone }));
    }
  };
  return (
    <div className="grid gap-3 rounded-lg border p-3" data-testid="lead-quick-actions">
      <div className="text-sm font-medium">{t('leads.quickActions')}</div>
      <div className="flex flex-wrap gap-2">
        {d.phone ? (
          <>
            <Button asChild>
              <a href={`tel:${d.phone.replace(/[^\d+]/g, '')}`}>
                <Phone /> {t('leads.call')}
              </a>
            </Button>
            <Button variant="outline" onClick={copy}>
              <Copy /> {t('leads.copyPhone')}
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">{t('leads.noPhone')}</span>
        )}
        {d.lineId ? (
          <Button asChild variant="outline">
            <a
              href={`https://line.me/ti/p/~${encodeURIComponent(d.lineId.replace(/^@/, ''))}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle /> {t('leads.openLine')}
            </a>
          </Button>
        ) : null}
        {d.stage === 'new' ? (
          <Button
            variant="secondary"
            disabled={patch.isPending}
            onClick={() =>
              patch.mutate(
                { id: d.id, body: { stage: 'contacted' } },
                { onSuccess: () => toast.success(t('leads.contactedToast')) },
              )
            }
          >
            <CheckCheck /> {t('leads.markContacted')}
          </Button>
        ) : null}
      </div>
      <div>
        <Label>{t('leads.assign')}</Label>
        <Select
          value={d.ownerUserId ?? ''}
          onValueChange={(v) =>
            patch.mutate(
              { id: d.id, body: { ownerUserId: v } },
              { onSuccess: () => toast.success(t('leads.assignedToast')) },
            )
          }
        >
          <SelectTrigger aria-label={t('leads.assign')}>
            <SelectValue placeholder={t('leads.assignPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {(assignees.data ?? []).map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="break-words">{children}</div>
    </div>
  );
}

/** Everything the customer typed in the website form, plus where they came from. */
function LeadDetails({ d }: { d: LeadDetail }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const utm = d.utm ?? {};
  const str = (k: string) => (typeof utm[k] === 'string' && utm[k] ? (utm[k] as string) : null);
  const campaign = ['utm_source', 'utm_medium', 'utm_campaign', 'campaign', 'medium']
    .map((k) => str(k))
    .filter(Boolean)
    .join(' / ');
  const leakMinor = (d.leakEstimate as { result?: { totalMonthlyMinor?: number } } | null)?.result
    ?.totalMonthlyMinor;
  return (
    <div className="grid gap-3" data-testid="lead-details">
      <div className="text-sm font-medium">{t('leads.details')}</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('leads.contactName')}>{d.contactName ?? '–'}</Field>
        <Field label={t('leads.phone')}>{d.phone ?? '–'}</Field>
        <Field label={t('leads.lineId')}>{d.lineId ?? '–'}</Field>
        <Field label={t('leads.industry')}>
          {d.industryKey ? t(`industry.${d.industryKey}`, { defaultValue: d.industryKey }) : '–'}
        </Field>
        <Field label={t('leads.branchCount')}>
          {d.branchCount ? t('leads.branchValue', { value: d.branchCount }) : '–'}
        </Field>
        <Field label={t('leads.staffCount')}>
          {d.staffCount ? t('leads.staffValue', { value: d.staffCount }) : '–'}
        </Field>
        <Field label={t('leads.province')}>{d.province ?? '–'}</Field>
        <Field label={t('leads.receivedAt')}>{formatDateTime(d.createdAt, locale)}</Field>
        <Field label={t('leads.owner')}>{d.ownerName ?? t('leads.noOwner')}</Field>
        <Field label={t('leads.nextAction')}>
          {d.nextActionAt ? formatDateTime(d.nextActionAt, locale) : '–'}
        </Field>
      </div>
      {d.painPoints.length > 0 ? (
        <Field label={t('leads.painPoints')}>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {d.painPoints.map((p) => (
              <li key={p}>
                <Badge variant="outline">{p}</Badge>
              </li>
            ))}
          </ul>
        </Field>
      ) : null}
      {d.message ? (
        <Field label={t('leads.message')}>
          <p className="whitespace-pre-wrap rounded-md bg-muted/60 p-3">{d.message}</p>
        </Field>
      ) : null}
      {leakMinor ? (
        <Field label={t('leads.leak')}>
          {t('leads.leakValue', { amount: Math.round(leakMinor / 100).toLocaleString(locale) })}
        </Field>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('leads.source')}>{d.source ?? '–'}</Field>
        <Field label={t('leads.landingPath')}>{str('landingPath') ?? '–'}</Field>
        <Field label={t('leads.referrer')}>{str('referrer') ?? '–'}</Field>
        <Field label={t('leads.utm')}>{campaign || '–'}</Field>
      </div>
    </div>
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
  const navigate = useNavigate();
  const invalid = useInvalidToast<z.infer<typeof convertSchema>>();
  const firstPlan = (plans.data ?? []).find((p) => p.active)?.code;
  const planCode = form.watch('planCode');
  const engagementType = form.watch('engagementType');
  const noEngagement = !engagementType || engagementType === 'none';
  // one tap less: start from the first active package
  useEffect(() => {
    if (firstPlan && !planCode) form.setValue('planCode', firstPlan);
  }, [firstPlan, planCode, form]);
  const industries = useMemo(() => INDUSTRY_KEYS as readonly string[], []);
  const errors = form.formState.errors;
  const submit = form.handleSubmit(async (v) => {
    const fee = !noEngagement && v.fee?.trim() ? parseBahtToMinor(v.fee) : 0;
    if (fee === null) {
      form.setError('fee', { message: 'leads.feeInvalid' });
      return;
    }
    const res = await convert.mutateAsync({
      id: leadId,
      body: {
        ownerEmail: v.ownerEmail,
        ownerName: v.ownerName || undefined,
        planCode: v.planCode,
        industryKey: defaultIndustry && industries.includes(defaultIndustry) ? defaultIndustry : undefined,
        engagement: noEngagement
          ? undefined
          : { type: v.engagementType as 'audit', feeMinor: fee, billing: 'one_time' },
      },
    });
    const { tenantId, engagementId } = res.data;
    toast.success(t('leads.convertedToast'), {
      action: {
        label: engagementId ? t('leads.openEngagement') : t('leads.openShop'),
        onClick: () =>
          void (engagementId
            ? navigate({ to: '/platform/engagements/$id', params: { id: engagementId } })
            : navigate({ to: '/platform/tenants/$id', params: { id: tenantId } })),
      },
    });
    onOpenChange(false);
    onDone();
  }, invalid);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle>{t('leads.convert')}</DialogTitle>
          <DialogDescription>{t('leads.convertHint')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
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
          <div className="grid gap-3 sm:grid-cols-2">
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
              <Input
                id="cv-fee"
                inputMode="decimal"
                placeholder="0"
                disabled={noEngagement}
                {...form.register('fee')}
              />
              {errors.fee ? <p className="mt-1 text-xs text-destructive">{t('leads.feeInvalid')}</p> : null}
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
