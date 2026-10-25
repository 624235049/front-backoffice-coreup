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

function useAiMut<TVars>(fn: (v: TVars) => Promise<unknown>) {
  const invalidate = useInvalidate();
  const message = useReasonMessage();
  return useApiMutation<unknown, TVars>({
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
