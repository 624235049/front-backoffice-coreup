import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCan } from '@/lib/permissions';
import { type TenantDetail, useSetTrialEnd } from '../api';
import { formatDate, todayBangkok, useIntlLocale } from '../format';
import { AccessBadge, Field } from './common';
/** One line for the shop lists: the access state and the last usable day (nothing for a shop that never expires). */
export function LockLine({ r }: { r: Pick<TenantDetail, 'lockOn' | 'access'> }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  if (!r.lockOn) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <AccessBadge access={r.access} />
      {t('lock.lockOn')}: {formatDate(r.lockOn, locale)}
    </div>
  );
}

/**
 * Shop access: trial end / last usable day / locked. The team can move the end of a free trial (`platform:billing`),
 * which unlocks a locked shop at once. A paying shop is unlocked by confirming its payment instead.
 */
export function LockCard({ d }: { d: TenantDetail }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const canExtend = useCan('platform:billing') && d.trialEndsOn !== null;
  const setTrialEnd = useSetTrialEnd(d.id);
  const [date, setDate] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('lock.title')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('lock.state')}>
            <AccessBadge access={d.access} />
          </Field>
          <Field label={t('lock.lockOn')}>
            {d.lockOn ? (
              <>
                {formatDate(d.lockOn, locale)}
                <span className="block text-xs text-muted-foreground">{t('lock.lockOnHint')}</span>
              </>
            ) : (
              t('lock.none')
            )}
          </Field>
        </div>
        {d.access === 'locked' ? <p className="text-sm text-destructive">{t('lock.lockedNote')}</p> : null}
        {canExtend ? (
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setTrialEnd.mutate(
                { trialEndsOn: date },
                {
                  onSuccess: (r) => {
                    toast.success(t('lock.extended', { date: formatDate(r.data.lockOn, locale) }));
                    setDate('');
                  },
                },
              );
            }}
          >
            <label htmlFor="trial-end" className="text-sm font-medium">
              {t('lock.extend')}
            </label>
            <p className="text-xs text-muted-foreground">{t('lock.extendHint')}</p>
            <div className="flex flex-wrap gap-2">
              <Input
                id="trial-end"
                type="date"
                min={todayBangkok()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-48"
                aria-label={t('lock.extendDate')}
              />
              <Button type="submit" disabled={!date || setTrialEnd.isPending}>
                {t('lock.extendBtn')}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
