import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCan } from '@/lib/permissions';
import { type TenantDetail, useClearDemoData, useFillDemoData, usePatchTenant } from '../api';
import { formatDateTime, formatMoney, useIntlLocale } from '../format';
import { Field } from './common';

const DAYS = [60, 90] as const;
const SIZES = ['small', 'medium', 'large'] as const;

/**
 * ร้านทดลอง: flag a shop as a demo shop, then fill it with fake history (customers, calendar, bills …) or clear it.
 * Owner/admin only (`platform:manage`); the API refuses any shop that is not a demo shop.
 */
export function DemoDataCard({ d }: { d: TenantDetail }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const canManage = useCan('platform:manage');
  const patch = usePatchTenant(d.id);
  const fill = useFillDemoData(d.id);
  const clear = useClearDemoData(d.id);
  const [days, setDays] = useState<(typeof DAYS)[number]>(90);
  const [size, setSize] = useState<(typeof SIZES)[number]>('medium');
  const [confirm, setConfirm] = useState<'fill' | 'clear' | null>(null);
  if (!canManage) return null;
  const last = d.demo.lastRun;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {t('demo.title')}
          {d.demo.enabled ? <Badge variant="outline">{t('demo.badge')}</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <label htmlFor="demo-flag" className="flex min-h-11 items-center gap-3 text-sm">
          <Switch
            id="demo-flag"
            checked={d.demo.enabled}
            // a demo-… slug is a demo shop whatever the flag says
            disabled={patch.isPending || (d.demo.enabled && !d.demo.flagged)}
            onCheckedChange={(on) => patch.mutate({ demo: on })}
            aria-label={t('demo.flag')}
          />
          <span>
            {t('demo.flag')}
            <span className="block text-xs text-muted-foreground">
              {d.demo.enabled && !d.demo.flagged ? t('demo.slugHint') : t('demo.flagHint')}
            </span>
          </span>
        </label>
        {d.demo.enabled ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('demo.daysBack')}>
                <Select
                  value={String(days)}
                  onValueChange={(v) => setDays(Number(v) as (typeof DAYS)[number])}
                >
                  <SelectTrigger className="w-40" aria-label={t('demo.daysBack')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {t('demo.days', { count: n })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t('demo.size')}>
                <Select value={size} onValueChange={(v) => setSize(v as (typeof SIZES)[number])}>
                  <SelectTrigger className="w-40" aria-label={t('demo.size')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`demo.sizes.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setConfirm('fill')} disabled={fill.isPending || clear.isPending}>
                {t('demo.fill')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirm('clear')}
                disabled={!last || fill.isPending || clear.isPending}
              >
                {t('demo.clear')}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {last
                ? t('demo.lastRun', {
                    at: formatDateTime(last.at, locale),
                    customers: last.counts.customers.toLocaleString(locale),
                    appointments: last.counts.appointments.toLocaleString(locale),
                    bills: last.counts.bills.toLocaleString(locale),
                    paid: formatMoney(last.counts.paidMinor, locale),
                  })
                : t('demo.never')}
            </p>
          </>
        ) : null}
      </CardContent>
      <ConfirmDialog
        open={confirm === 'fill'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('demo.confirmFillTitle', { name: d.name })}
        description={t('demo.confirmFill', { days, size: t(`demo.sizes.${size}`) })}
        confirmLabel={t('demo.fill')}
        pending={fill.isPending}
        onConfirm={() =>
          fill.mutate(
            { daysBack: days, size },
            {
              onSuccess: (r) => {
                setConfirm(null);
                toast.success(t('demo.filled', { count: r.data.generated.appointments }));
              },
            },
          )
        }
      />
      <ConfirmDialog
        open={confirm === 'clear'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('demo.confirmClearTitle', { name: d.name })}
        description={t('demo.confirmClear')}
        confirmLabel={t('demo.clear')}
        destructive
        pending={clear.isPending}
        onConfirm={() =>
          clear.mutate(undefined, {
            onSuccess: () => {
              setConfirm(null);
              toast.success(t('demo.cleared'));
            },
          })
        }
      />
    </Card>
  );
}
