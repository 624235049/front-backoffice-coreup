/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** API origin, e.g. http://localhost:18787 (no trailing slash, no /v1). */
  readonly VITE_API_URL?: string;
  /** Shop back office origin used in hand-over messages to shop staff (default https://coreup.biz). */
  readonly VITE_SHOP_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_APP_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
