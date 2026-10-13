import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/api';
import { useErrorMessage } from '@/lib/query';

/** Error with a retry button and the request id (support can find the log line) — docs/04 §9. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation('common');
  const message = useErrorMessage();
  const requestId = isApiError(error) ? error.requestId : undefined;
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center"
    >
      <AlertTriangle className="size-8 text-destructive" aria-hidden />
      <div className="font-medium">{message(error)}</div>
      {requestId ? (
        <div className="text-xs text-muted-foreground">
          {t('requestId')}: <code>{requestId}</code>
        </div>
      ) : null}
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          {t('retry')}
        </Button>
      ) : null}
    </div>
  );
}
