import * as Sentry from '@sentry/react';

/** Optional: only active when VITE_SENTRY_DSN is set (docs/04 §1). No PII, no session replay. */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE,
    // Back-office pages show customer data: never ship request bodies, headers, cookies or URLs' query strings.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: 0.1,
  });
}

export { Sentry };
