import { Link } from '@tanstack/react-router';
import { Check, Circle, NotebookPen, Rocket } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Can } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import {
  type OnboardingQuery,
  type OnboardingRow,
  useAddTenantFollowup,
  useOnboarding,
  useTenantFollowups,
} from '../api';
import { OwnerPhone } from '../components/owner-phone';
import { formatDate, formatDateTime, todayBangkok, useIntlLocale } from '../format';
import { addDays, daysAgo, doneCount, MILESTONES } from '../onboarding';

const RANGES = ['7', '14', '30', '60'] as const;
const FOLLOWUP_TYPES = ['call', 'line', 'chat', 'visit', 'meeting', 'note'] as const;
const FOLLOWUP_RESULTS = ['reached', 'no_answer', 'callback', 'not_interested'] as const;
const NO_RESULT = '__none__';
const DUE_TONE = { new: 'secondary', scheduled: 'warning', stuck: 'destructive' } as const;

type Target = { id: string; name: string };

export function OnboardingPage() {
  const { t } = useTranslation('platform');
  const [days, setDays] = useState<OnboardingQuery['days']>('30');
  const [target, setTarget] = useState<Target | null>(null);
  const board = useOnboarding(days);

  return (
    <>
      <PageHeader title={t('onboarding.title')} description={t('onboarding.description')} />
      <Tabs value={days} onValueChange={(v) => setDays(v as typeof days)} className="mb-4">
        <TabsList>
          {RANGES.map((d) => (
            <TabsTrigger key={d} value={d}>
              {t('onboarding.days', { count: Number(d) })}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <QueryState
        query={board}
        isEmpty={(d) => d.rows.length === 0}
        empty={
          <EmptyState icon={Rocket} title={t('onboarding.empty')} description={t('onboarding.emptyHint')} />
        }
      >
        {(d) => {
          const due = d.rows.filter((r) => r.due);
          const rest = d.rows.filter((r) => !r.due);
          return (
            <div className="grid gap-6">
              <section aria-labelledby="onboarding-due" className="grid gap-2">
                <h2 id="onboarding-due" className="font-semibold">
                  {t('onboarding.dueSection', { count: due.length })}
                </h2>
                {due.length > 0 ? (
                  <ShopList rows={due} onLog={setTarget} />
                ) : (
                  <p className="text-sm text-muted-foreground">{t('onboarding.noneDue')}</p>
                )}
              </section>
              {rest.length > 0 ? (
                <section aria-labelledby="onboarding-rest" className="grid gap-2">
                  <h2 id="onboarding-rest" className="font-semibold">
                    {t('onboarding.restSection', { count: rest.length })}
                  </h2>
                  <ShopList rows={rest} onLog={setTarget} />
                </section>
              ) : null}
            </div>
          );
        }}
      </QueryState>
      <FollowupSheet target={target} onClose={() => setTarget(null)} />
    </>
  );
}

function ShopList({ rows, onLog }: { rows: OnboardingRow[]; onLog: (t: Target) => void }) {
  const { t } = useTranslation('platform');
  return (
    <>
      <ul className="grid gap-2 lg:hidden">
        {rows.map((r) => (
          <li key={r.id} className="grid gap-3 rounded-lg border bg-card p-4">
            <ShopInfo r={r} />
            <OwnerInfo r={r} />
            <Progress r={r} />
            <Activity r={r} />
            <ContactInfo r={r} />
            <LogButton r={r} onLog={onLog} />
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-lg border lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('onboarding.col.shop')}</TableHead>
              <TableHead>{t('onboarding.col.owner')}</TableHead>
              <TableHead>{t('onboarding.col.progress')}</TableHead>
              <TableHead>{t('onboarding.col.activity')}</TableHead>
              <TableHead>{t('onboarding.col.contact')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="align-top">
                <TableCell>
                  <ShopInfo r={r} />
                </TableCell>
                <TableCell>
                  <OwnerInfo r={r} />
                </TableCell>
                <TableCell>
                  <Progress r={r} />
                </TableCell>
                <TableCell>
                  <Activity r={r} />
                </TableCell>
                <TableCell>
                  <ContactInfo r={r} />
                </TableCell>
                <TableCell>
                  <LogButton r={r} onLog={onLog} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function ShopInfo({ r }: { r: OnboardingRow }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const age = daysAgo(r.createdAt);
  return (
    <div className="grid gap-1">
      <Link to="/platform/tenants/$id" params={{ id: r.id }} className="font-medium hover:underline">
        {r.name}
      </Link>
      <div className="text-xs text-muted-foreground">
        {r.industryKey ? t(`industry.${r.industryKey}`, { defaultValue: r.industryKey }) : '–'} ·{' '}
        {age === 0 ? t('onboarding.signedUpToday') : t('onboarding.signedUp', { count: age })}
        {r.trialEndsOn ? ` · ${t('onboarding.trialEnds', { date: formatDate(r.trialEndsOn, locale) })}` : ''}
      </div>
      {r.dueReason ? (
        <Badge variant={DUE_TONE[r.dueReason]}>{t(`onboarding.dueReason.${r.dueReason}`)}</Badge>
      ) : null}
    </div>
  );
}

function OwnerInfo({ r }: { r: OnboardingRow }) {
  return (
    <div className="grid gap-0.5 text-sm">
      <div>{r.ownerName ?? '–'}</div>
      <OwnerPhone phone={r.ownerPhone} className="-ml-1" />
      {r.ownerEmail ? <div className="break-all text-xs text-muted-foreground">{r.ownerEmail}</div> : null}
    </div>
  );
}

/** Icon plus text: never meaning by colour alone. */
function Progress({ r }: { r: OnboardingRow }) {
  const { t } = useTranslation('platform');
  return (
    <div className="grid gap-1 text-xs">
      <div className="font-medium">
        {t('onboarding.progress', { done: doneCount(r.milestones), total: MILESTONES.length })}
      </div>
      <ul className="grid gap-0.5">
        {MILESTONES.map((k) => (
          <li key={k} className={cn('flex items-center gap-1', !r.milestones[k] && 'text-muted-foreground')}>
            {r.milestones[k] ? (
              <Check className="size-3.5 text-success" aria-hidden />
            ) : (
              <Circle className="size-3.5" aria-hidden />
            )}
            <span className="sr-only">{t(r.milestones[k] ? 'onboarding.done' : 'onboarding.notDone')}: </span>
            {t(`onboarding.step.${k}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Activity({ r }: { r: OnboardingRow }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const idle = r.lastActiveAt ? daysAgo(r.lastActiveAt) : null;
  return (
    <div className="grid gap-1 text-xs">
      <div>
        <span className="text-muted-foreground">{t('onboarding.lastActive')}: </span>
        <span title={formatDateTime(r.lastActiveAt, locale)}>
          {idle === null
            ? t('onboarding.neverUsed')
            : idle === 0
              ? t('onboarding.today')
              : t('onboarding.ago', { count: idle })}
        </span>
      </div>
      <div className="text-muted-foreground">{t('onboarding.appointments', { count: r.appointments })}</div>
      <div>
        <span className="text-muted-foreground">{t('onboarding.nudges')}: </span>
        {r.nudges.length === 0
          ? '–'
          : r.nudges.map((n) => `${t(`onboarding.nudge.${n.key}`)} (${formatDate(n.at, locale)})`).join(', ')}
      </div>
    </div>
  );
}

function ContactInfo({ r }: { r: OnboardingRow }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const overdue = r.nextFollowUpOn !== null && r.nextFollowUpOn < todayBangkok();
  return (
    <div className="grid gap-1 text-xs">
      {r.lastContact ? (
        <div>
          <div>
            {t(`onboarding.type.${r.lastContact.type}`, { defaultValue: r.lastContact.type })} ·{' '}
            {r.lastContact.byName ?? '–'} · {formatDate(r.lastContact.at, locale)}
          </div>
          {r.lastContact.note ? (
            <div className="line-clamp-2 text-muted-foreground">{r.lastContact.note}</div>
          ) : null}
        </div>
      ) : (
        <div className="text-muted-foreground">{t('onboarding.neverContacted')}</div>
      )}
      {r.nextFollowUpOn ? (
        <div className={cn(overdue && 'font-medium text-warning')}>
          {t('onboarding.nextFollowUp', { date: formatDate(r.nextFollowUpOn, locale) })}
        </div>
      ) : null}
    </div>
  );
}

function LogButton({ r, onLog }: { r: OnboardingRow; onLog: (t: Target) => void }) {
  const { t } = useTranslation('platform');
  return (
    <Button variant="outline" size="sm" onClick={() => onLog({ id: r.id, name: r.name })}>
      <NotebookPen /> {t('onboarding.logContact')}
    </Button>
  );
}

function FollowupSheet({ target, onClose }: { target: Target | null; onClose: () => void }) {
  const { t } = useTranslation('platform');
  const { t: tc } = useTranslation('common');
  return (
    <Sheet open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent closeLabel={tc('close')} className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{target?.name ?? t('onboarding.logContact')}</SheetTitle>
          <SheetDescription>{t('onboarding.sheetHint')}</SheetDescription>
        </SheetHeader>
        {target ? <FollowupBody key={target.id} id={target.id} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function FollowupBody({ id }: { id: string }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const followups = useTenantFollowups(id);
  const add = useAddTenantFollowup(id);
  const [type, setType] = useState<(typeof FOLLOWUP_TYPES)[number]>('call');
  const [result, setResult] = useState<string>(NO_RESULT);
  const [note, setNote] = useState('');
  const [next, setNext] = useState('');
  const today = todayBangkok();

  return (
    <div className="grid gap-4 px-4 pb-6 text-sm">
      <Can permission="platform:leads">
        <form
          className="grid gap-2 rounded-lg border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(
              {
                type,
                result: result === NO_RESULT ? undefined : (result as (typeof FOLLOWUP_RESULTS)[number]),
                note: note.trim() || undefined,
                nextFollowUpOn: next || undefined,
              },
              {
                onSuccess: () => {
                  setResult(NO_RESULT);
                  setNote('');
                  setNext('');
                  toast.success(t('onboarding.savedToast'));
                },
              },
            );
          }}
        >
          <div className="font-medium">{t('onboarding.logContact')}</div>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger aria-label={t('onboarding.contactType')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FOLLOWUP_TYPES.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`onboarding.type.${k}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={result} onValueChange={setResult}>
            <SelectTrigger aria-label={t('onboarding.contactResult')}>
              <SelectValue placeholder={t('onboarding.contactResult')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_RESULT}>{t('onboarding.noResult')}</SelectItem>
              {FOLLOWUP_RESULTS.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`onboarding.result.${k}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={t('onboarding.note')}
            aria-label={t('onboarding.note')}
          />
          <div className="grid gap-1">
            <Label htmlFor="followup-next">{t('onboarding.nextDate')}</Label>
            <Input
              id="followup-next"
              type="date"
              min={today}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {([1, 3, 7] as const).map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNext(addDays(today, n))}
                >
                  {t(`onboarding.quick.${n}`)}
                </Button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={add.isPending} className="justify-self-start">
            {t('onboarding.save')}
          </Button>
        </form>
      </Can>

      <QueryState
        query={followups}
        isEmpty={(rows) => rows.length === 0}
        empty={<p className="text-muted-foreground">{t('onboarding.noHistory')}</p>}
      >
        {(rows) => (
          <ol className="grid gap-2">
            {rows.map((f) => (
              <li key={f.id} className="rounded-md border px-3 py-2">
                <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {t(`onboarding.type.${f.type}`, { defaultValue: f.type })}
                    {f.result ? ` · ${t(`onboarding.result.${f.result}`, { defaultValue: f.result })}` : ''} ·{' '}
                    {f.byName ?? '–'}
                  </span>
                  <span>{formatDateTime(f.at, locale)}</span>
                </div>
                {f.note ? <div className="mt-1 whitespace-pre-wrap">{f.note}</div> : null}
                {f.nextFollowUpOn ? (
                  <div className="mt-1 text-xs">
                    {t('onboarding.nextFollowUp', { date: formatDate(f.nextFollowUpOn, locale) })}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </QueryState>
    </div>
  );
}
