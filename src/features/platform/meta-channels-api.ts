import { toast } from 'sonner';
import { useReasonMessage } from '@/features/reason-errors';
import { api, unwrap } from '@/lib/api';
import { useApiMutation, useInvalidate, useTenantQuery } from '@/lib/query';

/** Whether this shop may connect its Facebook Page / Instagram (a `meta_channels` add-on module set by the CoreUp team). */
export const useMetaChannelsSwitch = (id: string) =>
  useTenantQuery(
    ['platform', 'tenant', id, 'meta-channels'],
    async () =>
      (await unwrap(api.GET('/v1/platform/tenants/{id}/meta-channels', { params: { path: { id } } }))).data,
  );

export function usePatchMetaChannelsSwitch(id: string) {
  const invalidate = useInvalidate();
  const message = useReasonMessage();
  return useApiMutation({
    mutationFn: (active: boolean) =>
      unwrap(
        api.PATCH('/v1/platform/tenants/{id}/meta-channels', {
          params: { path: { id } },
          body: { active },
        }),
      ),
    onSuccess: () => invalidate('platform'),
    onError: (e) => toast.error(message(e)),
  });
}
