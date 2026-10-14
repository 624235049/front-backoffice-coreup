import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isApiError } from '@/lib/api';

const PUBLIC_PREFIXES = ['/sign-in', '/forgot-password', '/reset-password', '/invite'];

/**
 * `onUnauthenticated` runs when a request comes back 401 while inside the app (session expired): the router
 * sends the user to /sign-in. Public pages and the `['me']` probe (the route guard handles it) are exempt.
 */
export function createQueryClient(onUnauthenticated: () => void): QueryClient {
  const handle = (error: unknown, isMe = false) => {
    // platform_* accounts must switch on 2FA before using the back office (docs/02 §2.1)
    if (
      isApiError(error) &&
      error.code === 'TWO_FACTOR_REQUIRED' &&
      window.location.pathname !== '/account/security'
    ) {
      window.location.assign('/account/security');
      return;
    }
    if (!isApiError(error) || error.status !== 401 || isMe) return;
    const path = window.location.pathname;
    if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return;
    onUnauthenticated();
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => handle(error, query.queryKey[0] === 'me') }),
    mutationCache: new MutationCache({ onError: (error) => handle(error) }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // `createResilientFetch` already retries network errors and 502/503/504 (up to 3 attempts in total), so
        // retrying them here again would multiply attempts 3 x 3. Client errors (401/403/404/409/422...) are
        // final. Everything else (e.g. a 500) gets two more tries.
        retry: (count, error) => {
          if (!isApiError(error)) return false; // network failure: fetch layer retried it already
          if (error.status >= 400 && error.status < 500) return false;
          if (error.status === 502 || error.status === 503 || error.status === 504) return false;
          return count < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}
