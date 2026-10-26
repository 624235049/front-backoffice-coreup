import { Bot, ChevronDown, RotateCcw, Send } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AiTestBody, AiTestResult } from '../ai-chat-api';

const MAX_TURNS = 12;
const PRESETS = [
  { key: 'price', text: 'ราคาบริการเท่าไหร่คะ' },
  { key: 'free', text: 'พรุ่งนี้ว่างไหมคะ' },
  { key: 'discount', text: 'ขอส่วนลดได้ไหมคะ' },
  { key: 'unknown', text: 'ร้านมีบริการตัดต่อวิดีโอไหมคะ' },
  { key: 'admin', text: 'ขอคุยกับแอดมินค่ะ' },
  { key: 'book', text: 'จองให้หน่อยนะคะ พรุ่งนี้บ่ายสอง' },
] as const;

type Turn = { id: string; role: 'user' | 'assistant'; text: string; result?: AiTestResult };

const baht = (minor: number) =>
  `฿${(minor / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * "ลองคุยกับ AI": a chat box with LINE-style bubbles. Every AI answer carries what the AI looked up ("ข้อมูลที่ AI ใช้ตอบ"),
 * so a wrong answer can be traced to its data. Nothing here reaches a customer or the quota.
 * `knowledge` = the extra-knowledge text on screen (sent as an unsaved override when it differs from the saved one).
 */
export function AiTestChat({
  send,
  knowledge,
  savedKnowledge,
}: {
  send: (body: AiTestBody) => Promise<AiTestResult>;
  knowledge: string;
  savedKnowledge: string;
}) {
  const { t } = useTranslation('platform');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const tryingUnsaved = knowledge !== savedKnowledge;

  async function ask(text: string) {
    const said = text.trim();
    if (!said || busy) return;
    const next: Turn[] = [...turns, { id: crypto.randomUUID(), role: 'user', text: said }];
    setTurns(next);
    setDraft('');
    setBusy(true);
    try {
      const messages = next.slice(-MAX_TURNS).map((m) => ({ role: m.role, text: m.text }));
      const r = await send({ messages, ...(tryingUnsaved ? { knowledgeOverride: knowledge } : {}) });
      setLeft(r.remainingToday);
      setTurns([...next, { id: crypto.randomUUID(), role: 'assistant', text: r.reply, result: r }]);
    } catch {
      // the mutation already told the user why; give the text back
      setTurns(turns);
      setDraft(said);
    } finally {
      setBusy(false);
      queueMicrotask(() => end.current?.scrollIntoView({ block: 'nearest' }));
    }
  }

  return (
    <Card data-testid="ai-test-chat">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="size-5 text-primary" aria-hidden /> {t('aiChat.test.title')}
        </CardTitle>
        <CardDescription>{t('aiChat.test.hint')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap gap-2" data-testid="ai-test-presets">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={busy}
              onClick={() => void ask(p.text)}
            >
              {t(`aiChat.test.presets.${p.key}`)}
            </Button>
          ))}
        </div>

        {tryingUnsaved ? (
          <Badge variant="warning" className="w-fit" data-testid="ai-test-unsaved">
            {t('aiChat.test.usingUnsaved')}
          </Badge>
        ) : null}

        <div
          className="grid max-h-[55vh] min-h-40 content-start gap-3 overflow-y-auto rounded-lg bg-muted p-3"
          aria-live="polite"
        >
          {turns.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('aiChat.test.empty')}</p>
          ) : null}
          {turns.map((m) => (
            <Bubble key={m.id} turn={m} />
          ))}
          {busy ? <p className="text-sm text-muted-foreground">{t('aiChat.test.thinking')}</p> : null}
          <div ref={end} />
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(draft);
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('aiChat.test.placeholder')}
            maxLength={1000}
            className="h-11"
            aria-label={t('aiChat.test.placeholder')}
            disabled={busy}
          />
          <Button
            type="submit"
            className="h-11 shrink-0"
            disabled={busy || !draft.trim()}
            aria-label={t('aiChat.test.send')}
          >
            <Send aria-hidden />
          </Button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{left === null ? t('aiChat.test.limitHint') : t('aiChat.test.left', { n: left })}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9"
            disabled={turns.length === 0 || busy}
            onClick={() => setTurns([])}
          >
            <RotateCcw aria-hidden /> {t('aiChat.test.reset')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Bubble({ turn }: { turn: Turn }) {
  const { t } = useTranslation('platform');
  const r = turn.result;
  if (turn.role === 'user')
    return (
      <div className="flex justify-end" data-testid="ai-test-user">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-[#06c755] px-3 py-2 text-sm text-white">
          {turn.text}
        </p>
      </div>
    );
  return (
    <div className="grid max-w-[92%] gap-1.5" data-testid="ai-test-ai">
      {r?.noReply ? (
        <p className="text-xs italic text-muted-foreground">{t('aiChat.test.noReply')}</p>
      ) : (
        <p
          className={cn(
            'w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm border bg-card px-3 py-2 text-sm',
          )}
        >
          {turn.text}
        </p>
      )}
      {r?.handoff ? (
        <Badge variant="warning" className="w-fit" data-testid="ai-test-handoff">
          {t('aiChat.test.handoff')}
        </Badge>
      ) : null}
      {r?.blocked ? (
        <p className="text-xs text-warning">{t('aiChat.test.blocked', { why: r.blocked })}</p>
      ) : null}
      {r ? <Evidence result={r} /> : null}
    </div>
  );
}

/** "ข้อมูลที่ AI ใช้ตอบ": the tools it called, what it asked and what came back, plus tokens and cost. */
function Evidence({ result }: { result: AiTestResult }) {
  const { t } = useTranslation('platform');
  const tokens = result.usage.input + result.usage.output + result.usage.cacheRead;
  return (
    <details className="group rounded-lg border bg-card/60 text-xs" data-testid="ai-test-evidence">
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 px-2.5 py-1.5 font-medium">
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
        {t('aiChat.test.evidence')}
      </summary>
      <div className="grid gap-2 border-t px-2.5 py-2">
        {result.toolCalls.length === 0 ? (
          <p className="text-muted-foreground">{t('aiChat.test.noLookup')}</p>
        ) : (
          result.toolCalls.map((c) => (
            <div key={`${c.name}${JSON.stringify(c.input)}`} className="grid gap-1">
              <div className="font-medium">{t(`aiChat.test.tools.${c.name}`, { defaultValue: c.name })}</div>
              {Object.keys(c.input).length > 0 ? (
                <code className="break-all text-muted-foreground">{JSON.stringify(c.input)}</code>
              ) : null}
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-[11px]">
                {c.resultSummary}
              </pre>
            </div>
          ))
        )}
        <p className="text-muted-foreground">
          {t('aiChat.test.cost', {
            tokens: tokens.toLocaleString('th-TH'),
            cost: result.costMinor === null ? '-' : baht(result.costMinor),
          })}
        </p>
      </div>
    </details>
  );
}
