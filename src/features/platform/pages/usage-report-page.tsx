import { Link, useNavigate } from '@tanstack/react-router';
import { Activity, ArrowDown, ArrowUp, Check, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type UsageReport, type UsageReportQuery, type UsageReportRow, useUsageReport } from '../api';
import { TenantStatusBadge } from '../components/common';
import { formatDateTime, formatMoney, todayBangkok, useIntlLocale } from '../format';

const ALL = '__all__';
const DAY = 86_400_000;
/** a shop nobody opened for longer than this gets the "not used" badge */
const IDLE_DAYS = 3;

type Sort = { key: SortKey; desc: boolean } | null;
type SortKey =
  | 'name'
  | 'lastActiveAt'
  | 'activeUsers'
  | 'logins'
  | 'appointmentsCreated'
  | 'appointmentsCompleted'
  | 'noShows'
  | 'billsPaid'
  | 'revenueMinor'
  | 'newCustomers'
  | 'messagesSent';

const isTrial = (r: UsageReportRow) => r.status === 'trial' || r.trialEndsOn !== null;

/** Default order: trial shops first, then the most recently active. */
function byDefault(a: UsageReportRow, b: UsageReportRow): number {
  return (
    Number(isTrial(b)) - Number(isTrial(a)) || (b.lastActiveAt ?? '').localeCompare(a.lastActiveAt ?? '')
  );
}

function bySort(key: SortKey, desc: boolean) {
  return (a: UsageReportRow, b: UsageReportRow) => {
    const x = a[key] ?? (key === 'name' ? '' : -1);
    const y = b[key] ?? (key === 'name' ? '' : -1);
    const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return desc ? -cmp : cmp;
  };
}

