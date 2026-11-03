import { useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useReasonMessage } from '@/features/reason-errors';
import { type ApiBody, type ApiItem, api, unwrap } from '@/lib/api';
import { useApiMutation, useInvalidate, useTenantQuery } from '@/lib/query';
import { useSession } from '@/stores/session';

export type SupportCase = ApiItem<'/v1/platform/support-cases'>[number];
export type SupportCaseDetail = ApiItem<'/v1/platform/support-cases/{id}'>;
export type SupportCaseStatus = SupportCase['status'];
export type SupportCasePatch = ApiBody<'/v1/platform/support-cases/{id}', 'patch'>;

const PAGE_SIZE = 50;

/** Problems shops sent from the in-app assistant (open first, then in progress, then done), 50 per page ("load more"). */
export function useSupportCases(status: SupportCaseStatus | undefined) {
  const tenantId = useSession((s) => s.tenantId);
  return useInfiniteQuery({
    queryKey: [tenantId, 'platform', 'supportCases', 'list', status ?? 'all'],
    enabled: tenantId !== null,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/platform/support-cases', {
          params: { query: { ...(status ? { status } : {}), limit: PAGE_SIZE, cursor: pageParam } },
        }),
      ),
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
    select: (d) => d.pages.flatMap((p) => p.data),
    // the team keeps this page open while shops write in
    refetchInterval: 60_000,
  });
}

/** Red badge on the menu: cases still waiting for the team (a count from the server, not the rows). */
export const useOpenSupportCaseCount = (): number =>
  useTenantQuery(
    ['platform', 'supportCases', 'count'],
    async () => (await unwrap(api.GET('/v1/platform/support-cases/count'))).data.open,
    { refetchInterval: 60_000 },
  ).data ?? 0;

export const useSupportCase = (id: string | null) =>
  useTenantQuery(
    ['platform', 'supportCases', 'detail', id],
    async () =>
      (await unwrap(api.GET('/v1/platform/support-cases/{id}', { params: { path: { id: id ?? '' } } }))).data,
    { enabled: id !== null },
  );

export function usePatchSupportCase(id: string) {
  const invalidate = useInvalidate();
  const message = useReasonMessage();
  return useApiMutation({
    mutationFn: async (body: SupportCasePatch) =>
      (await unwrap(api.PATCH('/v1/platform/support-cases/{id}', { params: { path: { id } }, body }))).data,
    onSuccess: () => invalidate('platform', 'supportCases'),
    onError: (e) => toast.error(message(e)),
  });
}
