import { useNavigate } from '@tanstack/react-router';
import { Plus, Store } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Can } from '@/lib/permissions';
import { type TenantsQuery, useTenants } from '../api';
import { TenantStatusBadge, UsageHealthBadge } from '../components/common';
import { OnboardDialog } from '../components/onboard-dialog';
import { formatDate, useIntlLocale } from '../format';

const ALL = '__all__';

export function TenantsPage() {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [health, setHealth] = useState<string>(ALL);
  const [onboard, setOnboard] = useState(false);
  const query: TenantsQuery = {
    q: q.trim() || undefined,
    status: status === ALL ? undefined : (status as TenantsQuery['status']),
    health: health === ALL ? undefined : (health as TenantsQuery['health']),
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
            title={t('tenants.empty')}
            description={t('tenants.emptyHint')}
            action={
              <Can permission="platform:write">
                <Button onClick={() => setOnboard(true)}>
                  <Plus /> {t('tenants.onboard')}
                </Button>
              </Can>
            }
          />
        }
      >
        {(rows) => (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tenants.col.shop')}</TableHead>
                  <TableHead>{t('tenants.col.plan')}</TableHead>
                  <TableHead>{t('tenants.col.engagement')}</TableHead>
                  <TableHead>{t('tenants.col.consultants')}</TableHead>
                  <TableHead className="text-right">{t('tenants.col.users')}</TableHead>
                  <TableHead className="text-right">{t('tenants.col.appointments')}</TableHead>
                  <TableHead className="text-right">{t('tenants.col.health')}</TableHead>
                  <TableHead className="text-right">{t('tenants.col.noShow')}</TableHead>
                  <TableHead>{t('tenants.col.usage')}</TableHead>
                  <TableHead>{t('tenants.col.renewal')}</TableHead>
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
                      <div className="font-medium">{r.name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {t(`industry.${r.industryKey}`, { defaultValue: r.industryKey })} ·{' '}
                        {t('tenants.branches', { count: r.branches })} <TenantStatusBadge status={r.status} />
                      </div>
                    </TableCell>
                    <TableCell>{r.planName ?? '–'}</TableCell>
                    <TableCell>
                      {r.engagement ? (
                        <>
                          <div>{t(`engagementType.${r.engagement.type}`)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(r.engagement.endsOn, locale)}
                          </div>
                        </>
                      ) : (
                        '–'
                      )}
                    </TableCell>
                    <TableCell>{r.consultants.map((c) => c.name).join(', ') || '–'}</TableCell>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>
      <OnboardDialog
        open={onboard}
        onOpenChange={setOnboard}
        onCreated={(id) => void navigate({ to: '/platform/tenants/$id', params: { id } })}
      />
    </>
  );
}
