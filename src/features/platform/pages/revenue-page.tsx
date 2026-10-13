import { TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMembership } from '@/lib/membership';
import { useRevenue } from '../api';
import { Stat } from '../components/common';
import { formatMoney, todayBangkok, useIntlLocale } from '../format';

/** CoreUp's own finances — `platform_owner` only (docs/09 §2). The API enforces it; the page is also hidden from others. */
export function RevenuePage() {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const isOwner = useMembership().roles.includes('platform_owner');
  const today = todayBangkok();
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const revenue = useRevenue({ from, to }, isOwner);

  if (!isOwner) {
    return (
      <EmptyState icon={TrendingUp} title={t('revenue.ownerOnly')} description={t('revenue.ownerOnlyHint')} />
    );
  }
  return (
    <>
      <PageHeader title={t('revenue.title')} description={t('revenue.description')} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="rev-from">{t('revenue.from')}</Label>
          <Input id="rev-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="rev-to">{t('revenue.to')}</Label>
          <Input id="rev-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <QueryState query={revenue}>
        {({ data: r }) => {
          const max = Math.max(1, ...r.byMonth.map((m) => m.subscriptionMinor + m.engagementMinor));
          return (
            <div className="grid gap-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label={t('revenue.mrr')} value={formatMoney(r.mrrMinor, locale)} icon={TrendingUp} />
                <Stat
                  label={t('revenue.subscription')}
                  value={formatMoney(r.subscriptionMinor, locale)}
                  hint={t('revenue.exVat')}
                />
                <Stat
                  label={t('revenue.engagement')}
                  value={formatMoney(r.engagementMinor, locale)}
                  hint={t('revenue.exVat')}
                />
                <Stat
                  label={t('revenue.pipeline')}
                  value={formatMoney(r.engagementPipelineMinor, locale)}
                  hint={t('revenue.pipelineHint')}
                />
                <Stat
                  label={t('revenue.paid')}
                  value={formatMoney(r.paidMinor, locale)}
                  hint={t('revenue.incVat')}
                />
                <Stat
                  label={t('revenue.outstanding')}
                  value={formatMoney(r.outstandingMinor, locale)}
                  tone={r.outstandingMinor > 0 ? 'warning' : 'default'}
                  hint={t('revenue.incVat')}
                />
                <Stat label={t('revenue.vat')} value={formatMoney(r.vatMinor, locale)} />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('revenue.byMonth')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {r.byMonth.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('revenue.noData')}</p>
                  ) : (
                    <ul className="grid gap-2">
                      {r.byMonth.map((m) => (
                        <li
                          key={m.month}
                          className="grid grid-cols-[5rem_1fr_9rem] items-center gap-3 text-sm"
                        >
                          <span className="text-muted-foreground">{m.month}</span>
                          <div
                            className="flex h-5 overflow-hidden rounded bg-muted"
                            role="img"
                            aria-label={`${m.month}: ${formatMoney(m.subscriptionMinor + m.engagementMinor, locale)}`}
                          >
                            <div
                              className="bg-primary"
                              style={{ width: `${(m.subscriptionMinor / max) * 100}%` }}
                              title={t('revenue.subscription')}
                            />
                            <div
                              className="bg-warning"
                              style={{ width: `${(m.engagementMinor / max) * 100}%` }}
                              title={t('revenue.engagement')}
                            />
                          </div>
                          <span className="text-right font-medium">
                            {formatMoney(m.subscriptionMinor + m.engagementMinor, locale)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <i className="inline-block size-2 rounded bg-primary" /> {t('revenue.subscription')}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="inline-block size-2 rounded bg-warning" /> {t('revenue.engagement')}
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('revenue.topShops')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {r.topTenants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('revenue.noData')}</p>
                  ) : (
                    <ol className="divide-y">
                      {r.topTenants.map((s, i) => (
                        <li key={s.tenantId} className="flex justify-between gap-3 py-2 text-sm">
                          <span>
                            {i + 1}. {s.name}
                          </span>
                          <span className="font-medium">{formatMoney(s.invoicedMinor, locale)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        }}
      </QueryState>
    </>
  );
}
