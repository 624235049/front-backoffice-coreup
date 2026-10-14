import { REPLAY_SAFE_OPERATIONS } from './api-client/replay-safe.gen';

/**
 * `fetch` wrapper that hides transient infrastructure failures (proxy 502/503/504 or a dropped connection
 * while the api restarts or a pooled socket was closed) from users.
 *
 * Only requests that are safe to replay are retried:
 *  - GET / HEAD, and
 *  - a mutation that carries an `Idempotency-Key` AND targets an operation the api deduplicates by that key
 *    (OpenAPI `x-replay-safe`, generated into `REPLAY_SAFE_OPERATIONS` by `pnpm gen:api`; docs/02 §1.2).
 *    A key on any other route (public/auth/webhook endpoints) is ignored by the api, so replaying it could
 *    repeat the change.
 * Everything else is sent exactly once. 4xx and 500 are never retried: they are answers from the application,
 * not transport failures.
 *
 * Retry layering: this layer owns retries of 502/503/504 and network errors for ALL safe requests, queries
 * included. React Query therefore must not retry those again (see `query-client.ts`), otherwise one failing
 * GET would be attempted 3 x 3 times. Total attempts here: 1 + RETRY_DELAYS_MS.length = 3.
 */

/** Backoff before retry #1 and #2. Short on purpose: Caddy already retries dial failures for up to 20s. */
export const RETRY_DELAYS_MS = [300, 900] as const;

const TRANSIENT_STATUS: readonly number[] = [502, 503, 504];

type FetchImpl = (input: Request) => Promise<Response>;

export type ResilientFetchOptions = {
  /** Underlying fetch; defaults to the global one (looked up per call). */
  fetch?: FetchImpl;
  /** Delay before each retry; its length is the retry count. */
  delaysMs?: readonly number[];
  /** `METHOD /v1/path/{param}` templates of mutations that a key makes replay-safe; defaults to the generated set. */
  replaySafeOperations?: readonly string[];
};

/** Compiles `POST /v1/bills/{id}/pay` into a matcher per method; `{param}` matches exactly one path segment. */
function compileOperations(operations: readonly string[]): Record<string, RegExp[]> {
  const byMethod: Record<string, RegExp[]> = {};
  for (const operation of operations) {
    const [method = '', template = ''] = operation.split(' ');
    const pattern = template
      .split('/')
      .map((segment) => (segment.startsWith('{') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('/');
    byMethod[method] = [...(byMethod[method] ?? []), new RegExp(`^${pattern}$`)];
  }
  return byMethod;
}

const DEFAULT_REPLAY_SAFE = compileOperations(REPLAY_SAFE_OPERATIONS);

function isReplaySafe(request: Request, replaySafe: Record<string, RegExp[]>): boolean {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') return true;
  if (!request.headers.has('Idempotency-Key')) return false;
  const { pathname } = new URL(request.url);
  return replaySafe[method]?.some((re) => re.test(pathname)) ?? false;
}

/** Resolves `true` after `ms`, or `false` right away if `signal` aborts first. */
function sleep(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function createResilientFetch(options: ResilientFetchOptions = {}): typeof fetch {
  const send: FetchImpl = options.fetch ?? ((request) => globalThis.fetch(request));
  const delaysMs = options.delaysMs ?? RETRY_DELAYS_MS;
  const replaySafe = options.replaySafeOperations
    ? compileOperations(options.replaySafeOperations)
    : DEFAULT_REPLAY_SAFE;

  return async (input, init) => {
    const request = new Request(input, init);
    if (!isReplaySafe(request, replaySafe)) return send(request);

    for (let attempt = 0; ; attempt++) {
      const retriesLeft = attempt < delaysMs.length;
      // Clone before sending: a Request body can only be consumed once and the next attempt needs it again.
      const attemptRequest = retriesLeft ? request.clone() : request;
      let response: Response;
      try {
        response = await send(attemptRequest);
      } catch (error) {
        // `fetch` rejects with TypeError for network failures; aborts (DOMException) and others pass through.
        if (!(error instanceof TypeError) || !retriesLeft || request.signal.aborted) throw error;
        if (!(await sleep(delaysMs[attempt] ?? 0, request.signal))) throw error;
        continue;
      }
      if (!TRANSIENT_STATUS.includes(response.status) || !retriesLeft || request.signal.aborted)
        return response;
      await response.body?.cancel().catch(() => {});
      if (!(await sleep(delaysMs[attempt] ?? 0, request.signal))) return response;
    }
  };
}
