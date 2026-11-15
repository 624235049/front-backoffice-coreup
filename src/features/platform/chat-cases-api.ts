import { useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useReasonMessage } from '@/features/reason-errors';
import { type ApiItem, api, unwrap } from '@/lib/api';
import { useApiMutation, useInvalidate, useTenantQuery } from '@/lib/query';
import { useSession } from '@/stores/session';

export type ChatCase = ApiItem<'/v1/platform/chat-cases'>[number];
export type ChatCaseStatus = ChatCase['status'];

const PAGE_SIZE = 50;

/** Shops' messages the support AI queued or escalated (emergencies first, then newest), 50 per page ("load more"). */
export function useChatCases(status: ChatCaseStatus | undefined) {
  const tenantId = useSession((s) => s.tenantId);
  return useInfiniteQuery({
    queryKey: [tenantId, 'platform', 'chatCases', 'list', status ?? 'all'],
    enabled: tenantId !== null,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/platform/chat-cases', {
          params: { query: { ...(status ? { status } : {}), limit: PAGE_SIZE, cursor: pageParam } },
        }),
      ),
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
    select: (d) => d.pages.flatMap((p) => p.data),
    // the team keeps this page open while shops write in
    refetchInterval: 60_000,
  });
}

/** Red badge on the menu: chat cases still waiting for the team (a count from the server, not the rows). */
export const useOpenChatCaseCount = (): number =>
  useTenantQuery(
    ['platform', 'chatCases', 'count'],
    async () => (await unwrap(api.GET('/v1/platform/chat-cases/count'))).data.open,
    { refetchInterval: 60_000 },
  ).data ?? 0;

export function usePatchChatCase() {
  const invalidate = useInvalidate();
  const message = useReasonMessage();
  return useApiMutation({
    mutationFn: async (v: { id: string; status: ChatCaseStatus }) =>
      (
        await unwrap(
          api.PATCH('/v1/platform/chat-cases/{id}', {
            params: { path: { id: v.id } },
            body: { status: v.status },
          }),
        )
      ).data,
    onSuccess: () => invalidate('platform', 'chatCases'),
    onError: (e) => toast.error(message(e)),
  });
}
