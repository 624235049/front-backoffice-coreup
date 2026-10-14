import { useNavigate } from '@tanstack/react-router';
import { ArrowDownRight, ArrowUpRight, FilePlus2, Plus, Wallet } from 'lucide-react';
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
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Stat } from '@/features/platform/components/common';
import { todayBangkok, useIntlLocale } from '@/features/platform/format';
import { type Dashboard, useDashboard } from '../api';
import { MonthField } from '../components/date-pickers';
import {
  formatAmount,
  formatInt,
  formatMonthKey,
  formatMonthShort,
  monthKey,
  percentChange,
} from '../lib/format';
import { type ReportSearch, useUrlFilters } from '../lib/url-search';

/** "▲ 12.5% vs last month"; `goodWhenUp=false` for expenses where an increase is the bad direction. */
function Delta({
  current,
  previous,
  goodWhenUp = true,
}: {
  current: number;
  previous: number;
  goodWhenUp?: boolean;
}) {
  const { t } = useTranslation('accounting');
  const pct = percentChange(current, previous);
  if (pct === null) return <span>{t('overview.noBaseline')}</span>;
  const up = pct >= 0;
  const good = pct === 0 ? true : up === goodWhenUp;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={
        good
          ? 'inline-flex items-center gap-1 text-success'
          : 'inline-flex items-center gap-1 text-destructive'
      }
    >
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(pct)}% {t('overview.vsLast')}
    </span>
  );
}

function Kpis({ d }: { d: Dashboard }) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const m = (v: number) => formatAmount(v, locale);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        label={t('overview.revenue')}
        value={m(d.current.revenueMinor)}
        hint={<Delta current={d.current.revenueMinor} previous={d.previous.revenueMinor} />}
      />
      <Stat
        label={t('overview.expenses')}
        value={m(d.current.expenseMinor)}
        hint={
          <Delta current={d.current.expenseMinor} previous={d.previous.expenseMinor} goodWhenUp={false} />
        }
      />
      <Stat
        label={t('overview.profit')}
        value={m(d.current.profitMinor)}
        tone={d.current.profitMinor < 0 ? 'destructive' : 'default'}
        hint={<Delta current={d.current.profitMinor} previous={d.previous.profitMinor} />}
      />
      <Stat
        label={t('overview.receivables')}
        value={m(d.receivables.totalMinor)}
        tone={d.receivables.overdueMinor > 0 ? 'warning' : 'default'}
        hint={
          d.receivables.overdueMinor > 0
            ? t('overview.overdueHint', {
                amount: m(d.receivables.overdueMinor),
                count: d.receivables.overdueCount,
              })
            : t('overview.receivablesHint', { count: d.receivables.count })
        }
      />
    </div>
  );
}

function CashCard({ d }: { d: Dashboard }) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const rows = d.cashReceived.byMethod
    .filter((r) => r.amountMinor !== 0)
    .sort((a, b) => b.amountMinor - a.amountMinor);
  const max = Math.max(1, ...rows.map((r) => r.amountMinor));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-baseline justify-between gap-3 text-base">
          <span>{t('overview.cashReceived')}</span>
          <span className="text-lg tabular-nums">{formatAmount(d.cashReceived.totalMinor, locale)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t('overview.noCash')}</p> : null}
        {rows.map((r) => (
          <div key={r.method} className="grid gap-1">
            <div className="flex justify-between text-sm">
              <span>{r.method === 'shop_package' ? t('source.shop_package') : t(`method.${r.method}`)}</span>
              <span className="tabular-nums">{formatAmount(r.amountMinor, locale)}</span>
            </div>
            <div className="h-2 rounded-full bg-navy-50" aria-hidden>
              <div
                className="h-2 rounded-full bg-mint-500"
                style={{ width: `${Math.max(2, (r.amountMinor / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MonthlyChart({ d }: { d: Dashboard }) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const data = d.monthly.map((m) => ({
    key: m.month,
    label: formatMonthShort(m.month, locale),
    revenue: m.revenueMinor / 100,
    expense: m.expenseMinor / 100,
    profit: m.profitMinor / 100,
  }));
  const money = (v: unknown) => formatAmount(Math.round(Number(v) * 100), locale);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('overview.chartTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full sm:h-80" role="img" aria-label={t('overview.chartTitle')}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={12} tickLine={false} />
              <YAxis
                fontSize={12}
                width={56}
                tickLine={false}
                tickFormatter={(v: number) =>
                  Math.abs(v) >= 1000 ? `${formatInt(Math.round(v / 1000), locale)}k` : formatInt(v, locale)
                }
              />
              <Tooltip
                formatter={(v) => money(v)}
                labelFormatter={(_, p) => formatMonthKey(String(p?.[0]?.payload?.key ?? ''), locale)}
              />
              <Legend />
              <Bar
                dataKey="revenue"
                name={t('overview.revenue')}
                fill="#0B2D4F"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                isAnimationActive={false}
              />
              <Bar
                dataKey="expense"
                name={t('overview.expenses')}
                fill="#E0A93B"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                isAnimationActive={false}
              />
              <Line
                dataKey="profit"
                name={t('overview.profit')}
                stroke="#38B2AA"
                strokeWidth={3}
                dot={{ r: 3 }}
                type="linear"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewPage() {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const navigate = useNavigate();
  const [search, patch] = useUrlFilters<ReportSearch>();
  const month = search.month ?? monthKey(new Date(`${todayBangkok()}T12:00:00+07:00`));
  const dashboard = useDashboard(month);
  const go = (to: string) => void navigate({ to: to as never });

  return (
    <>
      <PageHeader
        title={t('overview.title')}
        description={t('overview.description', { month: formatMonthKey(month, locale) })}
        actions={
          <>
            <MonthField
              value={month}
              onChange={(v) => patch({ month: v })}
              label={t('overview.month')}
              className="sm:w-44"
            />
            <Button variant="outline" onClick={() => go('/accounting/expenses/new')}>
              <Wallet /> {t('expense.add')}
            </Button>
            <Button variant="outline" onClick={() => go('/accounting/quotations/new')}>
              <FilePlus2 /> {t('list.quotation.add')}
            </Button>
            <Button onClick={() => go('/accounting/invoices/new')}>
              <Plus /> {t('list.invoice.add')}
            </Button>
          </>
        }
      />
      <QueryState query={dashboard}>
        {(d) => (
          <div className="grid gap-5">
            <Kpis d={d} />
            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <MonthlyChart d={d} />
              <CashCard d={d} />
            </div>
          </div>
        )}
      </QueryState>
    </>
  );
}
