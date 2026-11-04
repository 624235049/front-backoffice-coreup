import { CircleAlert, CircleCheck, Megaphone, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMembership } from '@/lib/membership';
import { useInvalidate } from '@/lib/query';
import {
  type AdsOverview,
  type AdsStatus,
  useAdsGoals,
  useAdsOverview,
  useAdsRecommendations,
  useAdsStatus,
  useAdsSync,
} from '../ads-api';
import { money, num, rangeOf, times } from '../ads-format';
import { GoalsCard } from '../components/ads-goals';
import { ReportSection, SuggestionsCard } from '../components/ads-suggestions';
import { CampaignTable, CreativeTable, PlacementTable, ShopTypeTable } from '../components/ads-tables';
import { Stat } from '../components/common';
import { formatDateTime, todayBangkok, useIntlLocale } from '../format';

const STATE_ICON = { ok: CircleCheck, syncing: RefreshCw } as const;

/** Connection to Meta: what the last sync said, and the "sync now" button. */
function StatusBar({
  status,
  locale,
  onSyncRequested,
}: {
  status: AdsStatus;
  locale: string;
  onSyncRequested: () => void;
}) {
  const { t } = useTranslation('ads');
  const sync = useAdsSync();
  const Icon = STATE_ICON[status.state as keyof typeof STATE_ICON] ?? CircleAlert;
  const bad = status.state !== 'ok' && status.state !== 'syncing';
  const hint =
    status.state === 'no_token'
      ? t('status.noTokenHint')
      : status.state === 'token_error'
        ? t('status.tokenErrorHint')
        : null;
  return (
    <Card className={bad && status.state !== 'never' ? 'border-warning/50' : undefined}>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className={`mt-0.5 size-5 shrink-0 ${bad ? 'text-warning' : 'text-success'}`} aria-hidden />
          <div className="min-w-0">
            <div className="font-medium" data-testid="ads-status">
              {t(`status.${status.state}`)}
            </div>
            <div className="text-xs text-muted-foreground">
              {status.lastOkAt
                ? t('status.lastOk', { at: formatDateTime(status.lastOkAt, locale) })
                : t('status.neverOk')}
              {status.lastRunAt && status.lastRunAt !== status.lastOkAt
                ? ` · ${t('status.lastRun', { at: formatDateTime(status.lastRunAt, locale) })}`
                : ''}
              {status.usagePct !== null && status.usagePct > 0
                ? ` · ${t('status.usage', { pct: status.usagePct })}`
                : ''}
            </div>
            {hint ? <p className="mt-1 text-sm">{hint}</p> : null}
            {status.error && status.state !== 'no_token' ? (
              <p className="mt-1 break-words text-xs text-muted-foreground">{status.error}</p>
            ) : null}
          </div>
        </div>
        <Button
          variant="outline"
          disabled={sync.isPending || status.state === 'syncing'}
          onClick={() =>
            sync.mutate(undefined, {
              onSuccess: () => {
                toast.success(t('status.syncQueued'));
                onSyncRequested();
              },
            })
          }
        >
          <RefreshCw className={status.state === 'syncing' ? 'animate-spin' : undefined} />
          {t('status.syncNow')}
        </Button>
      </CardContent>
    </Card>
  );
}

function TopCards({ o, locale }: { o: AdsOverview; locale: string }) {
  const { t } = useTranslation('ads');
  const tot = o.totals;
  const m = tot.metrics;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="ads-cards">
      <Stat label={t('cards.spend')} value={money(tot.spendMinor, locale)} />
      <Stat
        label={t('cards.chats')}
        value={num(tot.funnel.chats, locale)}
        hint={
          m.costPerChatMinor !== null
            ? t('cards.chatsHint', { cost: money(m.costPerChatMinor, locale) })
            : undefined
        }
      />
      <Stat
        label={t('cards.trials')}
        value={num(tot.funnel.trials, locale)}
        hint={
          m.costPerTrialMinor !== null
            ? t('cards.trialsHint', { cost: money(m.costPerTrialMinor, locale) })
            : undefined
        }
      />
      <Stat label={t('cards.paidShops')} value={num(tot.funnel.paidShops, locale)} />
      <Stat
        label={t('cards.revenue')}
        value={money(tot.revenue.firstMinor, locale)}
        hint={t('cards.revenueHint', { mrr: money(tot.revenue.mrrMinor, locale) })}
      />
      <Stat
        label={t('cards.roas')}
        value={times(m.roasFirst)}
        hint={t('cards.roasHint', { value: times(m.roas3m) })}
      />
      <Stat
        label={t('cards.cac')}
        value={money(m.cacMinor, locale)}
        hint={m.paybackMonths !== null ? t('cards.paybackHint', { months: m.paybackMonths }) : undefined}
      />
    </div>
  );
}

