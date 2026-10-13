import { Link, useParams } from '@tanstack/react-router';
import { FileDown, Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  type AuditDetail,
  useAddFinding,
  useAudit,
  useDeleteFinding,
  useRequestReport,
  useRubric,
  useSaveActionPlan,
  useSaveScores,
} from '../api';
import { AuditStatusBadge } from './audits-page';

const DIMENSIONS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'] as const;
const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

/** docs/04 §5.8 audit wizard as tabs: rubric → findings → 90-day plan → report (PDF). */
export function AuditDetailPage() {
  const { id } = useParams({ from: '/_app/platform/audits/$id' });
  const { t } = useTranslation('platform');
  const audit = useAudit(id);
  return (
    <QueryState query={audit}>
      {({ data: a }) => (
        <>
          <PageHeader
            title={
              <span className="flex flex-wrap items-center gap-3">
                {a.tenantName} <AuditStatusBadge status={a.status} />
              </span>
            }
            description={
              <Link to="/platform/audits" className="hover:underline">
                {t('audits.back')}
              </Link>
            }
          />
          <Tabs defaultValue="rubric">
            <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
              {(['rubric', 'findings', 'plan', 'report'] as const).map((k) => (
                <TabsTrigger key={k} value={k}>
                  {t(`auditTabs.${k}`)}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="rubric">
              <RubricTab audit={a} />
            </TabsContent>
            <TabsContent value="findings">
              <FindingsTab audit={a} />
            </TabsContent>
            <TabsContent value="plan">
              <PlanTab audit={a} />
            </TabsContent>
            <TabsContent value="report">
              <ReportTab audit={a} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </QueryState>
  );
}

function ScoreBar({ value }: { value: number | null }) {
  return (
    <div className="flex items-center gap-2" aria-hidden={value === null}>
      <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${value ?? 0}%` }} />
      </div>
      <span className="w-8 text-sm font-semibold">{value === null ? '–' : value.toFixed(0)}</span>
    </div>
  );
}

function RubricTab({ audit }: { audit: AuditDetail }) {
  const { t, i18n } = useTranslation('platform');
  const rubric = useRubric();
  const save = useSaveScores(audit.id);
  const lng = i18n.language === 'en' ? 'en' : 'th';
  const saved = useMemo(() => new Map(audit.rubric.map((r) => [r.criterionKey, r])), [audit.rubric]);
  const [draft, setDraft] = useState<Record<string, { score: number; evidence: string }>>({});
  useEffect(() => {
    setDraft(
      Object.fromEntries(
        audit.rubric.map((r) => [r.criterionKey, { score: r.score, evidence: r.evidence ?? '' }]),
      ),
    );
  }, [audit.rubric]);
  const dirty = Object.entries(draft).filter(([k, v]) => {
    const s = saved.get(k);
    return v.score >= 1 && (!s || s.score !== v.score || (s.evidence ?? '') !== v.evidence);
  });

  return (
    <QueryState query={rubric}>
      {({ data: def }) => (
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('audits.overall')}:{' '}
                {audit.summary.overall === null ? '–' : audit.summary.overall.toFixed(0)} / 100
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {def.dimensions.map((d) => (
                <div key={d.key} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <strong>{d.key}</strong> {d.title[lng]}
                  </span>
                  <ScoreBar value={audit.summary.byDimension[d.key] ?? null} />
                </div>
              ))}
            </CardContent>
          </Card>
          {def.dimensions.map((d) => (
            <Card key={d.key}>
              <CardHeader>
                <CardTitle className="text-base">
                  {d.key} · {d.title[lng]}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5">
                {def.criteria
                  .filter((c) => c.dimension === d.key)
                  .map((c) => {
                    const cur = draft[c.key];
                    return (
                      <fieldset key={c.key} className="grid gap-2">
                        <legend className="text-sm font-medium">{c.title[lng]}</legend>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="max-w-48 text-xs text-muted-foreground">1 = {c.low[lng]}</span>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <label
                              key={n}
                              className={cn(
                                'flex size-11 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold',
                                cur?.score === n
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'hover:bg-accent',
                              )}
                            >
                              <input
                                type="radio"
                                className="sr-only"
                                name={`score-${c.key}`}
                                value={n}
                                checked={cur?.score === n}
                                onChange={() =>
                                  setDraft((p) => ({
                                    ...p,
                                    [c.key]: { score: n, evidence: p[c.key]?.evidence ?? '' },
                                  }))
                                }
                              />
                              {n}
                            </label>
                          ))}
                          <span className="max-w-48 text-xs text-muted-foreground">5 = {c.high[lng]}</span>
                        </div>
                        <Input
                          value={cur?.evidence ?? ''}
                          placeholder={t('audits.evidence')}
                          aria-label={`${c.title[lng]} – ${t('audits.evidence')}`}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              [c.key]: { score: p[c.key]?.score ?? 0, evidence: e.target.value },
                            }))
                          }
                        />
                      </fieldset>
                    );
                  })}
              </CardContent>
            </Card>
          ))}
          <div className="sticky bottom-20 flex justify-end lg:bottom-4">
            <Button
              disabled={dirty.length === 0 || save.isPending}
              onClick={() =>
                save.mutate({
                  scores: dirty.map(([criterionKey, v]) => ({
                    criterionKey,
                    score: v.score,
                    evidence: v.evidence || undefined,
                  })),
                })
              }
            >
              {t('audits.saveScores', { count: dirty.length })}
            </Button>
          </div>
        </div>
      )}
    </QueryState>
  );
}

function FindingsTab({ audit }: { audit: AuditDetail }) {
  const { t } = useTranslation('platform');
  const add = useAddFinding(audit.id);
  const del = useDeleteFinding(audit.id);
  const [dimension, setDimension] = useState<(typeof DIMENSIONS)[number]>('D1');
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('medium');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [rootCause, setRootCause] = useState('');
  const tone = { low: 'secondary', medium: 'warning', high: 'destructive', critical: 'destructive' } as const;
  return (
    <div className="grid gap-4">
      <form
        className="grid gap-3 rounded-lg border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate(
            {
              dimension,
              severity,
              title: title.trim(),
              body: body.trim() || undefined,
              rootCause: rootCause.trim() || undefined,
            },
            {
              onSuccess: () => {
                setTitle('');
                setBody('');
                setRootCause('');
              },
            },
          );
        }}
      >
        <h3 className="font-medium">{t('audits.addFinding')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t('audits.dimension')}</Label>
            <Select value={dimension} onValueChange={(v) => setDimension(v as typeof dimension)}>
              <SelectTrigger aria-label={t('audits.dimension')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIMENSIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d} · {t(`dimension.${d}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('audits.severity')}</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
              <SelectTrigger aria-label={t('audits.severity')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`severity.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="f-title">{t('audits.findingTitle')}</Label>
          <Input id="f-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </div>
        <div>
          <Label htmlFor="f-body">{t('audits.findingBody')}</Label>
          <Textarea id="f-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="f-root">{t('audits.rootCause')}</Label>
          <Input id="f-root" value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
        </div>
        <Button
          type="submit"
          className="justify-self-start"
          disabled={title.trim().length === 0 || add.isPending}
        >
          <Plus /> {t('audits.addFinding')}
        </Button>
      </form>
      {audit.findingList.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('audits.noFindings')}</p>
      ) : (
        <ul className="grid gap-2">
          {audit.findingList.map((f) => (
            <li key={f.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={tone[f.severity]}>{t(`severity.${f.severity}`)}</Badge>
                    <span className="font-medium">{f.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {f.dimension} · {t(`dimension.${f.dimension}`)}
                    </span>
                  </div>
                  {f.body ? <p className="mt-1 text-sm">{f.body}</p> : null}
                  {f.rootCause ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('audits.rootCause')}: {f.rootCause}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => del.mutate(f.id)}
                  disabled={del.isPending}
                  aria-label={t('audits.deleteFinding')}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type PlanItem = AuditDetail['actionPlan'][number];

function PlanTab({ audit }: { audit: AuditDetail }) {
  const { t } = useTranslation('platform');
  const save = useSaveActionPlan(audit.id);
  const [items, setItems] = useState<PlanItem[]>(audit.actionPlan);
  useEffect(() => setItems(audit.actionPlan), [audit.actionPlan]);
  const update = (i: number, patch: Partial<PlanItem>) =>
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const valid = items.every((i) => i.title.trim().length > 0);
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{t('audits.planHint')}</p>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">{t('audits.noPlan')}</p> : null}
      {items.map((it, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional until saved
        <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_6rem_9rem_9rem_auto]">
          <Input
            value={it.title}
            onChange={(e) => update(i, { title: e.target.value })}
            placeholder={t('audits.planTitle')}
            aria-label={t('audits.planTitle')}
            maxLength={200}
          />
          <Input
            type="number"
            min={0}
            max={13}
            value={it.week}
            onChange={(e) => update(i, { week: Number(e.target.value) })}
            aria-label={t('audits.planWeek')}
          />
          <Select
            value={it.dimension ?? '__none__'}
            onValueChange={(v) =>
              update(i, { dimension: v === '__none__' ? undefined : (v as (typeof DIMENSIONS)[number]) })
            }
          >
            <SelectTrigger aria-label={t('audits.dimension')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">–</SelectItem>
              {DIMENSIONS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={it.owner} onValueChange={(v) => update(i, { owner: v as PlanItem['owner'] })}>
            <SelectTrigger aria-label={t('audits.planOwner')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="consultant">{t('taskOwner.consultant')}</SelectItem>
              <SelectItem value="tenant">{t('taskOwner.tenant')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}
            aria-label={t('audits.removeItem')}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setItems((p) => [...p, { title: '', week: 1, owner: 'consultant' }])}
        >
          <Plus /> {t('audits.addItem')}
        </Button>
        <Button
          disabled={!valid || save.isPending}
          onClick={() => save.mutate({ items: items.map((i) => ({ ...i, title: i.title.trim() })) })}
        >
          {t('audits.savePlan')}
        </Button>
      </div>
    </div>
  );
}

function ReportTab({ audit }: { audit: AuditDetail }) {
  const { t } = useTranslation('platform');
  const request = useRequestReport(audit.id);
  const status = audit.report.status;
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('audits.reportTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p className="text-muted-foreground">{t('audits.reportHint')}</p>
          <ul className="grid gap-1">
            <li>
              {t('audits.overall')}:{' '}
              <strong>{audit.summary.overall === null ? '–' : audit.summary.overall.toFixed(0)}</strong>
            </li>
            <li>
              {t('audits.col.scored')}: {audit.scored}
            </li>
            <li>
              {t('audits.col.findings')}: {audit.findings}
            </li>
            <li>{t('audits.planItems', { count: audit.actionPlan.length })}</li>
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => request.mutate(undefined)}
              disabled={request.isPending || status === 'queued'}
            >
              {status === 'queued' ? <Loader2 className="animate-spin" /> : <FileDown />}
              {status === 'queued' ? t('audits.generating') : t('audits.generate')}
            </Button>
            {status === 'ready' && audit.report.url ? (
              <Button asChild variant="outline">
                <a href={audit.report.url} target="_blank" rel="noopener noreferrer">
                  <FileDown /> {t('audits.openPdf')}
                </a>
              </Button>
            ) : null}
          </div>
          {status === 'ready' ? (
            <p role="status" className="text-success">
              {t('audits.reportReadyHint')}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
