import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCan } from '@/lib/permissions';
import {
  type TemplateSection,
  type TenantDetail,
  useBusinessTypePreview,
  useSwitchBusinessType,
} from '../api';
import { INDUSTRY_KEYS } from './common';

type Section = TemplateSection;

/** "เพิ่ม 3 · มีอยู่แล้ว 1" for a list the template would add to. */
function useCounts() {
  const { t } = useTranslation('platform');
  return (l: { add: string[]; skip: string[] }) =>
    t('businessType.counts', { add: l.add.length, skip: l.skip.length });
}

/**
 * เปลี่ยนประเภทธุรกิจ: CoreUp team switches a shop's business type (any plan, booking-only shops included). Shows what the
 * new type's template would add before anything is written; applying only adds, never edits or deletes the shop's data.
 */
export function BusinessTypeCard({ d }: { d: TenantDetail }) {
  const { t } = useTranslation('platform');
  const canWrite = useCan('platform:write');
  const counts = useCounts();
  const [key, setKey] = useState<string | null>(null);
  const [picked, setPicked] = useState<Section[] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const preview = useBusinessTypePreview(d.id, key);
  const apply = useSwitchBusinessType(d.id);
  if (!canWrite) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('businessType.title')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          {t('businessType.current', {
            type: t(`industry.${d.industryKey}`, { defaultValue: d.industryKey }),
          })}
        </p>
        <Select
          value={key ?? undefined}
          onValueChange={(v) => {
            setKey(v);
            setPicked(null);
          }}
        >
          <SelectTrigger className="w-72" aria-label={t('businessType.pick')}>
            <SelectValue placeholder={t('businessType.pick')} />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRY_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                {t(`industry.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {key === null ? null : (
          <QueryState query={preview}>
            {(p) => {
              const rows: { section: Section; text: string }[] = [
                {
                  section: 'terminology',
                  text: t('businessType.words', {
                    count: p.terminology.filter((w) => w.current !== w.next).length,
                  }),
                },
                {
                  section: 'customerCode',
                  text:
                    p.customerCode.current === p.customerCode.next
                      ? t('businessType.same')
                      : `${p.customerCode.current} → ${p.customerCode.next}`,
                },
                { section: 'resources', text: counts(p.resources) },
                { section: 'positions', text: counts(p.positions) },
                { section: 'services', text: counts(p.services.services) },
                { section: 'products', text: counts(p.products.products) },
                { section: 'messages', text: counts(p.messages.templates) },
                {
                  section: 'settings',
                  text:
                    p.settings.calendarDefaultBy.current === p.settings.calendarDefaultBy.next &&
                    p.settings.useLabCost.current === p.settings.useLabCost.next
                      ? t('businessType.same')
                      : t('businessType.changes'),
                },
              ];
              const on = new Set(picked ?? rows.map((r) => r.section));
              return (
                <div className="grid gap-3">
                  <p className="text-sm">{t('businessType.preview', { type: p.name.th })}</p>
                  <ul className="grid gap-2">
                    {rows.map((r) => (
                      <li key={r.section}>
                        <label htmlFor={`bt-${r.section}`} className="flex min-h-9 items-start gap-2 text-sm">
                          <Checkbox
                            id={`bt-${r.section}`}
                            className="mt-0.5"
                            checked={on.has(r.section)}
                            onCheckedChange={(c) => {
                              const next = new Set(on);
                              if (c === true) next.add(r.section);
                              else next.delete(r.section);
                              setPicked([...next]);
                            }}
                          />
                          <span className="grid gap-0.5">
                            <span>{t(`businessType.section.${r.section}`)}</span>
                            <span className="text-xs text-muted-foreground">{r.text}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="justify-self-start"
                    disabled={apply.isPending}
                    blockedReason={key === d.industryKey && t('businessType.sameType')}
                    onClick={() => setConfirm(true)}
                  >
                    {t('businessType.apply')}
                  </Button>
                  <ConfirmDialog
                    open={confirm}
                    onOpenChange={setConfirm}
                    title={t('businessType.confirm', { type: p.name.th })}
                    description={t('businessType.confirmHint')}
                    pending={apply.isPending}
                    onConfirm={() =>
                      apply.mutate(
                        { industryKey: p.industryKey, sections: [...on] },
                        {
                          onSuccess: () => {
                            setConfirm(false);
                            setKey(null);
                            toast.success(t('businessType.done', { type: p.name.th }));
                          },
                        },
                      )
                    }
                  />
                </div>
              );
            }}
          </QueryState>
        )}
      </CardContent>
    </Card>
  );
}