export function UsageReportPage() {
  const { t } = useTranslation('platform');
  const [days, setDays] = useState<'7' | '30'>('7');
  const [status, setStatus] = useState<string>(ALL);
  const [hideDemo, setHideDemo] = useState(true);
  const [sort, setSort] = useState<Sort>(null);
  const report = useUsageReport({
    days,
    status: status === ALL ? undefined : (status as UsageReportQuery['status']),
    demo: hideDemo ? 'false' : undefined,
  });

  return (
    <>
      <PageHeader title={t('usageReport.title')} description={t('usageReport.description')} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={days} onValueChange={(v) => setDays(v === '30' ? '30' : '7')}>
          <TabsList>
            <TabsTrigger value="7">{t('usageReport.days', { count: 7 })}</TabsTrigger>
            <TabsTrigger value="30">{t('usageReport.days', { count: 30 })}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label={t('tenants.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('tenants.allStatuses')}</SelectItem>
            {(['trial', 'active'] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {t(`tenantStatus.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label className="flex items-center gap-2 font-normal">
          <Checkbox checked={hideDemo} onCheckedChange={(on) => setHideDemo(on === true)} />
          {t('usageReport.hideDemo')}
        </Label>
      </div>

      <QueryState
        query={report}
        isEmpty={(d) => d.rows.length === 0}
        empty={<EmptyState icon={Activity} title={t('usageReport.empty')} />}
      >
        {(d) => <ReportTable report={d} sort={sort} onSort={setSort} />}
      </QueryState>
    </>
  );
}

function ReportTable({
  report,
  sort,
  onSort,
}: {
  report: UsageReport;
  sort: Sort;
  onSort: (s: Sort) => void;
}) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const navigate = useNavigate();
  const now = Date.now();
  const today = todayBangkok();
  const rows = report.rows.toSorted(sort ? bySort(sort.key, sort.desc) : byDefault);
  const money = (v: number | null) => (v === null ? '–' : formatMoney(v, locale));
  const n = (v: number) => v.toLocaleString(locale);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHead sort={sort} onSort={onSort} k="name" label={t('usageReport.col.shop')} right={false} />
            <SortHead
              sort={sort}
              onSort={onSort}
              k="lastActiveAt"
              label={t('usageReport.col.lastActive')}
              right={false}
            />
            <SortHead sort={sort} onSort={onSort} k="activeUsers" label={t('usageReport.col.activeUsers')} />
            <SortHead sort={sort} onSort={onSort} k="logins" label={t('usageReport.col.logins')} />
            <SortHead
              sort={sort}
              onSort={onSort}
              k="appointmentsCreated"
              label={t('usageReport.col.appointments')}
            />
            <SortHead
              sort={sort}
              onSort={onSort}
              k="appointmentsCompleted"
              label={t('usageReport.col.completed')}
            />
            <SortHead sort={sort} onSort={onSort} k="noShows" label={t('usageReport.col.noShows')} />
            <SortHead sort={sort} onSort={onSort} k="billsPaid" label={t('usageReport.col.bills')} />
            <SortHead sort={sort} onSort={onSort} k="revenueMinor" label={t('usageReport.col.revenue')} />
            <SortHead
              sort={sort}
              onSort={onSort}
              k="newCustomers"
              label={t('usageReport.col.newCustomers')}
            />
            <SortHead sort={sort} onSort={onSort} k="messagesSent" label={t('usageReport.col.messages')} />
            <TableHead>{t('usageReport.col.setup')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const idle = r.lastActiveAt ? Math.floor((now - Date.parse(r.lastActiveAt)) / DAY) : null;
            // both are Bangkok calendar days parsed as UTC midnight, so the difference is a whole number of days
            const trialLeft = r.trialEndsOn
              ? Math.round((Date.parse(r.trialEndsOn) - Date.parse(today)) / DAY)
              : null;
            return (
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
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <TenantStatusBadge status={r.status} />
                    {r.planName ?? '–'}
                    {r.demo ? <Badge variant="outline">{t('usageReport.demo')}</Badge> : null}
                    {r.selfServe ? <Badge variant="outline">{t('usageReport.selfServe')}</Badge> : null}
                    {trialLeft === null ? null : trialLeft < 0 ? (
                      <Badge variant="destructive">
                        {t('usageReport.trialEnded', { count: -trialLeft })}
                      </Badge>
                    ) : (
                      <Badge variant={trialLeft <= 7 ? 'warning' : 'secondary'}>
                        {t('usageReport.trialLeft', { count: trialLeft })}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div>{formatDateTime(r.lastActiveAt, locale)}</div>
                  {idle === null ? (
                    <Badge variant="destructive">{t('usageReport.neverUsed')}</Badge>
                  ) : idle > IDLE_DAYS ? (
                    <Badge variant="warning">{t('usageReport.idle', { count: idle })}</Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-right">{n(r.activeUsers)}</TableCell>
                <TableCell className="text-right">{n(r.logins)}</TableCell>
                <TableCell className="text-right">
                  <div>{n(r.appointmentsCreated)}</div>
                  <div className="whitespace-nowrap text-xs text-muted-foreground">
                    {t('usageReport.bySource', { staff: r.staffCreated, online: r.onlineCreated })}
                  </div>
                </TableCell>
                <TableCell className="text-right">{n(r.appointmentsCompleted)}</TableCell>
                <TableCell className="text-right">{n(r.noShows)}</TableCell>
                <TableCell className="text-right">{n(r.billsPaid)}</TableCell>
                <TableCell className="whitespace-nowrap text-right">{money(r.revenueMinor)}</TableCell>
                <TableCell className="text-right">{n(r.newCustomers)}</TableCell>
                <TableCell className="text-right">{n(r.messagesSent)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <SetupItem
                      ok={r.setup.services > 0}
                      label={`${t('usageReport.setup.services')} ${r.setup.services}`}
                    />
                    <SetupItem
                      ok={r.setup.staff > 0}
                      label={`${t('usageReport.setup.staff')} ${r.setup.staff}`}
                    />
                    <SetupItem ok={r.setup.lineConnected} label={t('usageReport.setup.line')} />
                    <SetupItem ok={r.setup.onlineBookingReady} label={t('usageReport.setup.onlineBooking')} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow className="bg-muted/50 font-medium hover:bg-muted/50">
            <TableCell>
              {t('usageReport.totals', { count: report.totals.shops })}
              <div className="text-xs font-normal text-muted-foreground">
                {t('usageReport.activeShops', { count: report.totals.activeShops })}
              </div>
            </TableCell>
            <TableCell />
            <TableCell className="text-right">{n(report.totals.activeUsers)}</TableCell>
            <TableCell className="text-right">{n(report.totals.logins)}</TableCell>
            <TableCell className="text-right">
              <div>{n(report.totals.appointmentsCreated)}</div>
              <div className="whitespace-nowrap text-xs font-normal text-muted-foreground">
                {t('usageReport.bySource', {
                  staff: report.totals.staffCreated,
                  online: report.totals.onlineCreated,
                })}
              </div>
            </TableCell>
            <TableCell className="text-right">{n(report.totals.appointmentsCompleted)}</TableCell>
            <TableCell className="text-right">{n(report.totals.noShows)}</TableCell>
            <TableCell className="text-right">{n(report.totals.billsPaid)}</TableCell>
            <TableCell className="whitespace-nowrap text-right">
              {money(report.totals.revenueMinor)}
            </TableCell>
            <TableCell className="text-right">{n(report.totals.newCustomers)}</TableCell>
            <TableCell className="text-right">{n(report.totals.messagesSent)}</TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function SortHead({
  k,
  label,
  right = true,
  sort,
  onSort,
}: {
  k: SortKey;
  label: string;
  right?: boolean;
  sort: Sort;
  onSort: (s: Sort) => void;
}) {
  const active = sort?.key === k;
  // first click: biggest / latest first (names A→Z), second flips, third goes back to the default order
  const first = k !== 'name';
  return (
    <TableHead
      className={right ? 'text-right' : undefined}
      aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:underline"
        onClick={() =>
          onSort(!active ? { key: k, desc: first } : sort.desc === first ? { key: k, desc: !first } : null)
        }
      >
        {label}
        {active ? sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" /> : null}
      </button>
    </TableHead>
  );
}

/** Icon plus text: never meaning by colour alone. */
function SetupItem({ ok, label }: { ok: boolean; label: string }) {
  const { t } = useTranslation('platform');
  return (
    <span
      className={`inline-flex items-center gap-0.5 whitespace-nowrap ${ok ? '' : 'text-muted-foreground'}`}
      title={`${label}: ${t(ok ? 'usageReport.setup.ok' : 'usageReport.setup.missing')}`}
    >
      {ok ? (
        <Check className="size-3.5 text-success" aria-hidden />
      ) : (
        <X className="size-3.5 text-destructive" aria-hidden />
      )}
      <span className="sr-only">{t(ok ? 'usageReport.setup.ok' : 'usageReport.setup.missing')}: </span>
      {label}
    </span>
  );
}
