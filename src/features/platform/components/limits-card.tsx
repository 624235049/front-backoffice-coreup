import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCan } from '@/lib/permissions';
import { type TenantLimit, useSetTenantLimit, useTenantLimits } from '../api';
import { useIntlLocale } from '../format';

/** The API stores "unlimited for this shop" as -1; `null` removes the custom value (package value applies). */
export const UNLIMITED_OVERRIDE = -1;

/** What the row would send: `undefined` = the typed text is not a whole number ≥ 0. */
export function limitValue(draft: string, unlimited: boolean): number | null | undefined {
  if (unlimited) return UNLIMITED_OVERRIDE;
  const text = draft.trim();
  if (text === '') return null;
  return /^\d+$/.test(text) ? Number(text) : undefined;
}

/** Per-shop quotas that differ from the package (e.g. an Enterprise shop with 15 branches). */
export function LimitsCard({ id }: { id: string }) {
  const { t } = useTranslation('platform');
  const limits = useTenantLimits(id);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('limits.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('limits.hint')}</p>
      </CardHeader>
      <CardContent>
        <QueryState query={limits}>
          {(rows) => (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('limits.col.name')}</TableHead>
                  <TableHead>{t('limits.col.plan')}</TableHead>
                  <TableHead>{t('limits.col.used')}</TableHead>
                  <TableHead>{t('limits.col.custom')}</TableHead>
                  <TableHead>{t('limits.col.effective')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  // remount after a save so the inputs show the stored value
                  <LimitRow key={`${r.key}:${r.override}`} tenantId={id} row={r} />
                ))}
              </TableBody>
            </Table>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function LimitRow({ tenantId, row }: { tenantId: string; row: TenantLimit }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const canWrite = useCan('platform:write');
  const save = useSetTenantLimit(tenantId);
  const [unlimited, setUnlimited] = useState(row.override === UNLIMITED_OVERRIDE);
  const [draft, setDraft] = useState(
    row.override === null || row.override === UNLIMITED_OVERRIDE ? '' : String(row.override),
  );
  const value = limitValue(draft, unlimited);
  const name = t(`plans.limit.${row.key}`, { defaultValue: row.key });
  const show = (n: number | null) => (n === null ? t('plans.offer.unlimited') : n.toLocaleString(locale));

  return (
    <TableRow>
      <TableCell className="font-medium">{name}</TableCell>
      <TableCell>{show(row.plan)}</TableCell>
      <TableCell>{row.used === null ? '–' : row.used.toLocaleString(locale)}</TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            inputMode="numeric"
            className="w-28"
            value={draft}
            disabled={!canWrite || unlimited}
            placeholder={t('limits.usePlan')}
            aria-label={t('limits.custom', { name })}
            onChange={(e) => setDraft(e.target.value)}
          />
          <label htmlFor={`limit-${row.key}-unlimited`} className="flex min-h-11 items-center gap-2 text-sm">
            <Checkbox
              id={`limit-${row.key}-unlimited`}
              checked={unlimited}
              disabled={!canWrite}
              onCheckedChange={(on) => setUnlimited(on === true)}
            />
            {t('plans.offer.unlimited')}
          </label>
        </div>
      </TableCell>
      <TableCell className="font-medium">{show(row.effective)}</TableCell>
      <TableCell>
        {canWrite ? (
          <Button
            variant="outline"
            size="sm"
            disabled={save.isPending}
            blockedReason={
              (value === undefined && t('limits.invalid')) ||
              (value === row.override && t('limits.unchanged'))
            }
            onClick={() =>
              value !== undefined &&
              save.mutate(
                { key: row.key, value },
                { onSuccess: () => toast.success(t('limits.saved', { name })) },
              )
            }
          >
            {t('limits.save')}
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
