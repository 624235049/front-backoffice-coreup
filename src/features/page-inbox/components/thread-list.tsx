import { Flame, Inbox, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  PAGE_STAGES,
  type PageConversation,
  type PageFilter,
  type PageList,
  type PageQuery,
  type PageStage,
  SHOP_TYPES,
} from '../api';
import { useChatTime, useNow } from '../lib/time';
import { WindowBadge } from './window-badge';

const TABS: PageFilter[] = ['all', 'needs_reply', 'hot', 'follow_up'];
const FOLLOW_DAY = { 1: 1, 2: 3, 3: 6 } as const;

export const stageTone: Record<PageStage, string> = {
  new: 'bg-primary/10 text-primary',
  talking: 'bg-muted text-foreground',
  sample_sent: 'bg-warning/15 text-warning',
  trial: 'bg-success/15 text-success',
  paid: 'bg-success text-success-foreground',
  lost: 'bg-muted text-muted-foreground',
};

export function StageChip({ stage }: { stage: PageStage }) {
  const { t } = useTranslation('pageInbox');
  return (
    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-medium', stageTone[stage])}>
      {t(`stage.${stage}`)}
    </span>
  );
}

function Row({ c, active, onOpen }: { c: PageConversation; active: boolean; onOpen: () => void }) {
  const { t } = useTranslation('pageInbox');
  const clock = useChatTime(t);
  const now = useNow();
  const name = c.name ?? t('row.noName', { channel: t(`channel.${c.channel}`) });
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? 'true' : undefined}
        data-testid="page-row"
        className={cn(
          'flex w-full items-start gap-3 px-3 py-2.5 text-left text-foreground transition-colors hover:bg-[var(--chat-hover)]',
          active && 'bg-[var(--chat-selected)] hover:bg-[var(--chat-selected)]',
        )}
      >
        <span className="relative mt-0.5 shrink-0">
          <Avatar className="size-11">
            <AvatarFallback className="bg-muted text-base text-muted-foreground">
              {name.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          {c.needsReply ? (
            <span
              className="absolute -right-0.5 -top-0.5 size-3.5 rounded-full border-2 border-[var(--background)] bg-warning"
              role="img"
              aria-label={t('row.needsReply')}
              data-testid="needs-dot"
            />
          ) : null}
        </span>
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-[0.95rem]',
                c.needsReply ? 'font-bold' : 'font-semibold',
              )}
            >
              {name}
            </span>
            {c.hot ? (
              <Flame className="size-4 shrink-0 self-center text-warning" aria-label={t('row.hot')} />
            ) : null}
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {c.lastMessageAt ? clock.listTime(c.lastMessageAt, now) : ''}
            </span>
          </span>
          <span className="truncate text-sm text-muted-foreground">{c.preview ?? ''}</span>
          <span className="flex flex-wrap items-center gap-1.5">
            <StageChip stage={c.stage} />
            <WindowBadge conversation={c} />
            {c.followUpStep ? (
              <span
                className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-medium text-primary"
                data-testid="follow-chip"
              >
                {t('row.followUp', { day: FOLLOW_DAY[c.followUpStep as 1 | 2 | 3] })}
              </span>
            ) : null}
            {c.shopType ? (
              <span className="text-[0.7rem] text-muted-foreground">{t(`shopType.${c.shopType}`)}</span>
            ) : null}
            {c.aiPaused ? (
              <span className="text-[0.7rem] text-muted-foreground">{t('row.paused')}</span>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}

const selectCls =
  'h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Left column: the tabs (all · needs reply · hot · follow up today) with their counts, stage chips, the ad / shop type filters, the
 * search box and the chats. `actions` sits at the end of the search row (the settings button).
 */
export function ThreadList({
  data,
  loading,
  error,
  query,
  onQuery,
  activeId,
  onOpen,
  actions,
}: {
  data: PageList | undefined;
  loading: boolean;
  error: boolean;
  query: PageQuery;
  onQuery: (q: PageQuery) => void;
  activeId: string | null;
  onOpen: (id: string) => void;
  actions?: ReactNode;
}) {
  const { t } = useTranslation('pageInbox');
  const filter = query.filter ?? 'all';
  const count = (f: PageFilter) =>
    data
      ? {
          all: data.counts.all,
          needs_reply: data.counts.needsReply,
          hot: data.counts.hot,
          follow_up: data.counts.followUp,
        }[f]
      : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--background)]">
      <div className="px-2 pb-1 pt-2">
        <div
          role="tablist"
          aria-label={t('title')}
          className="grid grid-cols-4 gap-0.5 rounded-lg bg-muted p-0.5"
        >
          {TABS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => onQuery({ ...query, filter: f })}
              className={cn(
                'flex min-h-10 min-w-0 flex-col items-center justify-center whitespace-nowrap rounded-md px-0.5 text-center text-[0.7rem] font-medium leading-tight',
                filter === f
                  ? 'bg-[var(--card)] text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span>{t(`tabs.${f}`)}</span>
              {f !== 'all' && (count(f) ?? 0) > 0 ? (
                <span
                  className="mt-0.5 rounded-full bg-warning px-1.5 text-[0.65rem] font-semibold tabular-nums text-warning-foreground"
                  data-testid={`count-${f}`}
                >
                  {count(f)}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
      <fieldset className="m-0 flex min-w-0 gap-1 overflow-x-auto border-0 px-2 pb-1">
        <legend className="sr-only">{t('filters.stage')}</legend>
        {[undefined, ...PAGE_STAGES].map((s) => (
          <button
            key={s ?? 'all'}
            type="button"
            aria-pressed={query.stage === s}
            onClick={() => onQuery({ ...query, stage: s })}
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-1 text-xs',
              query.stage === s
                ? 'border-primary bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {s ? t(`stage.${s}`) : t('filters.allStages')}
          </button>
        ))}
      </fieldset>
      <div className="flex gap-1.5 px-2 pb-1">
        <select
          className={selectCls}
          aria-label={t('filters.adLabel')}
          value={query.adId ?? ''}
          onChange={(e) => onQuery({ ...query, adId: e.target.value || undefined })}
        >
          <option value="">{t('filters.allAds')}</option>
          {(data?.ads ?? []).map((a) => (
            <option key={a.adId} value={a.adId}>
              {t('filters.ad', { id: a.adId, count: a.count })}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          aria-label={t('filters.typeLabel')}
          value={query.shopType ?? ''}
          onChange={(e) =>
            onQuery({ ...query, shopType: (e.target.value || undefined) as PageQuery['shopType'] })
          }
        >
          <option value="">{t('filters.allTypes')}</option>
          {SHOP_TYPES.map((s) => (
            <option key={s} value={s}>
              {t(`shopType.${s}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1.5 px-2 pb-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={query.q ?? ''}
            onChange={(e) => onQuery({ ...query, q: e.target.value || undefined })}
            placeholder={t('filters.search')}
            aria-label={t('filters.search')}
            type="search"
            className="h-10 w-full rounded-full border-0 bg-muted pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {actions}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="grid gap-2 p-3" aria-busy="true">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-sm text-destructive">{t('list.error')}</div>
        ) : data && data.items.length > 0 ? (
          <ul data-testid="page-list" className="divide-y divide-border/60">
            {data.items.map((c) => (
              <Row key={c.id} c={c} active={c.id === activeId} onOpen={() => onOpen(c.id)} />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
            <Inbox className="size-8" aria-hidden />
            <div className="font-medium text-foreground">{t('list.empty')}</div>
            {filter === 'all' && !query.stage && !query.q ? <p>{t('list.emptyAll')}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
