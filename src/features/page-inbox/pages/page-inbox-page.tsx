import { useNavigate, useSearch } from '@tanstack/react-router';
import { MessagesSquare, Settings } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounced } from '@/features/accounting/lib/use-debounced';
import { useCan } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import '../chat.css';
import { type PageQuery, type PageStatus, useConnectPage, usePageList, usePageStatus } from '../api';
import { Conversation } from '../components/conversation';
import { SettingsSheet } from '../components/settings-sheet';
import { ThreadList } from '../components/thread-list';

/** The Page is not connected yet: say what the inbox is and let the owner connect it (one press, idempotent). */
function Setup({ status }: { status: PageStatus }) {
  const { t } = useTranslation('pageInbox');
  const canManage = useCan('platform:manage');
  const connect = useConnectPage();
  return (
    <div className="mx-auto grid max-w-[1280px] gap-3">
      <PageHeader title={t('title')} description={t('description')} />
      <EmptyState
        icon={MessagesSquare}
        title={t('setup.title')}
        description={t('setup.body')}
        action={
          <div className="grid justify-items-center gap-2">
            {!status.tokenConfigured ? (
              <p className="text-sm text-warning">{t('setup.tokenMissing')}</p>
            ) : null}
            {!status.webhookConfigured ? (
              <p className="text-sm text-warning">{t('setup.webhookMissing')}</p>
            ) : null}
            {canManage ? (
              <Button
                type="button"
                disabled={!status.tokenConfigured || connect.isPending}
                onClick={() => connect.mutate(undefined)}
                data-testid="connect-page"
              >
                {connect.isPending ? t('setup.connecting') : t('setup.connect')}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">{t('setup.ownerOnly')}</p>
            )}
          </div>
        }
      />
    </div>
  );
}

/**
 * แชทลูกค้าจากเพจ: an app-like view that fills the screen under the header. Wide: the list (340px) | the conversation | the customer
 * panel. Phone: the list, and tapping a chat shows the conversation alone with a back button (the open chat is `c` in the address).
 */
function Inbox({ status }: { status: PageStatus }) {
  const { t } = useTranslation('pageInbox');
  const navigate = useNavigate();
  const { c: open } = useSearch({ from: '/_app/platform/page-inbox' });
  const [query, setQuery] = useState<PageQuery>({ filter: 'all' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1280,
  );
  const q = useDebounced(query.q ?? '', 350);
  const list = usePageList({ ...query, q: q || undefined });
  const openChat = (id: string | null) =>
    void navigate({ to: '/platform/page-inbox', search: id ? { c: id } : {} });
  return (
    <div
      className={cn(
        'chat-root -mx-4 -mb-24 -mt-6 grid overflow-hidden border-y bg-background lg:-mx-8 lg:-mb-8 lg:grid-cols-[340px_minmax(0,1fr)]',
        'h-[calc(100dvh-4rem-3.5rem-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-4rem)]',
      )}
    >
      <div className={cn('flex min-h-0 flex-col border-r', open && 'max-lg:hidden')}>
        <ThreadList
          data={list.data}
          loading={list.isPending}
          error={list.isError}
          query={query}
          onQuery={setQuery}
          activeId={open ?? null}
          onOpen={openChat}
          actions={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground"
              aria-label={t('settings.gear')}
              onClick={() => setSettingsOpen(true)}
              data-testid="open-settings"
            >
              <Settings aria-hidden />
            </Button>
          }
        />
      </div>
      <div className={cn('flex min-h-0 min-w-0 flex-col bg-[var(--chat-bg)]', !open && 'max-lg:hidden')}>
        {open ? (
          <Conversation
            id={open}
            onBack={() => openChat(null)}
            panelOpen={panelOpen}
            onPanel={() => setPanelOpen((v) => !v)}
          />
        ) : (
          <div className="grid flex-1 place-items-center p-6 text-sm text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <MessagesSquare className="size-10 opacity-40" aria-hidden />
              {t('conversation.pick')}
            </div>
          </div>
        )}
      </div>
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} status={status} />
    </div>
  );
}

export function PageInboxPage() {
  const status = usePageStatus();
  return (
    <QueryState query={status} skeleton={<Skeleton className="h-64 w-full" />}>
      {(s) => (s.settings.pageId ? <Inbox status={s} /> : <Setup status={s} />)}
    </QueryState>
  );
}
