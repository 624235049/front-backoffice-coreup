import { Link, useParams } from '@tanstack/react-router';
import { ListChecks } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCan } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import {
  type EngagementTask,
  useEngagement,
  useEngagementTasks,
  useGenerateTasks,
  usePatchEngagement,
  usePatchTask,
} from '../api';
import { Stat } from '../components/common';
import { formatDate, formatMoney, useIntlLocale } from '../format';
import { EngagementStatusBadge } from './engagements-page';

const COLUMNS: EngagementTask['status'][] = ['todo', 'doing', 'done', 'skipped'];

/** Engagement detail: facts + the weekly task board generated from the playbook (docs/10 §6). */
export function EngagementDetailPage() {
  const { id } = useParams({ from: '/_app/platform/engagements/$id' });
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const engagement = useEngagement(id);
  const tasks = useEngagementTasks(id);
  const generate = useGenerateTasks();
  const patchEngagement = usePatchEngagement();
  const canWrite = useCan('platform:read');

  return (
    <QueryState query={engagement}>
      {({ data: e }) => (
        <>
          <PageHeader
            title={
              <span className="flex flex-wrap items-center gap-3">
                {t(`engagementType.${e.type}`)} <EngagementStatusBadge status={e.status} />
              </span>
            }
            description={
              <Link to="/platform/tenants/$id" params={{ id: e.tenantId }} className="hover:underline">
                {e.tenantName}
              </Link>
            }
            actions={
              canWrite && e.status === 'proposed' ? (
                <Button
                  onClick={() =>
                    patchEngagement.mutate(
                      { id: e.id, body: { status: 'active' } },
                      { onSuccess: () => toast.success(t('engagements.activated')) },
                    )
                  }
                  disabled={patchEngagement.isPending}
                >
                  {t('engagements.activate')}
                </Button>
              ) : canWrite && e.status === 'active' ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    patchEngagement.mutate(
                      { id: e.id, body: { status: 'completed' } },
                      { onSuccess: () => toast.success(t('engagements.completed')) },
                    )
                  }
                  disabled={patchEngagement.isPending}
                >
                  {t('engagements.complete')}
                </Button>
              ) : null
            }
          />
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label={t('engagements.col.period')}
              value={
                <span className="text-base">
                  {formatDate(e.startsOn, locale)} – {formatDate(e.endsOn, locale)}
                </span>
              }
            />
            <Stat
              label={t('engagements.col.consultant')}
              value={<span className="text-base">{e.leadConsultantName ?? '–'}</span>}
            />
            <Stat
              label={t('engagements.col.fee')}
              value={formatMoney(e.feeMinor, locale)}
              hint={e.billing === 'monthly' ? t('engagements.perMonth') : t('engagements.oneTime')}
            />
            <Stat
              label={t('engagements.col.progress')}
              value={e.tasksTotal === 0 ? '–' : `${e.tasksDone}/${e.tasksTotal}`}
            />
          </div>

          <h2 className="mb-3 text-lg font-semibold">{t('engagements.board')}</h2>
          <QueryState
            query={tasks}
            isEmpty={(rows) => rows.length === 0}
            empty={
              <EmptyState
                icon={ListChecks}
                title={t('engagements.noTasks')}
                description={t('engagements.noTasksHint')}
                action={
                  canWrite ? (
                    <Button
                      onClick={() =>
                        generate.mutate(e.id, { onSuccess: () => toast.success(t('engagements.generated')) })
                      }
                      disabled={generate.isPending}
                    >
                      {t('engagements.generate')}
                    </Button>
                  ) : undefined
                }
              />
            }
            skeleton={<div className="h-48 animate-pulse rounded-xl bg-muted" aria-busy="true" />}
          >
            {(rows) => <TaskBoard rows={rows} canWrite={canWrite} />}
          </QueryState>
        </>
      )}
    </QueryState>
  );
}

function TaskBoard({ rows, canWrite }: { rows: EngagementTask[]; canWrite: boolean }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const patch = usePatchTask();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<EngagementTask['status'] | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid gap-3 lg:grid-cols-4" data-testid="task-board">
      {COLUMNS.map((col) => {
        const cards = rows.filter((r) => r.status === col);
        return (
          <section
            key={col}
            aria-label={t(`taskStatus.${col}`)}
            className={cn(
              'flex min-h-32 flex-col gap-2 rounded-xl bg-muted/50 p-2',
              over === col && 'ring-2 ring-primary',
            )}
            onDragOver={(ev) => {
              ev.preventDefault();
              setOver(col);
            }}
            onDragLeave={() => setOver((o) => (o === col ? null : o))}
            onDrop={(ev) => {
              ev.preventDefault();
              setOver(null);
              const task = rows.find((r) => r.id === (dragId ?? ev.dataTransfer.getData('text/plain')));
              if (task && task.status !== col && canWrite)
                patch.mutate({ id: task.id, body: { status: col } });
              setDragId(null);
            }}
          >
            <h3 className="flex items-center justify-between px-1 text-sm font-semibold">
              {t(`taskStatus.${col}`)} <Badge variant="outline">{cards.length}</Badge>
            </h3>
            {cards.map((r) => {
              const late =
                r.dueOn !== null && r.dueOn < today && r.status !== 'done' && r.status !== 'skipped';
              return (
                <article
                  key={r.id}
                  draggable={canWrite}
                  onDragStart={(ev) => {
                    ev.dataTransfer.setData('text/plain', r.id);
                    setDragId(r.id);
                  }}
                  className="rounded-lg border bg-card p-3 text-sm shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{r.title}</span>
                    <Badge variant="outline" className="shrink-0">
                      {t('engagements.week', { n: r.week })}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{t(`taskOwner.${r.owner}`)}</span>
                    {r.dueOn ? (
                      <span className={late ? 'font-medium text-destructive' : undefined}>
                        {formatDate(r.dueOn, locale)}
                      </span>
                    ) : null}
                    {r.moduleToEnable ? (
                      <Badge variant="secondary">
                        {t('engagements.enables', {
                          module: t(`module.${r.moduleToEnable}`, { defaultValue: r.moduleToEnable }),
                        })}
                      </Badge>
                    ) : null}
                  </div>
                  {canWrite ? (
                    <Select
                      value={r.status}
                      onValueChange={(v) =>
                        patch.mutate({ id: r.id, body: { status: v as EngagementTask['status'] } })
                      }
                    >
                      <SelectTrigger className="mt-2 text-xs" aria-label={t('engagements.taskStatus')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLUMNS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {t(`taskStatus.${s}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
