import { Copy, Lightbulb, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type AdsChat,
  type AdsRecommendation,
  type AdsRecommendations,
  type AdsReportView,
  useAdsReport,
  useAdsReportRequest,
} from '../ads-api';
import { evidenceVars } from '../ads-format';
import { formatDate, formatDateTime } from '../format';

const TONE = { warn: 'warning', good: 'success', info: 'secondary' } as const;

function Recommendation({ rec, locale }: { rec: AdsRecommendation; locale: string }) {
  const { t } = useTranslation('ads');
  const vars = evidenceVars(rec.evidence, locale);
  return (
    <li className="grid gap-1.5 rounded-lg border p-3" data-testid={`rec-${rec.code}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={TONE[rec.severity]}>{t(`recs.severity.${rec.severity}`)}</Badge>
        <span className="font-medium">{t(`recs.${rec.code}.title`, vars)}</span>
        {rec.entityName && rec.entityLevel !== 'account' ? (
          <span className="break-words text-sm text-muted-foreground">· {rec.entityName}</span>
        ) : null}
      </div>
      <p className="text-sm">{t(`recs.${rec.code}.body`, vars)}</p>
      <dl
        className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
        aria-label={t('recs.evidence')}
      >
        {Object.entries(vars).map(([k, v]) => (
          <div key={k} className="flex gap-1">
            <dt>{t(`recs.ev.${k}`, { defaultValue: k })}</dt>
            <dd className="font-medium text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

function ChatToClose({ chat, locale }: { chat: AdsChat; locale: string }) {
  const { t } = useTranslation('ads');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(chat.closingMessage);
      toast.success(t('chats.copied'));
    } catch {
      toast.error(t('error'));
    }
  };
  return (
    <li className="grid gap-2 rounded-lg border p-3" data-testid="chat-to-close">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{chat.name ?? t('chats.noName')}</span>
        <Badge variant={chat.kind === 'unanswered' ? 'destructive' : 'warning'}>
          {t(`chats.${chat.kind}`, { hours: chat.hoursSince })}
        </Badge>
        {chat.shopType ? (
          <Badge variant="outline">{t(`shopType.${chat.shopType}`, { defaultValue: chat.shopType })}</Badge>
        ) : null}
        {chat.adId ? <Badge variant="secondary">{t('chats.fromAd')}</Badge> : null}
      </div>
      <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-2 font-sans text-sm">
        {chat.closingMessage}
      </pre>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {chat.freeUntil && new Date(chat.freeUntil).getTime() > Date.now()
            ? t('chats.freeUntil', { at: formatDateTime(chat.freeUntil, locale) })
            : t('chats.until', { at: formatDateTime(chat.humanUntil, locale) })}
        </span>
        <Button variant="outline" size="sm" onClick={() => void copy()}>
          <Copy /> {t('chats.copy')}
        </Button>
      </div>
    </li>
  );
}

/** Rule-engine suggestions with their evidence (suggestion only) and the chats that can still be won with a ready message. */
export function SuggestionsCard({ data, locale }: { data: AdsRecommendations; locale: string }) {
  const { t } = useTranslation('ads');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="size-4" aria-hidden />
          {t('recs.title')}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t('recs.suggestionOnly')}</p>
      </CardHeader>
      <CardContent className="grid gap-5">
        {data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('recs.empty')}</p>
        ) : (
          <ul className="grid gap-2">
            {data.items.map((r) => (
              <Recommendation key={`${r.code}-${r.entityId ?? 'x'}`} rec={r} locale={locale} />
            ))}
          </ul>
        )}
        {data.chats.length > 0 ? (
          <div className="grid gap-2">
            <div>
              <div className="text-sm font-medium">{t('chats.title')}</div>
              <p className="text-xs text-muted-foreground">{t('chats.hint')}</p>
            </div>
            <ul className="grid gap-2">
              {data.chats.map((c) => (
                <ChatToClose key={c.conversationId} chat={c} locale={locale} />
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** How long the card waits for a report it asked for (queue + 4 queries + a model call); the button stays off meanwhile. */
const REPORT_WAIT_MS = 2 * 60_000;

/**
 * The weekly Thai AI summary (cost-capped: at most 3 a week). After "create now" the card watches for a NEW report and keeps the
 * button off until it arrives (or 2 minutes pass), so a slow worker cannot be answered by a second click that spends the cap.
 */
export function ReportSection({ locale }: { locale: string }) {
  const request = useAdsReportRequest();
  const [waiting, setWaiting] = useState<{ since: string | null } | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const query = useAdsReport(true, waiting !== null);
  const latestId = query.data?.latest?.id ?? null;

  useEffect(() => {
    if (waiting && latestId !== waiting.since) setWaiting(null);
  }, [waiting, latestId]);
  useEffect(() => {
    if (!waiting) return;
    const id = setTimeout(() => {
      setWaiting(null);
      setTimedOut(true);
    }, REPORT_WAIT_MS);
    return () => clearTimeout(id);
  }, [waiting]);

  return (
    <QueryState query={query}>
      {(view) => (
        <ReportCard
          view={view}
          locale={locale}
          busy={waiting !== null || request.isPending}
          timedOut={timedOut}
          onRequest={() => {
            setTimedOut(false);
            request.mutate(undefined, { onSuccess: () => setWaiting({ since: latestId }) });
          }}
        />
      )}
    </QueryState>
  );
}

function ReportCard({
  view,
  locale,
  busy,
  timedOut,
  onRequest,
}: {
  view: AdsReportView;
  locale: string;
  busy: boolean;
  timedOut: boolean;
  onRequest: () => void;
}) {
  const { t } = useTranslation('ads');
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" aria-hidden />
            {t('report.title')}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t('report.hint')}</p>
        </div>
        <Button variant="outline" size="sm" disabled={!view.canGenerate || busy} onClick={onRequest}>
          {busy ? t('report.generating') : t('report.generate')}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-2">
        {view.latest ? (
          <>
            <div className="text-xs text-muted-foreground">
              {t('report.week', { date: formatDate(view.latest.weekStart, locale) })} ·{' '}
              {formatDateTime(view.latest.createdAt, locale)}
            </div>
            <p className="whitespace-pre-wrap break-words text-sm" data-testid="ads-report-body">
              {view.latest.body}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t('report.empty')}</p>
        )}
        {!view.canGenerate ? (
          <p className="text-xs text-muted-foreground">{t('report.capped', { n: view.generatedThisWeek })}</p>
        ) : timedOut ? (
          <p className="text-xs text-muted-foreground" data-testid="ads-report-timeout">
            {t('report.timedOut')}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