/** Spend (bars) against the revenue the ads brought in (line), by day or by week. */
function TrendChart({ o, locale }: { o: AdsOverview; locale: string }) {
  const { t } = useTranslation('ads');
  const [grain, setGrain] = useState<'day' | 'week'>('day');
  const points = grain === 'day' ? o.days : o.weeks;
  const data = useMemo(
    () =>
      points.map((p) => ({ day: p.day.slice(5), spend: p.spendMinor / 100, revenue: p.revenueMinor / 100 })),
    [points],
  );
  const empty = o.days.every((d) => d.spendMinor === 0 && d.revenueMinor === 0);
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">{t('chart.title')}</CardTitle>
        <fieldset className="m-0 flex min-w-0 gap-1 border-0 p-0" aria-label={t('chart.title')}>
          {(['day', 'week'] as const).map((g) => (
            <Button
              key={g}
              size="sm"
              variant={grain === g ? 'default' : 'outline'}
              aria-pressed={grain === g}
              onClick={() => setGrain(g)}
            >
              {t(`chart.${g}`)}
            </Button>
          ))}
        </fieldset>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('chart.empty')}</p>
        ) : (
          <div className="h-64 w-full" data-testid="ads-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} width={48} fontSize={12} />
                <Tooltip formatter={(v) => money(Math.round(Number(v) * 100), locale)} />
                <Legend />
                <Bar
                  dataKey="spend"
                  name={t('chart.spend')}
                  fill="var(--color-primary, #2563eb)"
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  dataKey="revenue"
                  name={t('chart.revenue')}
                  stroke="var(--color-success, #16a34a)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** "โฆษณา (Ads)": platform owner only. Spend → chats → trials → paid shops → revenue, goals, suggestions (suggestion only). */
export function AdsPage() {
  const { t } = useTranslation('ads');
  const locale = useIntlLocale();
  const isOwner = useMembership().roles.includes('platform_owner');
  const today = todayBangkok();
  const [preset, setPreset] = useState<'month' | '7' | '30'>('month');
  const range = useMemo(() => rangeOf(preset, today), [preset, today]);

  // after "sync now" the status is read every 3 s for 2 minutes, and when a run finishes the numbers are read again
  const [fastStatus, setFastStatus] = useState(false);
  const status = useAdsStatus(isOwner, fastStatus);
  const invalidate = useInvalidate();
  const lastOkAt = status.data?.lastOkAt ?? null;
  // undefined = the first answer has not arrived: opening the page is not "a run finished"
  const seenOkAt = useRef<string | null | undefined>(undefined);
  const statusLoaded = status.data !== undefined;
  useEffect(() => {
    if (!statusLoaded) return;
    const first = seenOkAt.current === undefined;
    const changed = !first && lastOkAt !== seenOkAt.current;
    seenOkAt.current = lastOkAt;
    if (!changed) return;
    for (const part of ['overview', 'recommendations', 'goals']) void invalidate('platform', 'ads', part);
    setFastStatus(false);
  }, [statusLoaded, lastOkAt, invalidate]);
  useEffect(() => {
    if (!fastStatus) return;
    const id = setTimeout(() => setFastStatus(false), 2 * 60_000);
    return () => clearTimeout(id);
  }, [fastStatus]);
  const overview = useAdsOverview(range, isOwner);
  const goals = useAdsGoals(today.slice(0, 7), isOwner);
  const recs = useAdsRecommendations(isOwner);

  if (!isOwner) {
    return <EmptyState icon={Megaphone} title={t('ownerOnly')} description={t('ownerOnlyHint')} />;
  }
  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <fieldset className="m-0 flex min-w-0 gap-1 border-0 p-0" aria-label={t('range.thisMonth')}>
            {(['month', '7', '30'] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={preset === p ? 'default' : 'outline'}
                aria-pressed={preset === p}
                onClick={() => setPreset(p)}
              >
                {t(p === 'month' ? 'range.thisMonth' : p === '7' ? 'range.last7' : 'range.last30')}
              </Button>
            ))}
          </fieldset>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <QueryState query={status} skeleton={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
          {(data) => <StatusBar status={data} locale={locale} onSyncRequested={() => setFastStatus(true)} />}
        </QueryState>

        <QueryState query={overview}>
          {(o) => (
            <>
              <TopCards o={o} locale={locale} />
              <TrendChart o={o} locale={locale} />
              <Card>
                <CardContent className="p-4">
                  <Tabs defaultValue="campaigns">
                    <div className="overflow-x-auto">
                      <TabsList>
                        <TabsTrigger value="campaigns">{t('table.campaigns')}</TabsTrigger>
                        <TabsTrigger value="creatives">{t('table.creatives')}</TabsTrigger>
                        <TabsTrigger value="shopTypes">{t('table.shopTypes')}</TabsTrigger>
                        <TabsTrigger value="placements">{t('table.placements')}</TabsTrigger>
                      </TabsList>
                    </div>
                    <TabsContent value="campaigns">
                      <CampaignTable rows={o.campaigns} locale={locale} />
                    </TabsContent>
                    <TabsContent value="creatives">
                      <CreativeTable rows={o.creatives} locale={locale} />
                    </TabsContent>
                    <TabsContent value="shopTypes">
                      <ShopTypeTable rows={o.shopTypes} locale={locale} />
                    </TabsContent>
                    <TabsContent value="placements">
                      <PlacementTable rows={o.placements} locale={locale} />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          )}
        </QueryState>

        <QueryState query={goals}>{(data) => <GoalsCard goals={data} locale={locale} />}</QueryState>
        <QueryState query={recs}>{(data) => <SuggestionsCard data={data} locale={locale} />}</QueryState>
        <ReportSection locale={locale} />
      </div>
    </>
  );
}
