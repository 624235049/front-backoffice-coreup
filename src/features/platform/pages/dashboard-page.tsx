import { Link } from '@tanstack/react-router';
import { CalendarClock, MessageSquare, Store, TrendingUp, TriangleAlert, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOverview } from '../api';
import { Stat } from '../components/common';
import { formatDate, formatMoney, useIntlLocale } from '../format';

const STAGES = ['new', 'contacted', 'checked', 'proposal', 'won', 'lost', 'nurture'] as const;

export function DashboardPage() {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const overview = useOverview();
  const n = (v: number) => v.toLocaleString(locale);

  return (
    <>
      <PageHeader title={t('dashboard.title')} description={t('dashboard.description')} />
      <QueryState query={overview} skeleton={<DashboardSkeleton />}>
        {({ data: o }) => (
          <div className="grid gap-6">
            {o.scope === 'assigned' ? (
              <p className="rounded-md bg-accent/50 px-3 py-2 text-sm">{t('dashboard.assignedScope')}</p>
            ) : null}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                icon={Store}
                label={t('dashboard.activeShops')}
                value={n(o.tenants.active)}
                hint={t('dashboard.activeShopsHint', { count: o.tenants.byStatus.active })}
              />
              <Stat
                icon={Users}
                label={t('dashboard.activeMembers')}
                value={n(o.members.active7d)}
                hint={t('dashboard.activeMembersHint', { count: o.members.active30d })}
              />
              <Stat
                icon={Users}
                label={t('dashboard.customers')}
                value={n(o.customers.total)}
                hint={t('dashboard.customersHint', { count: o.customers.lineLinked })}
              />
              <Stat
                icon={CalendarClock}
                label={t('dashboard.appointments')}
                value={n(o.appointments.thisWeek)}
                hint={t('dashboard.appointmentsHint', { count: o.appointments.thisMonth })}
              />
              <Stat icon={MessageSquare} label={t('dashboard.messages')} value={n(o.messagesThisMonth)} />
              <Stat label={t('dashboard.branches')} value={n(o.branchesActive)} />
              <Stat
                label={t('dashboard.newShops')}
                value={n(o.tenants.newThisMonth)}
                hint={t('dashboard.closedHint', { count: o.tenants.closedThisMonth })}
              />
              <Stat
                label={t('dashboard.byStatus')}
                value={`${o.tenants.byStatus.trial} · ${o.tenants.byStatus.active} · ${o.tenants.byStatus.paused} · ${o.tenants.byStatus.closed}`}
                hint={t('dashboard.byStatusHint')}
              />
            </div>

            {o.revenue ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Stat
                  icon={TrendingUp}
                  label={t('dashboard.mrr')}
                  value={formatMoney(o.revenue.mrrMinor, locale)}
                />
                <Stat
                  label={t('dashboard.engagementRevenue')}
                  value={formatMoney(o.revenue.engagementThisMonthMinor, locale)}
                />
                <Stat
                  label={t('dashboard.invoicedMonth')}
                  value={formatMoney(o.revenue.invoicedThisMonthMinor, locale)}
                />
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TriangleAlert className="size-4 text-destructive" aria-hidden />
                    {t('dashboard.atRisk')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {o.atRisk.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('dashboard.atRiskEmpty')}</p>
                  ) : (
                    <ul className="divide-y">
                      {o.atRisk.map((r) => (
                        <li key={r.tenantId} className="flex items-center justify-between gap-3 py-2">
                          <Link
                            to="/platform/tenants/$id"
                            params={{ id: r.tenantId }}
                            className="font-medium hover:underline"
                          >
                            {r.name}
                          </Link>
                          <span className="text-right text-xs text-muted-foreground">
                            <Badge variant="destructive">{t(`dashboard.reason.${r.reason}`)}</Badge>
                            <div className="mt-1">
                              {r.daysSinceNewAppointment === null
                                ? t('dashboard.neverBooked')
                                : t('dashboard.daysSince', { count: r.daysSinceNewAppointment })}
                            </div>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('dashboard.endingSoon')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {o.engagementsEndingSoon.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('dashboard.endingSoonEmpty')}</p>
                  ) : (
                    <ul className="divide-y">
                      {o.engagementsEndingSoon.map((e) => (
                        <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <Link
                            to="/platform/engagements/$id"
                            params={{ id: e.id }}
                            className="font-medium hover:underline"
                          >
                            {e.tenantName}
                          </Link>
                          <span className="text-muted-foreground">
                            {t(`engagementType.${e.type}`)} · {formatDate(e.endsOn, locale)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {Object.keys(o.leadsByStage).length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('dashboard.leads')}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {STAGES.map((s) => (
                    <Link
                      key={s}
                      to="/platform/leads"
                      className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
                    >
                      <span className="text-muted-foreground">{t(`leadStage.${s}`)}</span>{' '}
                      <span className="font-semibold">{o.leadsByStage[s] ?? 0}</span>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </QueryState>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: 8 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
