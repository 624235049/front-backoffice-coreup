import { Copy, Package, Pencil, Plus, Printer, Send } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
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
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ApiBody } from '@/lib/api';
import { type Plan, useCreatePlan, usePatchPlan, usePlans } from '../api';
import { formatMoney, parseBahtToMinor, useIntlLocale } from '../format';

/** Modules a shop can have switched on (`core` is always on). Order = order shown in the dialog. */
const MODULES = [
  'core',
  'crm',
  'messaging',
  'booking',
  'checkout',
  'payouts',
  'inventory',
  'shifts',
  'checklists',
  'sop',
  'surveys',
  'reports',
  'approvals',
  'clinical',
  'kpi',
] as const;
const LINE_BOOKING_PRESET = ['core', 'crm', 'messaging', 'booking'];
const LIMITS = ['branches', 'members', 'customers', 'messages_per_month'] as const;
type PlanModules = NonNullable<ApiBody<'/v1/platform/plans', 'post'>['modules']>;
const CODE_RE = /^[a-z0-9][a-z0-9_-]{1,30}$/;

/** `/platform/plans` — the team creates and edits the packages sold to shops (permission `platform:manage`). */
export function PlansPage() {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const plans = usePlans();
  const patch = usePatchPlan();
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
        {(rows: Plan[]) => (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('plans.col.name')}</TableHead>
                  <TableHead>{t('plans.col.price')}</TableHead>
                  <TableHead>{t('plans.col.modules')}</TableHead>
                  <TableHead>{t('plans.col.limits')}</TableHead>
                  <TableHead>{t('plans.col.status')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{p.code}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div>
                        {formatMoney(p.priceMinor, locale)}
                        {t(`plans.per.${p.interval}`)}
                      </div>
                      <div className="text-xs text-muted-foreground">{t('plans.vat')}</div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {p.modules.map((m) => (
                          <Badge key={m} variant="secondary">
                            {t(`module.${m}`, { defaultValue: m })}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {LIMITS.map((k) => (
                        <div key={k}>
                          {t(`plans.limit.${k}`)}:{' '}
                          {p.limits[k] === undefined
                            ? t('plans.unlimited')
                            : p.limits[k].toLocaleString(locale)}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={p.active}
                          disabled={patch.isPending}
                          aria-label={t('plans.toggle', { name: p.name })}
                          onCheckedChange={(active) =>
                            patch.mutate(
                              { id: p.id, body: { active } },
                              {
                                onSuccess: () =>
                                  toast.success(
                                    t(active ? 'plans.activated' : 'plans.deactivated', { name: p.name }),
                                  ),
                              },
                            )
                          }
                        />
                        <Badge variant={p.active ? 'success' : 'secondary'}>
                          {t(p.active ? 'plans.active' : 'plans.inactive')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setOffer(p)}>
                        <Send /> {t('plans.offer.button')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                        <Pencil /> {t('plans.edit')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
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
          plan.limits[k] === undefined ? t('plans.offer.unlimited') : plan.limits[k].toLocaleString(locale)
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
        <DialogFooter>
          <Button variant="outline" onClick={print}>
            <Printer /> {t('plans.offer.print')}
          </Button>
          <Button
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

  const priceMinor = parseBahtToMinor(price);
  const badLimit = LIMITS.find(
    (k) => (limits[k] ?? '').trim() !== '' && !/^\d+$/.test((limits[k] ?? '').trim()),
  );
  const blockedReason =
    (!plan && !CODE_RE.test(code) && t('plans.err.code')) ||
    (name.trim().length === 0 || name.trim().length > 80 ? t('plans.err.name') : false) ||
    (priceMinor === null && t('plans.err.price')) ||
    (badLimit ? t('plans.err.limit', { name: t(`plans.limit.${badLimit}`) }) : false);

  const save = () => {
    // keep limits this form has no field for (set elsewhere); empty field = unlimited = no key
    const kept = Object.fromEntries(
      Object.entries(plan?.limits ?? {}).filter(([k]) => !(LIMITS as readonly string[]).includes(k)),
    );
    const body = {
      name: name.trim(),
      priceMinor: priceMinor as number,
      interval,
      modules: modules as PlanModules,
      limits: {
        ...kept,
        ...Object.fromEntries(
          LIMITS.flatMap((k) => ((limits[k] ?? '').trim() === '' ? [] : [[k, Number(limits[k])]])),
        ),
      },
    };
    const done = (msg: string) => ({
      onSuccess: () => {
        toast.success(msg);
        onClose();
      },
    });
    if (plan) patch.mutate({ id: plan.id, body }, done(t('plans.saved', { name: body.name })));
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
                    placeholder={t('plans.unlimited')}
                    onChange={(e) => setLimits((cur) => ({ ...cur, [k]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
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
