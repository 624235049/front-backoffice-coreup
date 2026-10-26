import { Copy, Package, Plus, Printer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ApiBody } from '@/lib/api';
import { type Plan, useCreatePlan, usePatchPlan, usePlans } from '../api';
import { AddonsCard } from '../components/addons-card';
import {
  cleanMarketing,
  type Marketing,
  MarketingSection,
  marketingNameMissing,
} from '../components/marketing-section';
import { FamilyCard, PlainPlanList } from '../components/plan-cards';
import { formatMoney, parseBahtToMinor, useIntlLocale } from '../format';
import { groupPlans } from '../plan-families';
import { PLAN_LIMITS as LIMITS, SHOP_MODULES as MODULES } from '../plans';

// booking-only product: small shop app; LINE reminders from the shop's own OA, capped by the plan's message quota
const LINE_BOOKING_PRESET = ['core', 'crm', 'booking', 'messaging', 'lite'];
type PlanModules = NonNullable<ApiBody<'/v1/platform/plans', 'post'>['modules']>;
const CODE_RE = /^[a-z0-9][a-z0-9_-]{1,30}$/;

/** `/platform/plans` — the team creates and edits the packages sold to shops (permission `platform:manage`). */
export function PlansPage() {
  const { t } = useTranslation('platform');
  const plans = usePlans();
  // `null` = closed, `'new'` = create, a plan = edit
  const [editing, setEditing] = useState<Plan | 'new' | null>(null);
  const [offer, setOffer] = useState<Plan | null>(null);

  return (
    <>
      <PageHeader
        title={t('plans.title')}
        description={t('plans.description')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus /> {t('plans.create')}
          </Button>
        }
      />
      <QueryState
        query={plans}
        isEmpty={(rows) => rows.length === 0}
        empty={<EmptyState icon={Package} title={t('plans.empty')} />}
      >
        {(rows: Plan[]) => {
          const { families, internal, other } = groupPlans(rows);
          const actions = { onOffer: setOffer, onEdit: setEditing };
          return (
            <div className="grid gap-4">
              {families.map((f) => (
                <FamilyCard key={f.key} family={f} actions={actions} />
              ))}
              {other.length > 0 ? (
                <section className="grid gap-2">
                  <h2 className="text-sm font-semibold">{t('plans.other')}</h2>
                  <PlainPlanList plans={other} actions={actions} />
                </section>
              ) : null}
              <AddonsCard />
              {internal.length > 0 ? (
                <details>
                  <summary className="cursor-pointer text-sm font-semibold">
                    {t('plans.internal.title')}
                  </summary>
                  <div className="mt-2">
                    <PlainPlanList plans={internal} actions={actions} />
                  </div>
                </details>
              ) : null}
            </div>
          );
        }}
      </QueryState>
      <p className="mt-3 text-sm text-muted-foreground">{t('plans.hint')}</p>
      {editing ? (
        <PlanDialog
          key={editing === 'new' ? 'new' : editing.id}
          plan={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {offer ? <OfferDialog plan={offer} onClose={() => setOffer(null)} /> : null}
    </>
  );
}

/** What a customer gets on this plan, in plain Thai: copied into a LINE chat or printed / saved as PDF. */
function OfferDialog({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const text = [
    t('plans.offer.heading', { name: plan.name }),
    t('plans.offer.price', {
      price: formatMoney(plan.priceMinor, locale),
      per: t(`plans.per.${plan.interval}`),
    }),
    '',
    t('plans.offer.gets'),
    ...MODULES.filter((m) => plan.modules.includes(m)).map((m) => `• ${t(`plans.offer.module.${m}`)}`),
    '',
    t('plans.offer.limits'),
    ...LIMITS.map(
      (k) =>
        `• ${t(`plans.limit.${k}`)}: ${
          plan.limits[k] === undefined
            ? t(k === 'slip_checks_month' ? 'plans.offer.none' : 'plans.offer.unlimited')
            : plan.limits[k].toLocaleString(locale)
        }`,
    ),
    '',
    t('plans.offer.footer'),
  ].join('\n');

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    w.document.write(
      `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(plan.name)}</title>` +
        '<style>@page{size:A4;margin:18mm}body{font-family:"Noto Sans Thai","Sarabun",system-ui,sans-serif;' +
        'font-size:15px;line-height:1.7;color:#0f2540;white-space:pre-line}' +
        'body::first-line{font-size:22px;font-weight:700}</style></head>' +
        `<body>${esc(text)}</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  };
  // a ฿0 or switched-off plan cannot be paid for by the shop, so never send it to a customer
  const notSellable =
    (plan.priceMinor === 0 && t('plans.offer.zeroPrice')) || (!plan.active && t('plans.offer.inactive'));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('plans.offer.title')}</DialogTitle>
          <DialogDescription>{t('plans.offer.hint')}</DialogDescription>
        </DialogHeader>
        <div
          className="rounded-lg border bg-muted/40 p-4 text-sm whitespace-pre-line"
          data-testid="plan-offer"
        >
          {text}
        </div>
        {notSellable ? (
          <p className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm" role="alert">
            {notSellable}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" blockedReason={notSellable} onClick={print}>
            <Printer /> {t('plans.offer.print')}
          </Button>
          <Button
            blockedReason={notSellable}
            onClick={() =>
              void navigator.clipboard.writeText(text).then(() => toast.success(t('plans.offer.copied')))
            }
          >
            <Copy /> {t('plans.offer.copy')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanDialog({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const { t } = useTranslation('platform');
  const create = useCreatePlan();
  const patch = usePatchPlan();
  const [code, setCode] = useState('');
  const [name, setName] = useState(plan?.name ?? '');
  const [price, setPrice] = useState(plan ? String(plan.priceMinor / 100) : '');
  const [interval, setInterval] = useState<Plan['interval']>(plan?.interval ?? 'month');
  const [modules, setModules] = useState<string[]>(plan?.modules ?? ['core']);
  const [limits, setLimits] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(plan?.limits ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const [applyToShops, setApplyToShops] = useState(false);
  // sales copy: monthly plans only (a yearly plan reuses its monthly plan's copy)
  const [marketing, setMarketing] = useState<Marketing | null>(plan?.marketing ?? null);
  const yearly = plan ? plan.code.endsWith('-year') : false;

  const priceMinor = parseBahtToMinor(price);
  const badLimit = LIMITS.find(
    (k) => (limits[k] ?? '').trim() !== '' && !/^\d+$/.test((limits[k] ?? '').trim()),
  );
  const blockedReason =
    (!plan && !CODE_RE.test(code) && t('plans.err.code')) ||
    (name.trim().length === 0 || name.trim().length > 80 ? t('plans.err.name') : false) ||
    (priceMinor === null && t('plans.err.price')) ||
    (badLimit ? t('plans.err.limit', { name: t(`plans.limit.${badLimit}`) }) : false) ||
    (marketing && marketingNameMissing(marketing) ? t('plans.err.marketingName') : false);

  const save = () => {
    // empty field = unlimited = no key
    const body = {
      name: name.trim(),
      priceMinor: priceMinor as number,
      interval,
      modules: modules as PlanModules,
      limits: Object.fromEntries(
        LIMITS.flatMap((k) => ((limits[k] ?? '').trim() === '' ? [] : [[k, Number(limits[k])]])),
      ),
    };
    const done = (msg: string) => ({
      onSuccess: () => {
        toast.success(msg);
        onClose();
      },
    });
    if (plan)
      patch.mutate(
        {
          id: plan.id,
          body: {
            ...body,
            applyToShops,
            // only a changed copy is sent: it has its own audit row
            ...(marketing && JSON.stringify(cleanMarketing(marketing)) !== JSON.stringify(plan.marketing)
              ? { marketing: cleanMarketing(marketing) }
              : {}),
          },
        },
        done(t('plans.saved', { name: body.name })),
      );
    else create.mutate({ ...body, code }, done(t('plans.created', { name: body.name })));
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t(plan ? 'plans.editTitle' : 'plans.create')}</DialogTitle>
          <DialogDescription>{t('plans.dialogHint')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="pl-code">{t('plans.field.code')}</Label>
              <Input
                id="pl-code"
                value={plan ? plan.code : code}
                readOnly={!!plan}
                disabled={!!plan}
                onChange={(e) => setCode(e.target.value)}
                placeholder="booking-basic"
              />
              {plan ? null : (
                <p className="mt-1 text-xs text-muted-foreground">{t('plans.field.codeHint')}</p>
              )}
            </div>
            <div>
              <Label htmlFor="pl-name">{t('plans.field.name')}</Label>
              <Input id="pl-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pl-price">{t('plans.field.price')}</Label>
              <Input
                id="pl-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="299"
              />
              <p className="mt-1 text-xs text-muted-foreground">{t('plans.field.priceHint')}</p>
              {priceMinor === 0 ? (
                <p className="mt-1 text-xs text-warning">{t('plans.field.zeroPrice')}</p>
              ) : null}
            </div>
            <div>
              <Label>{t('plans.field.interval')}</Label>
              <Select value={interval} onValueChange={(v) => setInterval(v as Plan['interval'])}>
                <SelectTrigger aria-label={t('plans.field.interval')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">{t('plans.interval.month')}</SelectItem>
                  <SelectItem value="year">{t('plans.interval.year')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Label>{t('plans.field.modules')}</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setModules(LINE_BOOKING_PRESET)}
              >
                {t('plans.preset')}
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODULES.map((m) => (
                <Label key={m} className="flex items-start gap-2 font-normal">
                  <Checkbox
                    className="mt-0.5"
                    checked={modules.includes(m)}
                    disabled={m === 'core'}
                    onCheckedChange={(on) =>
                      setModules((cur) => (on === true ? [...cur, m] : cur.filter((x) => x !== m)))
                    }
                  />
                  <span>
                    <span className="block font-medium">{t(`module.${m}`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`plans.moduleHint.${m}`)}</span>
                  </span>
                </Label>
              ))}
            </div>
          </div>

          <div>
            <Label>{t('plans.field.limits')}</Label>
            <p className="mb-2 text-xs text-muted-foreground">{t('plans.field.limitsHint')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {LIMITS.map((k) => (
                <div key={k}>
                  <Label htmlFor={`pl-limit-${k}`} className="font-normal">
                    {t(`plans.limit.${k}`)}
                  </Label>
                  <Input
                    id={`pl-limit-${k}`}
                    inputMode="numeric"
                    value={limits[k] ?? ''}
                    placeholder={
                      k === 'slip_checks_month' ? t('plans.slipPlaceholder') : t('plans.unlimited')
                    }
                    onChange={(e) => setLimits((cur) => ({ ...cur, [k]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
          <section className="grid gap-2" aria-label={t('plans.marketing.title')}>
            <h3 className="text-sm font-semibold">{t('plans.marketing.title')}</h3>
            {!plan ? (
              <p className="text-sm text-muted-foreground">{t('plans.marketing.saveFirst')}</p>
            ) : yearly ? (
              <p className="text-sm text-muted-foreground">{t('plans.marketing.yearly')}</p>
            ) : (
              <MarketingSection
                planCode={plan.code}
                value={marketing}
                onChange={setMarketing}
                priceMinor={priceMinor}
                limits={Object.fromEntries(
                  LIMITS.flatMap((k) =>
                    /^\d+$/.test((limits[k] ?? '').trim()) ? [[k, Number(limits[k])]] : [],
                  ),
                )}
              />
            )}
          </section>
          {plan ? (
            <Label className="flex items-start gap-2 font-normal">
              <Checkbox
                className="mt-0.5"
                checked={applyToShops}
                onCheckedChange={(on) => setApplyToShops(on === true)}
              />
              <span>
                <span className="block font-medium">{t('plans.applyToShops')}</span>
                <span className="block text-xs text-muted-foreground">{t('plans.applyToShopsHint')}</span>
              </span>
            </Label>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={create.isPending || patch.isPending} blockedReason={blockedReason} onClick={save}>
            {t('plans.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
