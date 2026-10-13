import createClient, { type ClientOptions } from 'openapi-fetch';
import type { paths } from './openapi';

export type { components, operations, paths } from './openapi';

export type ApiClientOptions = {
  /** API origin, e.g. `http://localhost:18787` (paths already include the `/v1` prefix). */
  baseUrl: string;
  fetch?: ClientOptions['fetch'];
  /** Default headers sent with every request (e.g. `X-Tenant-Id`). */
  headers?: ClientOptions['headers'];
  /** Cookie handling for browser calls (`include` for the back office). Defaults to the platform default. */
  credentials?: 'omit' | 'same-origin' | 'include';
};

/** Typed client over the generated OpenAPI `paths` (generate with `pnpm --filter @coreup/api-client generate`). */
export function createApiClient(options: ApiClientOptions) {
  const { baseUrl, ...rest } = options;
  return createClient<paths>({ baseUrl: baseUrl.replace(/\/$/, ''), ...rest });
}

export type ApiClient = ReturnType<typeof createApiClient>;
