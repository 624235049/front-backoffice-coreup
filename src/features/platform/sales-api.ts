import { toast } from 'sonner';
import { useReasonMessage } from '@/features/reason-errors';
import { type ApiBody, type ApiItem, api, unwrap } from '@/lib/api';
import { useApiMutation, useInvalidate, useTenantQuery } from '@/lib/query';

export type SalesBoard = ApiItem<'/v1/platform/sales-ai/board'>;
export type SalesLead = SalesBoard['leads'][number];
export type SalesLeadDetail = ApiItem<'/v1/platform/sales-ai/leads/{id}'>;
export type SalesConfigView = ApiItem<'/v1/platform/sales-ai/config'>;
export type SalesConfig = SalesConfigView['config'];
export type SalesReply = ApiItem<'/v1/platform/sales-ai/replies'>[number];
export type SalesLeadPatch = ApiBody<'/v1/platform/sales-ai/leads/{id}', 'patch'>;
export type BroadcastBody = ApiBody<'/v1/platform/sales-ai/broadcast', 'post'>;
export type SalesTestBody = ApiBody<'/v1/platform/sales-ai/test', 'post'>;

export const useSalesBoard = (q: { stage?: string; q?: string }) =>
  useTenantQuery(
    ['platform', 'sales', 'board', q],
    async () =>
      (await unwrap(api.GET('/v1/platform/sales-ai/board', { params: { query: q as never } }))).data,
    { refetchInterval: 30_000 },
  );

export const useSalesLead = (id: string | null) =>
  useTenantQuery(
    ['platform', 'sales', 'lead', id],
    async () =>
      (await unwrap(api.GET('/v1/platform/sales-ai/leads/{id}', { params: { path: { id: id as string } } })))
        .data,
    { enabled: id !== null },
  );

export const useSalesConfig = () =>
  useTenantQuery(
    ['platform', 'sales', 'config'],
    async () => (await unwrap(api.GET('/v1/platform/sales-ai/config'))).data,
  );

export const useSalesReplies = (filter: 'review' | 'flagged' | 'all') =>
  useTenantQuery(
    ['platform', 'sales', 'replies', filter],
    async () =>
      (await unwrap(api.GET('/v1/platform/sales-ai/replies', { params: { query: { filter } } }))).data,
  );

export const useSalesBroadcasts = () =>
  useTenantQuery(
    ['platform', 'sales', 'broadcasts'],
    async () => (await unwrap(api.GET('/v1/platform/sales-ai/broadcasts'))).data,
  );

function useSalesMut<TVars, TData = unknown>(fn: (v: TVars) => Promise<TData>, done?: string) {
  const invalidate = useInvalidate();
  const message = useReasonMessage();
  return useApiMutation<TData, TVars>({
    mutationFn: fn,
    onSuccess: () => {
      if (done) toast.success(done);
      return invalidate('platform', 'sales');
    },
    onError: (e) => toast.error(message(e)),
  });
}

export const usePatchSalesLead = () =>
  useSalesMut(({ id, body }: { id: string; body: SalesLeadPatch }) =>
    unwrap(api.PATCH('/v1/platform/sales-ai/leads/{id}', { params: { path: { id } }, body })),
  );

export const useSaveSalesConfig = () =>
  useSalesMut(
    (body: SalesConfig) => unwrap(api.PUT('/v1/platform/sales-ai/config', { body })),
    'บันทึกการตั้งค่า AI ขายแล้ว',
  );

export const useFlagSalesReply = () =>
  useSalesMut(({ id, flagged }: { id: string; flagged: boolean }) =>
    unwrap(api.PATCH('/v1/platform/sales-ai/replies/{id}', { params: { path: { id } }, body: { flagged } })),
  );

export const useSalesTest = () =>
  useSalesMut(
    async (body: SalesTestBody) => (await unwrap(api.POST('/v1/platform/sales-ai/test', { body }))).data,
  );

export const usePreviewBroadcast = () =>
  useSalesMut(
    async (body: BroadcastBody) =>
      (await unwrap(api.POST('/v1/platform/sales-ai/broadcast/preview', { body }))).data,
  );

export const useSendBroadcast = () =>
  useSalesMut(
    (body: BroadcastBody) => unwrap(api.POST('/v1/platform/sales-ai/broadcast', { body })),
    'ส่งบรอดแคสต์เข้าคิวแล้ว',
  );

export type SalesContact = ApiItem<'/v1/platform/sales-ai/contacts'>[number];

/** People who wrote to one account (name + id): the testers picker, searchable. */
export const useSalesContacts = (accountId: string, q: string) =>
  useTenantQuery(
    ['platform', 'sales', 'contacts', accountId, q],
    async () =>
      (
        await unwrap(
          api.GET('/v1/platform/sales-ai/contacts', {
            params: { query: { accountId, ...(q ? { q } : {}) } },
          }),
        )
      ).data,
  );

export type SalesFeatureGroup = ApiItem<'/v1/platform/sales-ai/feature-requests'>[number];

/** What customers asked for that CoreUp does not do today, grouped by fit so the team decides. */
export const useSalesFeatureRequests = () =>
  useTenantQuery(
    ['platform', 'sales', 'feature-requests'],
    async () => (await unwrap(api.GET('/v1/platform/sales-ai/feature-requests'))).data,
  );
