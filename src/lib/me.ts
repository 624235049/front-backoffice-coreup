import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export const meQueryKey = ['me'] as const;

export const meQueryOptions = queryOptions({
  queryKey: meQueryKey,
  queryFn: () => unwrap(api.GET('/v1/me')),
  staleTime: 60_000,
});

/** Signed-in user + all memberships. Not tenant-scoped: use `useMembership()` / `useTenant()` inside `_app`. */
export function useMe() {
  return useQuery(meQueryOptions);
}

/** Re-fetch /v1/me (terminology, uiMode, branches and permissions live there). Call after changing them. */
export function useRefreshMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: meQueryKey });
}
