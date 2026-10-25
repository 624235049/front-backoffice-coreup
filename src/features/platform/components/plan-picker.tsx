import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { FAMILIES } from '../plan-families';
import {
  BRANCH_CHOICES,
  type Branches,
  type PickAnswers,
  recommendPlan,
  STAFF_CHOICES,
  type Staff,
} from '../plan-picker';

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'min-h-9 rounded-full border px-3 text-left text-sm',
        on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

/** 3 questions → a package; `onPick` gets the monthly plan code (sales can still change the dropdown afterwards). */
export function PlanPicker({ onPick }: { onPick: (monthlyCode: string) => void }) {
  const { t } = useTranslation('platform');
  const [a, setA] = useState<Partial<PickAnswers>>({});
  const done = a.branches !== undefined && a.big !== undefined && a.staff !== undefined;
  const family = done ? FAMILIES.find((f) => f.key === recommendPlan(a as PickAnswers)) : undefined;
  const code = family?.code;
  // the parent may pass a new function each render: only a new answer should preselect
  const pick = useRef(onPick);
  pick.current = onPick;
  useEffect(() => {
    if (code) pick.current(code);
  }, [code]);
  return (
    <details className="rounded-lg border bg-muted/30 p-3" data-testid="plan-picker">
      <summary className="cursor-pointer text-sm font-medium">{t('planPicker.title')}</summary>
      <div className="mt-3 grid gap-3">
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-sm font-medium">{t('planPicker.q1')}</legend>
          <div className="flex flex-wrap gap-2">
            {BRANCH_CHOICES.map((v: Branches) => (
              <Choice key={v} on={a.branches === v} onClick={() => setA((s) => ({ ...s, branches: v }))}>
                {t(`planPicker.branches.${v}`)}
              </Choice>
            ))}
          </div>
        </fieldset>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-sm font-medium">{t('planPicker.q2')}</legend>
          <div className="flex flex-wrap gap-2">
            {[false, true].map((v) => (
              <Choice key={String(v)} on={a.big === v} onClick={() => setA((s) => ({ ...s, big: v }))}>
                {t(v ? 'planPicker.big.yes' : 'planPicker.big.no')}
              </Choice>
            ))}
          </div>
        </fieldset>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-sm font-medium">{t('planPicker.q3')}</legend>
          <div className="flex flex-wrap gap-2">
            {STAFF_CHOICES.map((v: Staff) => (
              <Choice key={v} on={a.staff === v} onClick={() => setA((s) => ({ ...s, staff: v }))}>
                {t(`planPicker.staff.${v}`)}
              </Choice>
            ))}
          </div>
        </fieldset>
        {family ? (
          <p className="text-sm font-medium text-emerald-700" role="status" data-testid="plan-picker-result">
            {t('planPicker.result', { plan: family.name })}
          </p>
        ) : null}
      </div>
    </details>
  );
}
