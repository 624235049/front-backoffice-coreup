import { WifiOff } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

function subscribe(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** docs/04 §7: show an "offline" strip; only checklist ticks may be queued offline, everything else needs a connection. */
export function OfflineBanner() {
  const { t } = useTranslation('common');
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-navy-800 px-4 py-1.5 text-sm text-white"
    >
      <WifiOff className="size-4" aria-hidden />
      {t('offline')}
    </div>
  );
}
