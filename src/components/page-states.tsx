import { type ErrorComponentProps, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/error-state';
import { Button } from '@/components/ui/button';

export function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="mx-auto max-w-xl p-6">
      <ErrorState error={error} onRetry={reset} />
    </div>
  );
}

export function RouteNotFound() {
  const { t } = useTranslation('common');
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3 p-10 text-center">
      <div className="font-display text-5xl font-semibold text-navy-900">404</div>
      <p className="text-muted-foreground">{t('notFound')}</p>
      <Button asChild>
        <Link to="/">{t('goHome')}</Link>
      </Button>
    </div>
  );
}

export function RoutePending() {
  const { t } = useTranslation('common');
  return (
    <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground" aria-busy="true">
      {t('loading')}
    </div>
  );
}
