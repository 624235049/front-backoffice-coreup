import { toast } from 'sonner';
import { useReasonMessage } from '@/features/reason-errors';
import { type ApiBody, type ApiItem, api, unwrap } from '@/lib/api';
import { useApiMutation, useInvalidate, useTenantQuery } from '@/lib/query';

export type AiChatAdmin = ApiItem<'/v1/platform/tenants/{id}/ai-chat'>;

/** The "AI ตอบแชท" card of one shop: add-on switch, monthly quota, this month's usage, tokens and cost estimate. */
export const useAiChatAdmin = (id: string) =>
  useTenantQuery(
    ['platform', 'tenant', id, 'ai-chat'],
    async () =>
      (await unwrap(api.GET('/v1/platform/tenants/{id}/ai-chat', { params: { path: { id } } }))).data,
  );

function useAiMut<TVars, TData = unknown>(fn: (v: TVars) => Promise<TData>) {
  const invalidate = useInvalidate();
  const message = useReasonMessage();
  return useApiMutation<TData, TVars>({
    mutationFn: fn,
    onSuccess: () => invalidate('platform'),
    onError: (e) => toast.error(message(e)),
  });
}

export const usePatchAiChatAdmin = (id: string) =>
  useAiMut((body: ApiBody<'/v1/platform/tenants/{id}/ai-chat', 'patch'>) =>
    unwrap(api.PATCH('/v1/platform/tenants/{id}/ai-chat', { params: { path: { id } }, body })),
  );

export const useAiChatTopup = (id: string) =>
  useAiMut(() => unwrap(api.POST('/v1/platform/tenants/{id}/ai-chat/topup', { params: { path: { id } } })));

export type AiTestBody = ApiBody<'/v1/platform/tenants/{id}/ai-chat/test', 'post'>;
export type AiTestResult = ApiItem<'/v1/platform/tenants/{id}/ai-chat/test', 'post'>;
export type AiFollower = ApiItem<'/v1/platform/tenants/{id}/ai-chat/followers'>[number];

/** "ลองคุยกับ AI" as the CoreUp team: the real AI on the shop's data; no LINE, no history, no quota (audited). */
export const useAiTestAdmin = (id: string) =>
  useAiMut(
    async (body: AiTestBody) =>
      (await unwrap(api.POST('/v1/platform/tenants/{id}/ai-chat/test', { params: { path: { id } }, body })))
        .data,
  );

/** LINE followers of the shop to pick testers from (name search). */
export const useAiFollowersAdmin = (id: string, q: string) =>
  useTenantQuery(
    ['platform', 'tenant', id, 'ai-chat', 'followers', q],
    async () =>
      (
        await unwrap(
          api.GET('/v1/platform/tenants/{id}/ai-chat/followers', {
            params: { path: { id }, query: q ? { q } : {} },
          }),
        )
      ).data,
  );
