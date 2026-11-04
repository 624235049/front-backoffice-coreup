import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AdsOverview, AdsRow } from '../ads-api';
import { money, num, percent, times } from '../ads-format';

type Funnel = AdsRow['funnel'];
type Metrics = AdsRow['metrics'];
const UNKNOWN_AD = '__unknown';

const th = 'whitespace-nowrap text-right';
const td = 'whitespace-nowrap text-right tabular-nums';

function StatusBadge({ status }: { status: string | null }) {
  const { t } = useTranslation('ads');
  if (!status) return null;
  return (
    <Badge variant={status === 'ACTIVE' ? 'success' : 'secondary'}>
      {t(`adStatus.${status}`, { defaultValue: status })}
    </Badge>
  );
}

/** The funnel + money columns shared by every table: chats → qualified → demo → trial → paid, revenue, metrics. */
function FunnelHead() {
  const { t } = useTranslation('ads');
  return (
    <>
      <TableHead className={th}>{t('table.chats')}</TableHead>
      <TableHead className={th}>{t('table.qualified')}</TableHead>
      <TableHead className={th}>{t('table.demoSent')}</TableHead>
      <TableHead className={th}>{t('table.trials')}</TableHead>
      <TableHead className={th}>{t('table.paid')}</TableHead>
      <TableHead className={th}>{t('table.revenue')}</TableHead>
      <TableHead className={th}>{t('table.costPerChat')}</TableHead>
      <TableHead className={th}>{t('table.costPerTrial')}</TableHead>
      <TableHead className={th}>{t('table.cac')}</TableHead>
      <TableHead className={th}>{t('table.roas')}</TableHead>
      <TableHead className={th}>{t('table.roas3m')}</TableHead>
      <TableHead className={th}>{t('table.payback')}</TableHead>
    </>
  );
}

function FunnelCells({
  funnel,
  firstMinor,
  metrics,
  locale,
}: {
  funnel: Funnel;
  firstMinor: number;
  metrics: Metrics;
  locale: string;
}) {
  return (
    <>
      <TableCell className={td}>{num(funnel.chats, locale)}</TableCell>
      <TableCell className={td}>{num(funnel.qualified, locale)}</TableCell>
      <TableCell className={td}>{num(funnel.demoSent, locale)}</TableCell>
      <TableCell className={td}>{num(funnel.trials, locale)}</TableCell>
      <TableCell className={td}>{num(funnel.paidShops, locale)}</TableCell>
      <TableCell className={td}>{money(firstMinor, locale)}</TableCell>
      <TableCell className={td}>{money(metrics.costPerChatMinor, locale)}</TableCell>
      <TableCell className={td}>{money(metrics.costPerTrialMinor, locale)}</TableCell>
      <TableCell className={td}>{money(metrics.cacMinor, locale)}</TableCell>
      <TableCell className={td}>{times(metrics.roasFirst)}</TableCell>
      <TableCell className={td}>{times(metrics.roas3m)}</TableCell>
      <TableCell className={td}>{num(metrics.paybackMonths, locale, 1)}</TableCell>
    </>
  );
}

function rowName(r: AdsRow, unknown: string): string {
  return r.id === UNKNOWN_AD ? unknown : r.name || r.id;
}

