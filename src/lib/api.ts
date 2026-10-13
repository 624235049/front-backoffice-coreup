import { useSession } from '@/stores/session';
import { createApiClient, type paths } from './api-client';

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:18787').replace(/\/$/, '');

/* ------------------------------------------------------------------ */
/* Types derived from the API's OpenAPI document (no backend imports). */
/* ------------------------------------------------------------------ */

type JsonBody<R> = R extends { content: { 'application/json': infer B } } ? B : never;

/** Success body of an operation: `ApiData<'/v1/me'>`, `ApiData<'/v1/branches', 'post'>`. */
export type ApiData<
  P extends keyof paths,
  M extends keyof paths[P] = 'get' & keyof paths[P],
> = paths[P][M] extends {
  responses: infer R;
}
  ? JsonBody<R[200 & keyof R] | R[201 & keyof R]>
  : never;

/** Request body of an operation: `ApiBody<'/v1/branches', 'post'>`. */
export type ApiBody<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  requestBody?: infer B;
}
  ? NonNullable<B> extends { content: { 'application/json': infer J } }
    ? J
    : never
  : never;

/** The `data` of a `{ data: T }` single-item response (API convention: single = `{ data }`, list = `{ data, page }`). */
export type ApiItem<P extends keyof paths, M extends keyof paths[P] = 'get' & keyof paths[P]> =
  ApiData<P, M> extends { data: infer D } ? D : never;

/** Element of a `{ data: T[] }` list response. */
export type ListItem<T> = T extends { data: readonly (infer U)[] } ? U : never;

/* ---------------------------------------------------------------- */
/* Errors                                                            */
/* ---------------------------------------------------------------- */

/** Typed API error thrown by `unwrap()` (docs/02 §1.4). `code` = API error code, or NETWORK / UNKNOWN. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.requestId = init.requestId;
  }

  is(code: string): boolean {
    return this.code === code;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** Build an ApiError from an HTTP status and a (maybe) `{ error: { code, message, details, requestId } }` body. */
export function toApiError(status: number, body: unknown): ApiError {
  const err =
    typeof body === 'object' && body !== null && 'error' in body
      ? (body as { error: Record<string, unknown> }).error
      : null;
  if (err && typeof err.code === 'string') {
    return new ApiError({
      status,
      code: err.code,
      message: typeof err.message === 'string' ? err.message : err.code,
      details: err.details,
      requestId: typeof err.requestId === 'string' ? err.requestId : undefined,
    });
  }
  return new ApiError({ status, code: 'UNKNOWN', message: `HTTP ${status}` });
}

/* ---------------------------------------------------------------- */
/* Client                                                            */
/* ---------------------------------------------------------------- */

/** One key per user intent. Reuse the same key when retrying the same mutation (docs/02 §1.2). */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** Spread into an `api.POST(...)` options object: `api.POST('/v1/x', { body, ...idempotent(key) })`. */
export function idempotent(key: string = newIdempotencyKey()) {
  return { headers: { 'Idempotency-Key': key } };
}

export const api = createApiClient({ baseUrl: API_URL, credentials: 'include' });

api.use({
  onRequest({ request }) {
    const { tenantId, branchId, locale } = useSession.getState();
    if (tenantId && !request.headers.has('X-Tenant-Id')) request.headers.set('X-Tenant-Id', tenantId);
    if (branchId && !request.headers.has('X-Branch-Id')) request.headers.set('X-Branch-Id', branchId);
    if (!request.headers.has('Accept-Language')) request.headers.set('Accept-Language', locale);
    // Default key per POST; mutations that must be retry-safe pass their own via `idempotent(key)`.
    if (request.method === 'POST' && !request.headers.has('Idempotency-Key')) {
      request.headers.set('Idempotency-Key', newIdempotencyKey());
    }
    return request;
  },
});

type FetchResult<T> = { data?: T; error?: unknown; response: Response };

/**
 * Resolve an openapi-fetch call to its data, or throw `ApiError`.
 * `const me = await unwrap(api.GET('/v1/me'))`
 */
export async function unwrap<T>(call: Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>;
  try {
    result = await call;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError({
      status: 0,
      code: 'NETWORK',
      message: e instanceof Error ? e.message : 'Network error',
    });
  }
  if (result.error !== undefined || !result.response.ok) {
    throw toApiError(result.response.status, result.error);
  }
  return result.data as T;
}

/** `unwrap` for `{ data: T }` responses: resolves to `T`. */
export async function unwrapData<T extends { data: unknown }>(
  call: Promise<FetchResult<T>>,
): Promise<T['data']> {
  return (await unwrap(call)).data;
}
