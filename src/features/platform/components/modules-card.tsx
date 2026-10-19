import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useCan } from '@/lib/permissions';
import { type TenantDetail, useSetModules } from '../api';
import { MODULE_GROUPS, MODULE_MENUS } from '../module-menus';
import type { SHOP_MODULES } from '../plans';

type ShopModule = Exclude<(typeof SHOP_MODULES)[number], 'core'>;

/** Module switches grouped like the pricing page; each one lists the exact shop menus it turns on. */
export function ModulesCard({ d }: { d: TenantDetail }) {
  const { t } = useTranslation('platform');
  const canWrite = useCan('platform:write');
  const setModules = useSetModules(d.id);
  const sources = new Map(d.modules.map((m) => [m.key, m]));

  const toggle = (key: string, on: boolean) => {
    const next = new Set(sources.keys());
    if (on) next.add(key);
    else next.delete(key);
    setModules.mutate({
      modules: [...next]
        .filter((k) => k !== 'core')
        .map((k) => ({
          key: k as ShopModule,
          source: sources.get(k)?.source ?? 'consultant',
          enabledUntil: sources.get(k)?.enabledUntil ?? null,
        })),
    });
  };

  const row = (k: ShopModule, name: string, hint: string) => (
    <label key={k} htmlFor={`module-${k}`} className="flex min-h-11 items-start gap-2 text-sm">
      <Checkbox
        id={`module-${k}`}
        className="mt-0.5"
        checked={sources.has(k)}
        disabled={!canWrite || setModules.isPending}
        onCheckedChange={(on) => toggle(k, on === true)}
        aria-label={name}
      />
      <span className="grid gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          {name}
          {sources.has(k) ? (
            <Badge variant="outline">{t(`moduleSource.${sources.get(k)?.source ?? 'plan'}`)}</Badge>
          ) : null}
        </span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('detail.modules')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {canWrite ? null : <p className="text-sm text-muted-foreground">{t('detail.readOnlyHint')}</p>}
        {MODULE_GROUPS.map((g) => (
          <section key={g.key} className="grid gap-2">
            <h3 className="text-sm font-semibold">{t(`detail.moduleGroup.${g.key}`)}</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.modules.map((k) =>
                row(
                  k,
                  t(`module.${k}`),
                  MODULE_MENUS[k].length > 0
                    ? t('detail.moduleMenus', { list: MODULE_MENUS[k].join(' · ') })
                    : t('detail.moduleNoMenu'),
                ),
              )}
            </div>
          </section>
        ))}
        <section className="border-t pt-4">
          {row('lite', t('detail.liteTitle'), t('detail.liteHint'))}
        </section>
      </CardContent>
    </Card>
  );
}
