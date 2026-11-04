import { Target } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type AdsGoals, useSaveAdsGoals } from '../ads-api';
import { bahtToMinor, money, num, wholeOrNull } from '../ads-format';

type Item = AdsGoals['items'][number];
type Key = Item['key'];
const KEYS: Key[] = ['chats', 'trials', 'paidShops', 'mrrMinor', 'adBudgetMinor'];
const isMoney = (k: Key) => k === 'mrrMinor' || k === 'adBudgetMinor';
const TONE = {
  reached: 'success',
  on_track: 'success',
  ahead: 'warning',
  behind: 'destructive',
  no_target: 'secondary',
} as const;

function Progress({ pct, expectedPct, label }: { pct: number; expectedPct: number | null; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.min(100, Math.round(pct))}
      aria-valuemin={0}
      aria-valuemax={100}
      className="relative h-2 overflow-hidden rounded-full bg-muted"
    >
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
      {expectedPct !== null ? (
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground/60"
          style={{ left: `${Math.min(100, expectedPct)}%` }}
        />
      ) : null}
    </div>
  );
}

function GoalRow({ item, locale }: { item: Item; locale: string }) {
  const { t } = useTranslation('ads');
  const show = (n: number | null) => (isMoney(item.key) ? money(n, locale) : num(n, locale));
  const hasTarget = item.target !== null && item.target > 0;
  return (
    <div className="grid gap-1.5" data-testid={`goal-${item.key}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">{t(`goals.key.${item.key}`)}</div>
        <Badge variant={TONE[item.status]}>{t(`goals.status.${item.status}`)}</Badge>
      </div>
      {item.target === null ? (
        <div className="text-sm text-muted-foreground">
          {show(item.actual)} · {t('goals.noTarget')}
        </div>
      ) : (
        <>
          <Progress
            pct={hasTarget ? (item.actual / (item.target as number)) * 100 : 100}
            expectedPct={
              hasTarget && item.expected !== null ? (item.expected / (item.target as number)) * 100 : null
            }
            label={t(`goals.key.${item.key}`)}
          />
          <div className="text-sm">
            {t('goals.of', { actual: show(item.actual), target: show(item.target), pct: item.pct ?? '–' })}
          </div>
          <div className="text-xs text-muted-foreground">
            {item.expected !== null ? `${t('goals.pace', { expected: show(item.expected) })} · ` : ''}
            {t('goals.forecast', { forecast: show(item.forecast), pct: item.forecastPct ?? '–' })}
            {item.dailyNeeded !== null
              ? ` · ${t('goals.needed', { n: isMoney(item.key) ? money(Math.round(item.dailyNeeded), locale) : num(item.dailyNeeded, locale, 1) })}`
              : ''}
          </div>
        </>
      )}
    </div>
  );
}

function EditDialog({ goals, onClose }: { goals: AdsGoals; onClose: () => void }) {
  const { t } = useTranslation('ads');
  const save = useSaveAdsGoals();
  const start = (k: Key): string => {
    const v = goals.targets[k];
    return v === null ? '' : String(isMoney(k) ? v / 100 : v);
  };
  const [text, setText] = useState<Record<Key, string>>(
    () => Object.fromEntries(KEYS.map((k) => [k, start(k)])) as Record<Key, string>,
  );
  const parsed = Object.fromEntries(
    KEYS.map((k) => [k, isMoney(k) ? bahtToMinor(text[k]) : wholeOrNull(text[k])]),
  ) as Record<Key, number | null | undefined>;
  const valid = KEYS.every((k) => parsed[k] !== undefined);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t('goals.cancel')} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('goals.editTitle', { month: goals.month })}</DialogTitle>
          <DialogDescription>{t('goals.editHint')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {KEYS.map((k) => (
            <div key={k}>
              <Label htmlFor={`goal-in-${k}`}>{t(`goals.key.${k}`)}</Label>
              <Input
                id={`goal-in-${k}`}
                inputMode="decimal"
                value={text[k]}
                aria-invalid={parsed[k] === undefined}
                onChange={(e) => setText((s) => ({ ...s, [k]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('goals.cancel')}
          </Button>
          <Button
            disabled={!valid || save.isPending}
            onClick={() =>
              save.mutate(
                { month: goals.month, targets: parsed as Record<Key, number | null> },
                {
                  onSuccess: () => {
                    toast.success(t('goals.saved'));
                    onClose();
                  },
                },
              )
            }
          >
            {t('goals.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Monthly targets: progress, today's pace, month-end forecast, and the month's new chats / trials / paid shops per channel. */
export function GoalsCard({ goals, locale }: { goals: AdsGoals; locale: string }) {
  const { t } = useTranslation('ads');
  const [editing, setEditing] = useState(false);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="size-4" aria-hidden />
          {t('goals.title', { month: goals.month })}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          {t('goals.edit')}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          {goals.items.map((i) => (
            <GoalRow key={i.key} item={i} locale={locale} />
          ))}
        </div>
        <div>
          <div className="mb-2 text-sm font-medium">{t('goals.channels')}</div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead className="text-right">{t('goals.channelChats')}</TableHead>
                  <TableHead className="text-right">{t('goals.channelTrials')}</TableHead>
                  <TableHead className="text-right">{t('goals.channelPaid')}</TableHead>
                  <TableHead className="text-right">{t('goals.channelMrr')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.channels.map((c) => (
                  <TableRow key={c.channel}>
                    <TableCell>{t(`channel.${c.channel}`)}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(c.chats, locale)}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(c.trials, locale)}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(c.paidShops, locale)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(c.newMrrMinor, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
      {editing ? <EditDialog goals={goals} onClose={() => setEditing(false)} /> : null}
    </Card>
  );
}