/** One row on a phone: name, spend and the funnel in a sentence. */
function MobileCard({ r, locale, indent }: { r: AdsRow; locale: string; indent?: boolean }) {
  const { t } = useTranslation('ads');
  return (
    <div className={`rounded-lg border p-3 ${indent ? 'ml-4' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 break-words font-medium">{rowName(r, t('table.unknownAd'))}</div>
        <StatusBadge status={r.status} />
      </div>
      <div className="mt-1 text-sm text-muted-foreground">
        {money(r.spendMinor, locale)} ·{' '}
        {t('table.funnel', { chats: r.funnel.chats, trials: r.funnel.trials, paid: r.funnel.paidShops })}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
        <span>
          {t('table.costPerChat')} {money(r.metrics.costPerChatMinor, locale)}
        </span>
        <span>
          {t('table.cac')} {money(r.metrics.cacMinor, locale)}
        </span>
        <span>
          {t('table.roas')} {times(r.metrics.roasFirst)}
        </span>
      </div>
    </div>
  );
}

/** Campaigns with their ads folded underneath: spend, delivery numbers, funnel and the money metrics. */
export function CampaignTable({ rows, locale }: { rows: AdsOverview['campaigns']; locale: string }) {
  const { t } = useTranslation('ads');
  const [open, setOpen] = useState<Set<string>>(new Set());
  if (rows.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">{t('table.empty')}</p>;
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  return (
    <>
      <div className="grid gap-2 md:hidden" data-testid="ads-mobile-list">
        {rows.map((c) => (
          <Fragment key={c.id}>
            <MobileCard r={c} locale={locale} />
            {c.ads.map((a) => (
              <MobileCard key={a.id} r={a} locale={locale} indent />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-52">{t('table.name')}</TableHead>
              <TableHead className={th}>{t('table.spend')}</TableHead>
              <TableHead className={th}>{t('table.reach')}</TableHead>
              <TableHead className={th}>{t('table.frequency')}</TableHead>
              <TableHead className={th}>{t('table.ctr')}</TableHead>
              <TableHead className={th}>{t('table.cpc')}</TableHead>
              <FunnelHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => {
              const expanded = open.has(c.id);
              return (
                <Fragment key={c.id}>
                  <TableRow className="bg-muted/30 font-medium">
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-expanded={expanded}
                          aria-label={expanded ? t('table.collapse') : t('table.expand')}
                          onClick={() => toggle(c.id)}
                        >
                          {expanded ? <ChevronDown /> : <ChevronRight />}
                        </Button>
                        <span className="break-words">{rowName(c, t('table.unknownAd'))}</span>
                        <StatusBadge status={c.status} />
                      </div>
                    </TableCell>
                    <Numbers r={c} locale={locale} />
                  </TableRow>
                  {expanded
                    ? c.ads.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="pl-10">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="break-words">{rowName(a, t('table.unknownAd'))}</span>
                              <StatusBadge status={a.status} />
                              {a.dailyBudgetMinor ? (
                                <span className="text-xs text-muted-foreground">
                                  {t('table.budget')} {money(a.dailyBudgetMinor, locale)}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <Numbers r={a} locale={locale} />
                        </TableRow>
                      ))
                    : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function Numbers({ r, locale }: { r: AdsRow; locale: string }) {
  return (
    <>
      <TableCell className={td}>{money(r.spendMinor, locale)}</TableCell>
      <TableCell className={td}>{num(r.reach, locale)}</TableCell>
      <TableCell className={td}>{num(r.frequency, locale, 2)}</TableCell>
      <TableCell className={td}>{percent(r.ctr)}</TableCell>
      <TableCell className={td}>{money(r.cpcMinor, locale)}</TableCell>
      <FunnelCells funnel={r.funnel} firstMinor={r.revenue.firstMinor} metrics={r.metrics} locale={locale} />
    </>
  );
}

/** Creatives (ads sharing one image/video are one row). */
export function CreativeTable({ rows, locale }: { rows: AdsOverview['creatives']; locale: string }) {
  const { t } = useTranslation('ads');
  if (rows.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">{t('table.empty')}</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-52">{t('table.name')}</TableHead>
            <TableHead className={th}>{t('table.spend')}</TableHead>
            <TableHead className={th}>{t('table.frequency')}</TableHead>
            <TableHead className={th}>{t('table.ctr')}</TableHead>
            <FunnelHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {r.creativeThumbUrl ? (
                    <img
                      src={r.creativeThumbUrl}
                      alt=""
                      className="size-8 rounded object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <span className="break-words">{rowName(r, t('table.unknownAd'))}</span>
                </div>
              </TableCell>
              <TableCell className={td}>{money(r.spendMinor, locale)}</TableCell>
              <TableCell className={td}>{num(r.frequency, locale, 2)}</TableCell>
              <TableCell className={td}>{percent(r.ctr)}</TableCell>
              <FunnelCells
                funnel={r.funnel}
                firstMinor={r.revenue.firstMinor}
                metrics={r.metrics}
                locale={locale}
              />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Chats and money by what kind of shop the customer runs (dress rental, salon …). */
export function ShopTypeTable({ rows, locale }: { rows: AdsOverview['shopTypes']; locale: string }) {
  const { t } = useTranslation('ads');
  if (rows.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">{t('table.empty')}</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.shopType')}</TableHead>
            <TableHead className={th}>{t('table.spend')}</TableHead>
            <FunnelHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.shopType}>
              <TableCell>{t(`shopType.${r.shopType}`, { defaultValue: r.shopType })}</TableCell>
              <TableCell className={td}>{money(r.spendMinor, locale)}</TableCell>
              <FunnelCells
                funnel={r.funnel}
                firstMinor={r.revenue.firstMinor}
                metrics={r.metrics}
                locale={locale}
              />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Where the ads were shown (Reels, feed, stories) and what a chat cost there. */
export function PlacementTable({ rows, locale }: { rows: AdsOverview['placements']; locale: string }) {
  const { t } = useTranslation('ads');
  if (rows.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">{t('table.empty')}</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.placement')}</TableHead>
            <TableHead className={th}>{t('table.spend')}</TableHead>
            <TableHead className={th}>{t('table.impressions')}</TableHead>
            <TableHead className={th}>{t('table.chats')}</TableHead>
            <TableHead className={th}>{t('table.costPerChat')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.placement}>
              <TableCell className="break-words">{r.placement}</TableCell>
              <TableCell className={td}>{money(r.spendMinor, locale)}</TableCell>
              <TableCell className={td}>{num(r.impressions, locale)}</TableCell>
              <TableCell className={td}>{num(r.chats, locale)}</TableCell>
              <TableCell className={td}>{money(r.costPerChatMinor, locale)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
