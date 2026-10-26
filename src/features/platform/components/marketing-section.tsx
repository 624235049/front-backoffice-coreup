import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type MarketingBody, type MarketingView, type Plan, usePlanPreview, usePlans } from '../api';
import { formatMoney, parseBahtToMinor, useIntlLocale } from '../format';
import { groupPlans } from '../plan-families';

export type Marketing = NonNullable<Plan['marketing']>;
type Copy = Marketing['th'];
type Lang = 'th' | 'en';
const LANGS: readonly Lang[] = ['th', 'en'];

const blankCopy = (): Copy => ({
  displayName: '',
  pitch: '',
  worth: '',
  highlights: [],
  moveUpWhen: '',
  badge: '',
  setupFee: '',
  footnotes: [],
});
export const blankMarketing = (sort: number): Marketing => ({
  sort,
  setupFeeMinor: 0,
  extraBranchMinor: 0,
  th: blankCopy(),
  en: blankCopy(),
});

/** What the API stores: trimmed texts, no empty list lines. */
export function cleanMarketing(m: Marketing): Marketing {
  const copy = (c: Copy): Copy => ({
    displayName: c.displayName.trim(),
    pitch: c.pitch.trim(),
    worth: c.worth.trim(),
    highlights: c.highlights.map((x) => x.trim()).filter(Boolean),
    moveUpWhen: c.moveUpWhen.trim(),
    badge: c.badge.trim(),
    setupFee: c.setupFee.trim(),
    footnotes: c.footnotes.map((x) => x.trim()).filter(Boolean),
  });
  return { ...m, th: copy(m.th), en: copy(m.en) };
}

/** True when the sales name of either language is empty (the API refuses it). */
export const marketingNameMissing = (m: Marketing): boolean =>
  LANGS.some((l) => m[l].displayName.trim().length === 0);

function ListEditor({
  label,
  items,
  onChange,
  max,
  testId,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  max: number;
  testId: string;
}) {
  const { t } = useTranslation('platform');
  const move = (i: number, by: -1 | 1) => {
    const next = [...items];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item as string);
    onChange(next);
  };
  return (
    <div className="grid gap-2" data-testid={testId}>
      <Label>{label}</Label>
      {items.map((text, i) => (
        // the list is edited in place and reordered: the position is the identity
        // biome-ignore lint/suspicious/noArrayIndexKey: lines have no id
        <div key={i} className="flex items-center gap-1">
          <Input
            value={text}
            maxLength={200}
            aria-label={`${label} ${i + 1}`}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={i === 0}
            aria-label={t('plans.marketing.up')}
            onClick={() => move(i, -1)}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={i === items.length - 1}
            aria-label={t('plans.marketing.down')}
            onClick={() => move(i, 1)}
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t('plans.marketing.remove')}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-fit"
        disabled={items.length >= max}
        onClick={() => onChange([...items, ''])}
      >
        <Plus /> {t('plans.marketing.add')}
      </Button>
    </div>
  );
}

function CopyFields({ lang, value, onChange }: { lang: Lang; value: Copy; onChange: (next: Copy) => void }) {
  const { t } = useTranslation('platform');
  const set = <K extends keyof Copy>(k: K, v: Copy[K]) => onChange({ ...value, [k]: v });
  const text = (k: 'displayName' | 'pitch' | 'worth' | 'moveUpWhen' | 'badge' | 'setupFee', max: number) => (
    <div>
      <Label htmlFor={`mk-${lang}-${k}`}>{t(`plans.marketing.field.${k}`)}</Label>
      <Input
        id={`mk-${lang}-${k}`}
        value={value[k]}
        maxLength={max}
        onChange={(e) => set(k, e.target.value)}
      />
      <p className="mt-1 text-xs text-muted-foreground">{t(`plans.marketing.hint.${k}`)}</p>
    </div>
  );
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {text('displayName', 40)}
        {text('badge', 30)}
      </div>
      {text('pitch', 160)}
      {text('worth', 160)}
      <ListEditor
        label={t('plans.marketing.field.highlights')}
        items={value.highlights}
        max={20}
        testId={`mk-${lang}-highlights`}
        onChange={(next) => set('highlights', next)}
      />
      {text('moveUpWhen', 160)}
      {text('setupFee', 240)}
      <ListEditor
        label={t('plans.marketing.field.footnotes')}
        items={value.footnotes}
        max={5}
        testId={`mk-${lang}-footnotes`}
        onChange={(next) => set('footnotes', next)}
      />
    </div>
  );
}

