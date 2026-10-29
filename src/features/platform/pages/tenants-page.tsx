import { Link, useNavigate } from '@tanstack/react-router';
import { Plus, Store } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Can } from '@/lib/permissions';
import { type TenantRow, type TenantsQuery, useTenants } from '../api';
import { TenantStatusBadge, UsageHealthBadge } from '../components/common';
import { LockLine } from '../components/lock-card';
import { OnboardDialog } from '../components/onboard-dialog';
import { OwnerPhone } from '../components/owner-phone';
import { formatDate, todayBangkok, useIntlLocale } from '../format';

const ALL = '__all__';

export function TenantsPage() {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [health, setHealth] = useState<string>(ALL);
  const [view, setView] = useState<'all' | 'selfServe'>('all');
  const [onboard, setOnboard] = useState(false);
  const query: TenantsQuery = {
    q: q.trim() || undefined,
    status: status === ALL ? undefined : (status as TenantsQuery['status']),
    health: health === ALL ? undefined : (health as TenantsQuery['health']),
    selfServe: view === 'selfServe' ? 'true' : undefined,
  };
  const tenants = useTenants(query);

  return (
    <>
      <PageHeader
        title={t('tenants.title')}
        description={t('tenants.description')}
        actions={
          <Can permission="platform:write">
            <Button onClick={() => setOnboard(true)}>
              <Plus /> {t('tenants.onboard')}
            </Button>
          </Can>
        }
      />
      <Tabs value={view} onValueChange={(v) => setView(v === 'selfServe' ? 'selfServe' : 'all')}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">{t('tenants.views.all')}</TabsTrigger>
          <TabsTrigger value="selfServe">{t('tenants.views.selfServe')}</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('tenants.search')}
          aria-label={t('tenants.search')}
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label={t('tenants.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('tenants.allStatuses')}</SelectItem>
            {(['trial', 'active', 'paused', 'closed'] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {t(`tenantStatus.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={health} onValueChange={setHealth}>
          <SelectTrigger className="w-40" aria-label={t('tenants.usage')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('tenants.allUsage')}</SelectItem>
            {(['good', 'declining', 'at_risk'] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {t(`usageHealth.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <QueryState
        query={tenants}
        isEmpty={(rows) => rows.length === 0}
        empty={
          <EmptyState
            icon={Store}
            title={t(view === 'selfServe' ? 'tenants.selfServe.empty' : 'tenants.empty')}
            description={t(view === 'selfServe' ? 'tenants.selfServe.emptyHint' : 'tenants.emptyHint')}
            action={
              view === 'selfServe' ? undefined : (
                <Can permission="platform:write">
                  <Button onClick={() => setOnboard(true)}>
                    <Plus /> {t('tenants.onboard')}
                  </Button>
                </Can>
              )
            }
          />
        }
      >
        {(rows) =>
          view === 'selfServe' ? (
            <SelfServeTrials rows={rows} />
          ) : (
            <>
              <ul className="grid gap-2 lg:hidden">
                {rows.map((r) => (
                  <li key={r.id}>
                    <Link
                      to="/platform/tenants/$id"
                      params={{ id: r.id }}
                      className="block rounded-lg border bg-card p-4 active:bg-accent"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 font-semibold">{r.name}</div>
                        <TenantStatusBadge status={r.status} />
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {t(`industry.${r.industryKey}`, { defaultValue: r.industryKey })} ·{' '}
                        {t('tenants.branches', { count: r.branches })} · {r.planName ?? '–'}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <UsageHealthBadge health={r.usageHealth} />
                        <span>
                          {t('tenants.col.users')}: {r.activeUsers7d}
                        </span>
                        <span>
                          {t('tenants.col.appointments')}: {r.appointmentsThisWeek}
                        </span>
                      </div>
                    </Link>
                    {r.status === 'trial' ? (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 px-1 text-sm">
                        <OwnerPhone phone={r.ownerPhone} />
                        <span className="text-muted-foreground">
                          {t('ownerPhone.trialEnds')}: {formatDate(r.trialEndsOn, locale)}
                        </span>
                      </div>
                    ) : null}
                    <div className="px-1">
                      <LockLine r={r} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto rounded-lg border lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('tenants.col.shop')}</TableHead>
                      <TableHead>{t('tenants.col.plan')}</TableHead>
                      <TableHead className="text-right">{t('tenants.col.users')}</TableHead>
                      <TableHead className="text-right">{t('tenants.col.appointments')}</TableHead>
                      <TableHead className="text-right">{t('tenants.col.health')}</TableHead>
                      <TableHead className="text-right">{t('tenants.col.noShow')}</TableHead>
                      <TableHead>{t('tenants.col.usage')}</TableHead>
                      <TableHead>{t('tenants.col.renewal')}</TableHead>
                      <TableHead>{t('ownerPhone.label')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => void navigate({ to: '/platform/tenants/$id', params: { id: r.id } })}
                      >
                        <TableCell>
                          <Link
                            to="/platform/tenants/$id"
                            params={{ id: r.id }}
                            className="font-medium hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.name}
                          </Link>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {t(`industry.${r.industryKey}`, { defaultValue: r.industryKey })} ·{' '}
                            {t('tenants.branches', { count: r.branches })}{' '}
                            <TenantStatusBadge status={r.status} />
                          </div>
                        </TableCell>
                        <TableCell>{r.planName ?? '–'}</TableCell>
                        <TableCell className="text-right">{r.activeUsers7d}</TableCell>
                        <TableCell className="text-right">{r.appointmentsThisWeek}</TableCell>
                        <TableCell className="text-right">
                          {r.healthScore === null ? '–' : r.healthScore.toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.noShowRateMonth === null ? '–' : `${r.noShowRateMonth}%`}
                        </TableCell>
                        <TableCell>
                          <UsageHealthBadge health={r.usageHealth} />
                        </TableCell>
                        <TableCell>{formatDate(r.renewalOn, locale)}</TableCell>
                        <TableCell>
                          <OwnerPhone phone={r.ownerPhone} />
                          {r.status === 'trial' && r.trialEndsOn ? (
                            <div className="text-xs text-muted-foreground">
                              {t('ownerPhone.trialEnds')}: {formatDate(r.trialEndsOn, locale)}
                            </div>
                          ) : null}
                          <LockLine r={r} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )
        }
      </QueryState>
      <OnboardDialog
        open={onboard}
        onOpenChange={setOnboard}
        onCreated={(id) => void navigate({ to: '/platform/tenants/$id', params: { id } })}
      />
    </>
  );
}

function TrialEndBadge({ endsOn, today }: { endsOn: string | null; today: string }) {
  const { t } = useTranslation('platform');
  if (!endsOn) return <span className="text-xs text-muted-foreground">{t('tenants.selfServe.noTrial')}</span>;
  // both are Bangkok calendar days parsed as UTC midnight, so the difference is a whole number of days
  const days = Math.round((Date.parse(endsOn) - Date.parse(today)) / 86_400_000);
  if (days < 0)
    return <Badge variant="destructive">{t('tenants.selfServe.expired', { count: -days })}</Badge>;
  if (days === 0) return <Badge variant="warning">{t('tenants.selfServe.endsToday')}</Badge>;
  return (
    <Badge variant={days <= 7 ? 'warning' : 'secondary'}>
      {t('tenants.selfServe.daysLeft', { count: days })}
    </Badge>
  );
}

/** Self sign-up shops on their free trial — sales follows up from here, soonest trial end first. */
function SelfServeTrials({ rows }: { rows: TenantRow[] }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const navigate = useNavigate();
  const today = todayBangkok();
  // shops no longer on trial (already on a paid plan) go last
  const sorted = rows.toSorted((a, b) => (a.trialEndsOn ?? '9999').localeCompare(b.trialEndsOn ?? '9999'));
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('tenants.col.shop')}</TableHead>
            <TableHead>{t('tenants.selfServe.owner')}</TableHead>
            <TableHead>{t('tenants.selfServe.signedUp')}</TableHead>
            <TableHead>{t('tenants.selfServe.trialEnds')}</TableHead>
            <TableHead className="text-right">{t('tenants.col.appointments')}</TableHead>
            <TableHead>{t('tenants.col.plan')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => (
            <TableRow
              key={r.id}
              className="cursor-pointer"
              onClick={() => void navigate({ to: '/platform/tenants/$id', params: { id: r.id } })}
            >
              <TableCell>
                <Link
                  to="/platform/tenants/$id"
                  params={{ id: r.id }}
                  className="font-medium hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {r.name}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {t(`industry.${r.industryKey}`, { defaultValue: r.industryKey })}
                </div>
              </TableCell>
              <TableCell>
                <div>{r.owner?.name ?? '–'}</div>
                {r.owner?.email ? (
                  <a
                    href={`mailto:${r.owner.email}`}
                    className="text-xs text-muted-foreground hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.owner.email}
                  </a>
                ) : r.owner ? (
                  <div className="text-xs text-muted-foreground">{t('tenants.selfServe.noEmail')}</div>
                ) : null}
                <OwnerPhone phone={r.ownerPhone} />
              </TableCell>
              <TableCell className="whitespace-nowrap">{formatDate(r.createdAt, locale)}</TableCell>
              <TableCell>
                <div className="whitespace-nowrap">{formatDate(r.trialEndsOn, locale)}</div>
                <TrialEndBadge endsOn={r.trialEndsOn} today={today} />
              </TableCell>
              <TableCell className="text-right">{r.appointmentsThisWeek}</TableCell>
              <TableCell>{r.planName ?? '–'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
