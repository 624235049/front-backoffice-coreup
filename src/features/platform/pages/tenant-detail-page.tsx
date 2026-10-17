import { Link, useParams } from '@tanstack/react-router';
import { Eye, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api';
import { useMe } from '@/lib/me';
import { useMembership } from '@/lib/membership';
import { Can, useCan } from '@/lib/permissions';
import {
  type TenantDetail,
  useAccessLog,
  useAddAssignment,
  usePatchTenant,
  usePlans,
  useRemoveAssignment,
  useSetModules,
  useTeam,
  useTenant,
  useTenantReport,
  useTenantUsage,
  useUsers,
} from '../api';
import { Field, Stat, TenantStatusBadge, UsageHealthBadge } from '../components/common';
import { DemoDataCard } from '../components/demo-data-card';
import { ImpersonateDialog } from '../components/impersonate-dialog';
import { UsersPanel } from '../components/users-panel';
import { formatDate, formatDateTime, formatMoney, useIntlLocale, usePlanLabel } from '../format';
import { SHOP_MODULES } from '../plans';

/** Modules a consultant can switch on per shop (`core` is always on). */
const MODULE_KEYS = SHOP_MODULES.filter((k) => k !== 'core');

export function TenantDetailPage() {
  const { id } = useParams({ from: '/_app/platform/tenants/$id' });
  const { t } = useTranslation('platform');
  const tenant = useTenant(id);
  const [impersonate, setImpersonate] = useState(false);
  const canImpersonate = useCan('platform:impersonate');
  const canSeeUsers = useCan('platform:manage');

  return (
    <QueryState query={tenant}>
      {(data) => {
        const d = data.data;
        return (
          <>
            <PageHeader
              title={
                <span className="flex flex-wrap items-center gap-3">
                  {d.name} <TenantStatusBadge status={d.status} /> <UsageHealthBadge health={d.usageHealth} />
                </span>
              }
              description={`${t(`industry.${d.industryKey}`, { defaultValue: d.industryKey })} · ${d.slug}`}
              actions={
                canImpersonate ? (
                  <Button onClick={() => setImpersonate(true)}>
                    <Eye /> {t('impersonate.button')}
                  </Button>
                ) : null
              }
            />
            <Tabs defaultValue="overview">
              <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
                {(
                  [
                    'overview',
                    'engagements',
                    'usage',
                    'reports',
                    'finance',
                    'access',
                    'team',
                    ...(canSeeUsers ? (['users'] as const) : []),
                  ] as const
                ).map((k) => (
                  <TabsTrigger key={k} value={k}>
                    {t(`tenantTabs.${k}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="overview">
                <OverviewTab d={d} />
              </TabsContent>
              <TabsContent value="engagements">
                <EngagementsTab d={d} />
              </TabsContent>
              <TabsContent value="usage">
                <UsageTab id={d.id} />
              </TabsContent>
              <TabsContent value="reports">
                <ReportsTab id={d.id} />
              </TabsContent>
              <TabsContent value="finance">
                <FinanceTab d={d} />
              </TabsContent>
              <TabsContent value="access">
                <AccessTab id={d.id} />
              </TabsContent>
              <TabsContent value="team">
                <TeamTab d={d} />
              </TabsContent>
              {canSeeUsers ? (
                <TabsContent value="users">
                  <ShopUsersTab tenantId={d.id} />
                </TabsContent>
              ) : null}
            </Tabs>
            <ImpersonateDialog
              tenantId={d.id}
              tenantName={d.name}
              open={impersonate}
              onOpenChange={setImpersonate}
            />
          </>
        );
      }}
    </QueryState>
  );
}

function OverviewTab({ d }: { d: TenantDetail }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const canWrite = useCan('platform:write');
  const patch = usePatchTenant(d.id);
  const plans = usePlans();
  const planLabel = usePlanLabel();
  const setModules = useSetModules(d.id);
  const [notes, setNotes] = useState(d.notes);
  const [pendingStatus, setPendingStatus] = useState<TenantDetail['status'] | null>(null);
  const enabled = new Set(d.modules.map((m) => m.key));

  const toggleModule = (key: string, on: boolean) => {
    const next = new Set(enabled);
    if (on) next.add(key);
    else next.delete(key);
    const sources = new Map(d.modules.map((m) => [m.key, m]));
    setModules.mutate({
      modules: [...next]
        .filter((k) => k !== 'core')
        .map((k) => ({
          key: k as (typeof MODULE_KEYS)[number],
          source: sources.get(k)?.source ?? 'consultant',
          enabledUntil: sources.get(k)?.enabledUntil ?? null,
        })),
    });
  };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t('detail.customers')}
          value={d.usage.customersTotal.toLocaleString(locale)}
          hint={t('detail.lineLinked', { count: d.usage.customersLineLinked })}
        />
        <Stat
          label={t('detail.members')}
          value={d.usage.members}
          hint={t('detail.activeUsers', { count: d.activeUsers7d })}
        />
        <Stat
          label={t('detail.appointmentsMonth')}
          value={d.usage.appointmentsThisMonth}
          hint={t('detail.appointmentsWeek', { count: d.appointmentsThisWeek })}
        />
        <Stat
          label={t('detail.messagesMonth')}
          value={d.usage.messagesThisMonth}
          hint={d.noShowRateMonth === null ? undefined : t('detail.noShow', { rate: d.noShowRateMonth })}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('detail.account')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label={t('detail.status')}>
            {canWrite ? (
              <Select value={d.status} onValueChange={(v) => setPendingStatus(v as TenantDetail['status'])}>
                <SelectTrigger className="w-40" aria-label={t('detail.status')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['trial', 'active', 'paused', 'closed'] as const).map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`tenantStatus.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <TenantStatusBadge status={d.status} />
            )}
          </Field>
          <Field label={t('detail.plan')}>
            {canWrite ? (
              <Select
                value={d.planCode ?? undefined}
                onValueChange={(code) =>
                  patch.mutate({ planCode: code }, { onSuccess: () => toast.success(t('detail.planSaved')) })
                }
              >
                <SelectTrigger className="w-64" aria-label={t('detail.plan')}>
                  <SelectValue placeholder="–" />
                </SelectTrigger>
                <SelectContent>
                  {(plans.data ?? [])
                    .filter((p) => p.active || p.code === d.planCode)
                    .map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {planLabel(p)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              (d.planName ?? '–')
            )}
          </Field>
          <Field label={t('detail.created')}>{formatDate(d.createdAt, locale)}</Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('detail.modules')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {canWrite ? null : (
            <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
              {t('detail.readOnlyHint')}
            </p>
          )}
          {MODULE_KEYS.map((k) => (
            <label key={k} htmlFor={`module-${k}`} className="flex min-h-11 items-center gap-2 text-sm">
              <Checkbox
                id={`module-${k}`}
                checked={enabled.has(k)}
                disabled={!canWrite || setModules.isPending}
                onCheckedChange={(on) => toggleModule(k, on === true)}
                aria-label={t(`module.${k}`)}
              />
              {t(`module.${k}`)}
              {enabled.has(k) ? (
                <Badge variant="outline">
                  {t(`moduleSource.${d.modules.find((m) => m.key === k)?.source ?? 'plan'}`)}
                </Badge>
              ) : null}
            </label>
          ))}
        </CardContent>
      </Card>
      <DemoDataCard d={d} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('detail.notes')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            readOnly={!canWrite}
            aria-label={t('detail.notes')}
          />
          <Can permission="platform:write">
            <Button
              className="justify-self-start"
              variant="outline"
              disabled={patch.isPending}
              blockedReason={notes === d.notes && t('detail.notesUnchanged')}
              onClick={() =>
                patch.mutate({ notes }, { onSuccess: () => toast.success(t('detail.notesSaved')) })
              }
            >
              {t('detail.saveNotes')}
            </Button>
          </Can>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={pendingStatus !== null}
        onOpenChange={(o) => !o && setPendingStatus(null)}
        title={t('detail.statusConfirm', { status: pendingStatus ? t(`tenantStatus.${pendingStatus}`) : '' })}
        description={pendingStatus === 'closed' ? t('detail.statusClosedWarning') : undefined}
        destructive={pendingStatus === 'closed'}
        pending={patch.isPending}
        onConfirm={() => {
          if (pendingStatus)
            patch.mutate(
              { status: pendingStatus },
              {
                onSuccess: () => {
                  setPendingStatus(null);
                  toast.success(t('detail.statusSaved'));
                },
              },
            );
        }}
      />
    </div>
  );
}

function EngagementsTab({ d }: { d: TenantDetail }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  if (d.engagements.length === 0)
    return <p className="text-sm text-muted-foreground">{t('detail.noEngagements')}</p>;
  return (
    <div className="grid gap-3">
      {d.engagements.map((e) => (
        <Card key={e.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <Link
                to="/platform/engagements/$id"
                params={{ id: e.id }}
                className="font-medium hover:underline"
              >
                {t(`engagementType.${e.type}`)}
              </Link>
              <div className="text-xs text-muted-foreground">
                {formatDate(e.startsOn, locale)} – {formatDate(e.endsOn, locale)}
              </div>
            </div>
            <Badge variant={e.status === 'active' ? 'success' : 'secondary'}>
              {t(`engagementStatus.${e.status}`)}
            </Badge>
            <div className="text-sm">
              {t('detail.taskProgress', { done: e.tasksDone, total: e.tasksTotal })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UsageTab({ id }: { id: string }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const usage = useTenantUsage(id);
  return (
    <QueryState
      query={usage}
      isEmpty={(rows) => rows.length === 0}
      empty={<p className="text-sm text-muted-foreground">{t('detail.noUsage')}</p>}
    >
      {(rows) => (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('usage.date')}</TableHead>
                <TableHead className="text-right">{t('usage.activeMembers')}</TableHead>
                <TableHead className="text-right">{t('usage.logins')}</TableHead>
                <TableHead className="text-right">{t('usage.appointmentsCreated')}</TableHead>
                <TableHead className="text-right">{t('usage.appointmentsCompleted')}</TableHead>
                <TableHead className="text-right">{t('usage.messagesSent')}</TableHead>
                <TableHead className="text-right">{t('usage.checklistsDone')}</TableHead>
                <TableHead className="text-right">{t('usage.customers')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...rows].reverse().map((r) => (
                <TableRow key={r.date}>
                  <TableCell>{formatDate(r.date, locale)}</TableCell>
                  <TableCell className="text-right">{r.activeMembers ?? 0}</TableCell>
                  <TableCell className="text-right">{r.logins ?? 0}</TableCell>
                  <TableCell className="text-right">{r.appointmentsCreated ?? 0}</TableCell>
                  <TableCell className="text-right">{r.appointmentsCompleted ?? 0}</TableCell>
                  <TableCell className="text-right">{r.messagesSent ?? 0}</TableCell>
                  <TableCell className="text-right">{r.checklistsDone ?? 0}</TableCell>
                  <TableCell className="text-right">{r.customersTotal ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </QueryState>
  );
}

function ReportsTab({ id }: { id: string }) {
  const { t } = useTranslation('platform');
  const [key, setKey] = useState<'health' | 'kpi'>('health');
  const report = useTenantReport(id, key);
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{t('detail.reportsHint')}</p>
      <div className="flex gap-2">
        {(['health', 'kpi'] as const).map((k) => (
          <Button key={k} variant={key === k ? 'default' : 'outline'} size="sm" onClick={() => setKey(k)}>
            {t(`detail.report.${k}`)}
          </Button>
        ))}
      </div>
      {report.isError && isApiError(report.error) && report.error.status === 403 ? (
        <p className="text-sm text-muted-foreground">{t('detail.reportForbidden')}</p>
      ) : (
        <QueryState
          query={report}
          isEmpty={(r) => Array.isArray(r.data.payload) && r.data.payload.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('detail.noReport')}</p>}
        >
          {(r) => (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t(`detail.report.${key}`)} {r.data.period ? `· ${r.data.period}` : ''}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                  {(r.data.payload as Record<string, unknown>[]).map((row) => (
                    <li
                      key={String(row.dimension ?? row.kpiKey)}
                      className="flex justify-between gap-3 border-b py-1"
                    >
                      <span>{String(row.dimension ?? row.kpiKey)}</span>
                      <span className="font-medium">
                        {row.score !== undefined
                          ? Number(row.score).toFixed(0)
                          : row.value === null
                            ? '–'
                            : String(row.value)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </QueryState>
      )}
    </div>
  );
}

function FinanceTab({ d }: { d: TenantDetail }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Stat label={t('detail.invoiced')} value={formatMoney(d.finance.invoicedMinor, locale)} />
      <Stat label={t('detail.paid')} value={formatMoney(d.finance.paidMinor, locale)} />
      <Stat
        label={t('detail.outstanding')}
        value={formatMoney(d.finance.outstandingMinor, locale)}
        tone={d.finance.outstandingMinor > 0 ? 'warning' : 'default'}
      />
    </div>
  );
}

function AccessTab({ id }: { id: string }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const log = useAccessLog(id);
  return (
    <QueryState
      query={log}
      isEmpty={(rows) => rows.length === 0}
      empty={<p className="text-sm text-muted-foreground">{t('detail.noAccess')}</p>}
    >
      {(rows) => (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('access.when')}</TableHead>
                <TableHead>{t('access.who')}</TableHead>
                <TableHead>{t('access.action')}</TableHead>
                <TableHead>{t('access.reason')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDateTime(r.createdAt, locale)}</TableCell>
                  <TableCell>{r.actorName ?? '–'}</TableCell>
                  <TableCell>
                    {t(`access.actions.${r.action}`, { defaultValue: r.action })}{' '}
                    {r.impersonating ? <Badge variant="warning">{t('access.impersonating')}</Badge> : null}
                  </TableCell>
                  <TableCell>{r.reason ?? '–'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </QueryState>
  );
}

function TeamTab({ d }: { d: TenantDetail }) {
  const { t } = useTranslation('platform');
  const canManage = useCan('platform:manage');
  const team = useTeam(canManage);
  const add = useAddAssignment();
  const remove = useRemoveAssignment();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'consultant' | 'sales'>('consultant');
  return (
    <div className="grid gap-4">
      {d.assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('detail.noAssignments')}</p>
      ) : null}
      <ul className="divide-y rounded-lg border">
        {d.assignments.map((a) => (
          <li
            key={`${a.userId}-${a.role}`}
            className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
          >
            <span>
              {a.userName} <Badge variant="outline">{t(`assignmentRole.${a.role}`)}</Badge>
            </span>
            {canManage ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(
                    { tenantId: d.id, userId: a.userId, role: a.role },
                    { onSuccess: () => toast.success(t('detail.unassigned')) },
                  )
                }
              >
                {t('detail.unassign')}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {canManage ? (
        <div className="flex flex-wrap items-end gap-2">
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-56" aria-label={t('detail.assignUser')}>
              <SelectValue placeholder={t('detail.assignUser')} />
            </SelectTrigger>
            <SelectContent>
              {(team.data ?? [])
                .filter((m) => m.status === 'active')
                .map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={role} onValueChange={(v) => setRole(v as 'consultant' | 'sales')}>
            <SelectTrigger className="w-40" aria-label={t('detail.assignRole')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="consultant">{t('assignmentRole.consultant')}</SelectItem>
              <SelectItem value="sales">{t('assignmentRole.sales')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            disabled={add.isPending}
            blockedReason={!userId && t('detail.assignPick')}
            onClick={() =>
              add.mutate(
                { userId, tenantId: d.id, role },
                {
                  onSuccess: () => {
                    setUserId('');
                    toast.success(t('detail.assigned'));
                  },
                },
              )
            }
          >
            {t('detail.assign')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** The shop's accounts with the same actions as `/platform/users` (owners change, admins read). */
function ShopUsersTab({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation('users');
  const canChange = useMembership().roles.includes('platform_owner');
  const selfId = useMe().data?.user.id;
  const users = useUsers({ tenantId, page: 1, limit: 100 });
  return (
    <QueryState
      query={users}
      isEmpty={(res) => res.data.length === 0}
      empty={<EmptyState icon={Users} title={t('tab.empty')} />}
    >
      {(res) => <UsersPanel rows={res.data} canChange={canChange} selfId={selfId} />}
    </QueryState>
  );
}
