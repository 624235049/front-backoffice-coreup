import { AlertTriangle, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/api';
import { useErrorMessage } from '@/lib/query';

/** Error with a retry button and the request id (support can find the log line) — docs/04 §9. */
/** Client errors that a retry cannot fix: show what to do instead of a useless "try again". */
const HINTS: Record<string, string> = {
  MODULE_DISABLED: 'errorHint.moduleDisabled',
  FORBIDDEN: 'errorHint.forbidden',
  PERMISSION_DENIED: 'errorHint.forbidden',
  NOT_FOUND: 'errorHint.notFound',
};

/** Error with a retry button and the request id (support can find the log line) — docs/04 §9. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation('common');
  const message = useErrorMessage();
  const requestId = isApiError(error) ? error.requestId : undefined;
  const hintKey = isApiError(error)
    ? (HINTS[error.code] ??
      (error.status === 403 ? HINTS.FORBIDDEN : error.status === 404 ? HINTS.NOT_FOUND : undefined))
    : undefined;
  const final = hintKey !== undefined;
  const Icon = final ? Info : AlertTriangle;
  return (
    <div
      role="alert"
      className={
        final
          ? 'flex flex-col items-center gap-3 rounded-xl border bg-muted/40 px-6 py-10 text-center'
          : 'flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center'
      }
    >
      <Icon className={final ? 'size-8 text-muted-foreground' : 'size-8 text-destructive'} aria-hidden />
      <div className="font-medium">{message(error)}</div>
      {hintKey ? <div className="max-w-md text-sm text-muted-foreground">{t(hintKey)}</div> : null}
      {requestId ? (
        <div className="text-xs text-muted-foreground">
          {t('requestId')}: <code>{requestId}</code>
        </div>
      ) : null}
      {onRetry && !final ? (
        <Button variant="outline" onClick={onRetry}>
          {t('retry')}
        </Button>
      ) : null}
    </div>
  );
}
