import { Pencil, Send } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { type Plan, usePatchPlan } from '../api';
import { formatMoney, useIntlLocale } from '../format';
import { MODULE_GROUPS } from '../module-menus';
import { familyMismatch, limitsLine, type PlanFamily, yearlyDeal } from '../plan-families';

export interface PlanActions {
  onOffer: (p: Plan) => void;
  onEdit: (p: Plan) => void;
}

/** One DB plan: title + code on the left; on/off switch, send and edit on the right (wraps under it on a phone). */
function PlanRow({
  plan,
  title,
  sub,
  sold,
  actions,
}: {
  plan: Plan;
  title: ReactNode;
  sub?: ReactNode;
  /** true = a package the web sells, so "on" reads as "on sale" */
  sold: boolean;
  actions: PlanActions;
}) {
  const { t } = useTranslation('platform');
  const patch = usePatchPlan();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {title}
          <span className="font-mono text-xs text-muted-foreground">{plan.code}</span>
        </div>
        {sub ? <div className="text-sm text-muted-foreground">{sub}</div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Switch
          checked={plan.active}
          disabled={patch.isPending}
          aria-label={t('plans.toggle', { name: plan.name })}
          onCheckedChange={(active) =>
            patch.mutate(
              { id: plan.id, body: { active } },
              {
                onSuccess: () =>
                  toast.success(t(active ? 'plans.activated' : 'plans.deactivated', { name: plan.name })),
              },
            )
          }
        />
        <Badge variant={plan.active ? 'success' : 'secondary'}>
          {t(plan.active ? (sold ? 'plans.active' : 'plans.on') : 'plans.inactive')}
        </Badge>
        <Button size="sm" variant="ghost" onClick={() => actions.onOffer(plan)}>
          <Send /> {t('plans.offer.button')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => actions.onEdit(plan)}>
          <Pencil /> {t('plans.edit')}
        </Button>
      </div>
    </div>
  );
}

/** Modules in the three pricing-page groups; `lite` (a screen mode, not a feature) apart; `core` is always on. */
function ModuleGroups({ modules }: { modules: string[] }) {
  const { t } = useTranslation('platform');
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {MODULE_GROUPS.map((g) => {
        const on = g.modules.filter((m) => modules.includes(m));
        return (
          <div key={g.key}>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              {t(`detail.moduleGroup.${g.key}`)}
            </div>
            <div className="flex flex-wrap gap-1">
              {on.length === 0 ? (
                <span className="text-sm text-muted-foreground">–</span>
              ) : (
                on.map((m) => (
                  <Badge key={m} variant="secondary">
                    {t(`module.${m}`)}
                  </Badge>
                ))
              )}
            </div>
          </div>
        );
      })}
      {modules.includes('lite') ? (
        <div className="sm:col-span-3">
          <Badge variant="outline">{t('plans.liteMode')}</Badge>
        </div>
      ) : null}
    </div>
  );
}

/** One package of the public pricing page: front name, sale badge, limits, modules, and its monthly + yearly plans. */
export function FamilyCard({ family, actions }: { family: PlanFamily; actions: PlanActions }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const shown = family.month ?? family.year;
  if (!shown) return null;
  const deal = yearlyDeal(family);
  const price = (p: Plan, per: 'month' | 'year') => (
    <span className="text-lg font-semibold">
      {formatMoney(p.priceMinor, locale)}
      <span className="text-sm font-normal text-muted-foreground">{t(`plans.per.${per}`)}</span>
    </span>
  );
  return (
    <Card>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">{family.name}</h2>
          {family.best ? <Badge>{t('plans.best')}</Badge> : null}
          <Badge variant={shown.selfServe ? 'success' : 'outline'}>
            {t(shown.selfServe ? 'plans.sale.web' : 'plans.sale.team')}
          </Badge>
          {familyMismatch(family) ? <Badge variant="warning">{t('plans.mismatch')}</Badge> : null}
        </div>
        <p className="text-sm">{limitsLine(shown.limits, t, locale)}</p>
        <ModuleGroups modules={shown.modules} />
        <div className="divide-y border-t">
          {family.month ? (
            <PlanRow plan={family.month} title={price(family.month, 'month')} sold actions={actions} />
          ) : (
            <p className="py-3 text-sm text-muted-foreground">
              {t('plans.noRow', { interval: t('plans.interval.month') })}
            </p>
          )}
          {family.year ? (
            <PlanRow
              plan={family.year}
              title={price(family.year, 'year')}
              sub={
                deal
                  ? [
                      t('plans.avgMonth', { price: formatMoney(deal.avgMinor, locale) }),
                      deal.paidMonths ? t('plans.paidOf12', { paid: deal.paidMonths }) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : undefined
              }
              sold
              actions={actions}
            />
          ) : (
            <p className="py-3 text-sm text-muted-foreground">
              {t('plans.noRow', { interval: t('plans.interval.year') })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Plans outside the pricing-page families (internal ฿0 plans, other priced ones): DB name, price, limits, shops on it. */
export function PlainPlanList({ plans, actions }: { plans: Plan[]; actions: PlanActions }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  return (
    <Card>
      <CardContent className="divide-y">
        {plans.map((p) => (
          <PlanRow
            key={p.id}
            plan={p}
            sold={false}
            actions={actions}
            title={
              <>
                <span className="font-medium">{p.name}</span>
                <span className="text-sm">
                  {formatMoney(p.priceMinor, locale)}
                  {t(`plans.per.${p.interval}`)}
                </span>
              </>
            }
            sub={
              <>
                <div>{limitsLine(p.limits, t, locale)}</div>
                <div>{t('plans.internal.shops', { count: p.tenantCount })}</div>
              </>
            }
          />
        ))}
      </CardContent>
    </Card>
  );
}
