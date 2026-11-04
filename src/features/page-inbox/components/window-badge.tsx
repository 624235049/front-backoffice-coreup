import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { PageConversation } from '../api';
import { timeLeft, useNow } from '../lib/time';

/**
 * "Reply-by" countdown of a chat: green = free reply (24 h), amber = only a person may send (24 h–7 days), grey = closed.
 * Computed from the customer's last message on the server; the minute counts down here without a reload.
 */
export function WindowBadge({
  conversation,
  className,
}: {
  conversation: Pick<PageConversation, 'lastCustomerMessageAt' | 'windowFreeEndsAt' | 'windowHumanEndsAt'>;
  className?: string;
}) {
  const { t } = useTranslation('pageInbox');
  const now = useNow();
  const free = timeLeft(conversation.windowFreeEndsAt, now, t);
  const human = free ? null : timeLeft(conversation.windowHumanEndsAt, now, t);
  const state = free ? 'free' : human ? 'human' : 'closed';
  const text =
    state === 'free'
      ? t('window.free', { time: free })
      : state === 'human'
        ? t('window.human', { time: human })
        : t('window.closed');
  return (
    <span
      data-testid={`window-${state}`}
      title={t(`window.${state}Hint`)}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-medium',
        state === 'free' && 'bg-success/15 text-success',
        state === 'human' && 'bg-warning/15 text-warning',
        state === 'closed' && 'bg-muted text-muted-foreground',
        className,
      )}
    >
      <Clock className="size-3" aria-hidden />
      {text}
    </span>
  );
}
