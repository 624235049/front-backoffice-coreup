import { Send, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  checkDraft,
  type DraftIssue,
  type PageDetail,
  refusal,
  usePatchConversation,
  useSendMessage,
} from '../api';
import { timeLeft, useNow } from '../lib/time';

const FOLLOW_DAY = { 1: 1, 2: 3, 3: 6 } as const;

/** Wrong facts / script breaks found in the draft, red = wrong fact, amber = should fix. */
function Issues({ issues }: { issues: DraftIssue[] }) {
  const { t } = useTranslation('pageInbox');
  if (issues.length === 0) return null;
  return (
    <div
      role="alert"
      data-testid="draft-issues"
      className="grid gap-1 rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs"
    >
      <div className="flex items-center gap-1.5 font-semibold text-warning">
        <TriangleAlert className="size-3.5" aria-hidden />
        {t('composer.issuesTitle')}
      </div>
      <ul className="grid gap-0.5">
        {issues.map((i) => (
          <li key={i.code} className={i.severity === 'error' ? 'text-destructive' : 'text-foreground'}>
            <b>{t(i.severity === 'error' ? 'composer.issueError' : 'composer.issueWarn')}:</b> {i.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Bottom of the chat: the AI closer's suggestion and the due reminder (each one click to use or send), the draft with its live
 * facts check, and the send button that knows the window: free reply inside 24 h, "ส่งโดยเจ้าหน้าที่" (HUMAN_AGENT) up to 7 days,
 * nothing after. A draft with wrong facts asks for a confirmation first.
 */
export function Composer({ detail }: { detail: PageDetail }) {
  const { t } = useTranslation('pageInbox');
  const c = detail.conversation;
  const now = useNow();
  const send = useSendMessage();
  const patch = usePatchConversation();
  const [text, setText] = useState('');
  const [issues, setIssues] = useState<DraftIssue[]>([]);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ text: string; step?: 1 | 2 | 3; issues: DraftIssue[] } | null>(
    null,
  );

  // the draft is not carried to another chat
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the chat changes
  useEffect(() => {
    setText('');
    setProblem(null);
  }, [c.id]);

  // live facts check, once the typing pauses
  useEffect(() => {
    if (text.trim().length === 0) {
      setIssues([]);
      return;
    }
    setChecking(true);
    const h = setTimeout(() => {
      checkDraft(text, c.shopType)
        .then(setIssues)
        .catch(() => setIssues([]))
        .finally(() => setChecking(false));
    }, 450);
    return () => clearTimeout(h);
  }, [text, c.shopType]);

  const free = timeLeft(c.windowFreeEndsAt, now, t);
  const human = free ? null : timeLeft(c.windowHumanEndsAt, now, t);
  const state = free ? 'free' : human ? 'human' : 'closed';

  const run = (body: string, o: { step?: 1 | 2 | 3; confirmed?: boolean } = {}) => {
    setProblem(null);
    send.mutate(
      { id: c.id, text: body, confirmWrongFacts: o.confirmed, followUpStep: o.step },
      {
        onSuccess: () => {
          setText('');
          setConfirm(null);
          toast.success(t('composer.sent'));
        },
        onError: (e) => {
          const r = refusal(e);
          if (r.reason === 'wrong_facts') return setConfirm({ text: body, step: o.step, issues: r.issues });
          setConfirm(null);
          const known = r.reason && t(`errors.${r.reason}`, { defaultValue: '' });
          setProblem(
            [known || t('errors.generic'), r.reason === 'meta_rejected' ? r.message : null]
              .filter(Boolean)
              .join(' — '),
          );
        },
      },
    );
  };
  /** the check on the server is the safety net; a draft already flagged here asks first without a round trip */
  const submit = (body: string, step?: 1 | 2 | 3) => {
    const local = body === text ? issues.filter((i) => i.severity === 'error') : [];
    if (local.length > 0) return setConfirm({ text: body, step, issues: local });
    run(body, { step });
  };

  const sendLabel = state === 'human' ? t('composer.sendHuman') : t('composer.send');
  const blocked = state === 'closed';
  const suggestion = detail.suggestion;
  return (
    <div className="grid gap-2 border-t bg-[var(--card)] p-3">
      {c.followUpStep && detail.followUpDraft ? (
        <div
          className="grid gap-1.5 rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-sm"
          data-testid="follow-up-card"
        >
          <div className="font-semibold text-primary">
            {t('followUp.title', { day: FOLLOW_DAY[c.followUpStep as 1 | 2 | 3] })}
          </div>
          <p className="whitespace-pre-wrap">{detail.followUpDraft}</p>
          <p className="text-xs text-muted-foreground">
            {t(state === 'free' ? 'followUp.free' : 'followUp.human')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setText(detail.followUpDraft ?? '')}>
              {t('followUp.use')}
            </Button>
            <Button
              size="sm"
              disabled={blocked || send.isPending}
              onClick={() => submit(detail.followUpDraft ?? '', c.followUpStep as 1 | 2 | 3)}
              data-testid="follow-up-send"
            >
              <Send aria-hidden /> {t('followUp.send')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => patch.mutate({ id: c.id, body: { skipFollowUp: true } })}
            >
              {t('followUp.skip')}
            </Button>
          </div>
        </div>
      ) : null}

      {suggestion.text ? (
        <div
          className="grid gap-1.5 rounded-lg border bg-[var(--chat-ai)] p-2.5 text-sm text-[var(--chat-ai-fg)]"
          data-testid="suggestion-card"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Sparkles className="size-3.5" aria-hidden />
            {t('suggestion.title')} · {t(`suggestion.step.${suggestion.step}`)}
          </div>
          <p className="whitespace-pre-wrap">{suggestion.text}</p>
          {suggestion.needsPerson ? <p className="text-xs">{t('suggestion.needsPerson')}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setText(suggestion.text)}
              data-testid="use-suggestion"
            >
              {t('suggestion.use')}
            </Button>
            <Button
              size="sm"
              disabled={blocked || send.isPending}
              onClick={() => submit(suggestion.text)}
              data-testid="send-suggestion"
            >
              <Send aria-hidden /> {t('suggestion.sendNow')}
            </Button>
          </div>
        </div>
      ) : null}

      <Issues issues={issues} />
      {checking && issues.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('composer.checking')}</p>
      ) : null}
      {problem ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
          data-testid="send-error"
        >
          {problem}
        </p>
      ) : null}
      <p className={cn('text-xs', state === 'human' ? 'text-warning' : 'text-muted-foreground')}>
        {t(`window.${state}Hint`)}
      </p>
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('composer.placeholder')}
          aria-label={t('composer.placeholder')}
          disabled={blocked}
          rows={3}
          className="min-h-16 flex-1 resize-y"
          data-testid="composer-text"
        />
        <Button
          className="h-11 shrink-0"
          disabled={blocked || send.isPending || text.trim().length === 0}
          onClick={() => submit(text.trim())}
          data-testid="send-button"
        >
          <Send aria-hidden /> {send.isPending ? t('composer.sending') : sendLabel}
        </Button>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(o) => (o ? null : setConfirm(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('composer.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('composer.confirmBody')}</DialogDescription>
          </DialogHeader>
          <Issues issues={confirm?.issues ?? []} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {t('composer.edit')}
            </Button>
            <Button
              variant="destructive"
              disabled={send.isPending}
              onClick={() => confirm && run(confirm.text, { step: confirm.step, confirmed: true })}
              data-testid="confirm-wrong-send"
            >
              {t('composer.confirmSend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
