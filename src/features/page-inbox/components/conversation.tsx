import { ArrowLeft, Flame, HandHelping, PanelRight } from 'lucide-react';
import { Fragment, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  PAGE_STAGES,
  type PageMessage,
  type PageStage,
  SHOP_TYPES,
  usePageConversation,
  usePatchConversation,
} from '../api';
import { useChatTime } from '../lib/time';
import { Composer } from './composer';
import { SidePanel } from './side-panel';
import { WindowBadge } from './window-badge';

function Bubble({ m }: { m: PageMessage }) {
  const { t } = useTranslation('pageInbox');
  const clock = useChatTime(t);
  const mine = m.direction === 'out';
  const label =
    m.sender === 'staff'
      ? `${t('conversation.staff')}${m.authorName ? ` · ${m.authorName}` : ''}`
      : m.sender === 'ai'
        ? t('conversation.ai')
        : m.sender === 'page'
          ? t('conversation.page')
          : null;
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div className="grid max-w-[82%] gap-0.5">
        {label ? (
          <span className={cn('text-[0.7rem] text-muted-foreground', mine && 'text-right')}>{label}</span>
        ) : null}
        <div
          data-testid={`msg-${m.sender}`}
          className={cn(
            'whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm',
            !mine && 'rounded-tl-sm bg-[var(--chat-in)] text-[var(--chat-in-fg)]',
            m.sender === 'staff' && 'rounded-tr-sm bg-[var(--chat-staff)] text-[var(--chat-staff-fg)]',
            m.sender === 'ai' && 'rounded-tr-sm bg-[var(--chat-ai)] text-[var(--chat-ai-fg)]',
            m.sender === 'page' && 'rounded-tr-sm bg-[var(--chat-page)] text-[var(--chat-page-fg)]',
          )}
        >
          {m.imageUrl ? (
            <a href={m.imageUrl} target="_blank" rel="noreferrer" className="mb-1 block underline">
              {t('conversation.image')}
            </a>
          ) : null}
          {m.text}
        </div>
        <span className={cn('text-[0.65rem] text-muted-foreground', mine && 'text-right')}>
          {clock.time(m.sentAt)}
          {m.via === 'human_agent' ? ` · ${t('conversation.humanAgent')}` : ''}
        </span>
      </div>
    </div>
  );
}

const selectCls =
  'h-8 rounded-md border bg-background px-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Middle column: the chat (both sides, grouped by day), its header controls and the composer. The third column is the customer panel. */
export function Conversation({
  id,
  onBack,
  panelOpen,
  onPanel,
}: {
  id: string;
  onBack: () => void;
  panelOpen: boolean;
  onPanel: () => void;
}) {
  const { t } = useTranslation('pageInbox');
  const q = usePageConversation(id);
  const patch = usePatchConversation();
  const clock = useChatTime(t);
  const end = useRef<HTMLDivElement>(null);
  const last = q.data?.messages.at(-1)?.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when a new message arrives or another chat opens
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [last, id]);

  if (q.isPending)
    return (
      <div className="grid gap-3 p-4" aria-busy="true">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="ml-auto h-16 w-2/3" />
      </div>
    );
  if (q.isError)
    return (
      <div className="grid flex-1 place-items-center p-6 text-center text-sm text-destructive" role="alert">
        <div className="grid gap-2">
          {t('conversation.loadError')}
          <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
            ↻
          </Button>
        </div>
      </div>
    );
  const d = q.data;
  const c = d.conversation;
  const name = c.name ?? t('row.noName', { channel: t(`channel.${c.channel}`) });
  let prevDay = '';
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b bg-[var(--card)] px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={onBack}
          aria-label={t('conversation.back')}
        >
          <ArrowLeft aria-hidden />
        </Button>
        <div className="min-w-[10rem] flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold" data-testid="conv-name">
              {name}
            </span>
            {c.hot ? (
              <Flame className="size-4 shrink-0 text-warning" aria-label={t('conversation.hot')} />
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">{t(`channel.${c.channel}`)}</div>
        </div>
        <WindowBadge conversation={c} />
        <select
          className={selectCls}
          aria-label={t('side.stage')}
          value={c.stage}
          onChange={(e) => patch.mutate({ id, body: { stage: e.target.value as PageStage } })}
        >
          {PAGE_STAGES.map((s) => (
            <option key={s} value={s}>
              {t(`stage.${s}`)}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          aria-label={t('side.type')}
          value={c.shopType ?? ''}
          onChange={(e) => patch.mutate({ id, body: { shopType: (e.target.value || null) as never } })}
        >
          <option value="">{t('shopType.unknown')}</option>
          {SHOP_TYPES.map((s) => (
            <option key={s} value={s}>
              {t(`shopType.${s}`)}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant={c.aiPaused ? 'outline' : 'secondary'}
          size="sm"
          onClick={() => patch.mutate({ id, body: { aiPaused: !c.aiPaused } })}
        >
          <HandHelping aria-hidden /> {c.aiPaused ? t('conversation.handBack') : t('conversation.takeover')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onPanel}
          aria-label={t('side.title')}
          aria-pressed={panelOpen}
        >
          <PanelRight aria-hidden />
        </Button>
      </div>
      {c.aiPaused ? (
        <p className="bg-muted px-3 py-1 text-xs text-muted-foreground">{t('conversation.aiPaused')}</p>
      ) : null}
      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
            data-testid="message-list"
          >
            {d.messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('conversation.empty')}</p>
            ) : (
              <div className="grid gap-2">
                {d.messages.map((m) => {
                  const day = clock.dayKey(m.sentAt);
                  const sep = day !== prevDay;
                  prevDay = day;
                  return (
                    <Fragment key={m.id}>
                      {sep ? (
                        <div className="my-1 text-center">
                          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[0.7rem] text-muted-foreground">
                            {clock.dayLabel(m.sentAt)}
                          </span>
                        </div>
                      ) : null}
                      <Bubble m={m} />
                    </Fragment>
                  );
                })}
                <div ref={end} />
              </div>
            )}
          </div>
          <Composer detail={d} />
        </div>
        {panelOpen ? <SidePanel conversation={c} /> : null}
      </div>
    </>
  );
}