/** Baht typed by a person, committed as satang once it parses (partial typing like "4," is kept as text). */
export function MoneyField({
  id,
  label,
  hint,
  minor,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  minor: number;
  onChange: (minor: number) => void;
}) {
  const [text, setText] = useState(String(minor / 100));
  const bad = parseBahtToMinor(text) === null;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={text}
        aria-invalid={bad}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parseBahtToMinor(e.target.value);
          if (parsed !== null) onChange(parsed);
        }}
      />
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** The card as the shop app and the website show it (the API renders accounts / branches / per-day / fee from the plan). */
export function PlanPreviewCard({
  view,
  priceMinor,
  previous,
  lang,
}: {
  view: MarketingView[Lang];
  priceMinor: number;
  previous: string | undefined;
  lang: Lang;
}) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  return (
    <article
      className="relative flex max-w-sm flex-col rounded-2xl border bg-card p-5"
      data-testid="plan-preview"
    >
      {view.badge ? <Badge className="absolute -top-3 right-4 bg-emerald-600">{view.badge}</Badge> : null}
      <h3 className="text-lg font-bold">{view.displayName}</h3>
      <p className="mt-3 text-3xl font-bold tabular-nums">
        {formatMoney(priceMinor, locale)}
        <span className="text-sm font-normal text-muted-foreground">
          {' '}
          {t(`plans.marketing.preview.chrome.${lang}.perMonth`)}
        </span>
      </p>
      <p className="text-xs font-medium text-emerald-700">{view.perDay}</p>
      <div className="my-4 grid gap-3 border-t pt-4 text-sm">
        <p className="font-medium">{view.pitch}</p>
        <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
          <div>
            <dt className="text-xs text-muted-foreground">
              {t(`plans.marketing.preview.chrome.${lang}.accounts`)}
            </dt>
            <dd className="font-semibold">{view.accounts}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t(`plans.marketing.preview.chrome.${lang}.branches`)}
            </dt>
            <dd className="font-semibold">{view.branches}</dd>
          </div>
        </dl>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-emerald-700">
            {previous
              ? t(`plans.marketing.preview.chrome.${lang}.addedFrom`, { plan: previous })
              : t(`plans.marketing.preview.chrome.${lang}.base`)}
          </p>
          <ul className="grid gap-2">
            {view.highlights.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          {view.footnotes.map((n) => (
            <p key={n} className="mt-2 text-xs text-muted-foreground">
              {n}
            </p>
          ))}
        </div>
        {view.worth ? <p className="text-muted-foreground">{view.worth}</p> : null}
        {view.moveUpWhen ? (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-muted-foreground">
            {t(`plans.marketing.preview.chrome.${lang}.moveUp`, { when: view.moveUpWhen })}
          </p>
        ) : null}
        {view.setupFee ? <p className="text-xs text-muted-foreground">{view.setupFee}</p> : null}
      </div>
    </article>
  );
}

/** Debounced copy of a value: the preview asks the API once typing pauses. */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/**
 * "ข้อความขาย" of a monthly plan: Thai and English copy, the highlight list, order / fees, and a live preview card
 * rendered by the API from the plan's draft limits and price. The numbers (accounts, branches, per day) are not typed
 * here: they follow the limits above.
 */
export function MarketingSection({
  planCode,
  value,
  onChange,
  priceMinor,
  limits,
}: {
  planCode: string | null;
  value: Marketing | null;
  onChange: (next: Marketing | null) => void;
  /** the plan's monthly price as typed, null while it is not a valid amount */
  priceMinor: number | null;
  limits: Record<string, number>;
}) {
  const { t } = useTranslation('platform');
  const plans = usePlans();
  const [lang, setLang] = useState<Lang>('th');
  // the sold plan right before this one by order: its name opens "เพิ่มจาก …"
  const previous = useMemo(() => {
    if (!value) return undefined;
    const before = groupPlans(plans.data ?? [])
      .families.filter((f) => f.month?.code !== planCode && (f.month?.marketing?.sort ?? 0) < value.sort)
      .at(-1);
    return before?.month?.marketing;
  }, [plans.data, planCode, value]);

  const draft = useDebounced(value, 400);
  const body: MarketingBody | null =
    draft && priceMinor !== null && !marketingNameMissing(draft)
      ? { marketing: cleanMarketing(draft), limits, priceMinor }
      : null;
  const preview = usePlanPreview(body);

  if (!value) {
    return (
      <div className="grid gap-2 rounded-lg border border-dashed p-3" data-testid="marketing-empty">
        <p className="text-sm text-muted-foreground">{t('plans.marketing.none')}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-fit"
          onClick={() => onChange({ ...blankMarketing(100) })}
        >
          <Plus /> {t('plans.marketing.start')}
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-4" data-testid="marketing-section">
      <p className="text-xs text-muted-foreground">{t('plans.marketing.hint.numbers')}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="mk-sort">{t('plans.marketing.field.sort')}</Label>
          <Input
            id="mk-sort"
            inputMode="numeric"
            value={String(value.sort)}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/\D/g, ''));
              if (Number.isInteger(n) && n <= 999) onChange({ ...value, sort: n });
            }}
          />
          <p className="mt-1 text-xs text-muted-foreground">{t('plans.marketing.hint.sort')}</p>
        </div>
        <MoneyField
          id="mk-setup"
          label={t('plans.marketing.field.setupFeeMinor')}
          hint={t('plans.marketing.hint.setupFeeMinor')}
          minor={value.setupFeeMinor}
          onChange={(m) => onChange({ ...value, setupFeeMinor: m })}
        />
        <MoneyField
          id="mk-extra"
          label={t('plans.marketing.field.extraBranchMinor')}
          hint={t('plans.marketing.hint.extraBranchMinor')}
          minor={value.extraBranchMinor}
          onChange={(m) => onChange({ ...value, extraBranchMinor: m })}
        />
      </div>

      <Tabs value={lang} onValueChange={(v) => setLang(v as Lang)}>
        <TabsList>
          {LANGS.map((l) => (
            <TabsTrigger key={l} value={l}>
              {t(`plans.marketing.lang.${l}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {LANGS.map((l) => (
          <TabsContent key={l} value={l} forceMount hidden={lang !== l}>
            <CopyFields lang={l} value={value[l]} onChange={(next) => onChange({ ...value, [l]: next })} />
          </TabsContent>
        ))}
      </Tabs>

      <div className="grid gap-2">
        <Label>{t('plans.marketing.preview.title')}</Label>
        <p className="text-xs text-muted-foreground">{t('plans.marketing.preview.hint')}</p>
        {preview.data && priceMinor !== null ? (
          <PlanPreviewCard
            view={preview.data[lang]}
            priceMinor={priceMinor}
            previous={previous?.[lang].displayName}
            lang={lang}
          />
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            {t('plans.marketing.preview.blocked')}
          </p>
        )}
      </div>
    </div>
  );
}
