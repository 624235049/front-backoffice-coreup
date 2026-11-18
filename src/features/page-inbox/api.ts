import { toast } from 'sonner';
import { type ApiBody, type ApiItem, api, isApiError, unwrap } from '@/lib/api';
import type { paths } from '@/lib/api-client';
import { useApiMutation, useInvalidate, useTenantQuery } from '@/lib/query';

/* Types come from the OpenAPI document only (never hand-written). */
export type PageStatus = ApiItem<'/v1/platform/page-inbox/status'>;
export type PageList = ApiItem<'/v1/platform/page-inbox/conversations'>;
export type PageConversation = PageList['items'][number];
export type PageDetail = ApiItem<'/v1/platform/page-inbox/conversations/{id}'>;
export type PageMessage = PageDetail['messages'][number];
export type PageStage = PageConversation['stage'];
export type PageShopType = NonNullable<PageConversation['shopType']>;
export type PageWindow = PageConversation['window'];
export type PageFilter = NonNullable<
  NonNullable<paths['/v1/platform/page-inbox/conversations']['get']['parameters']['query']>['filter']
>;
export type PageQuery = NonNullable<
  paths['/v1/platform/page-inbox/conversations']['get']['parameters']['query']
>;
export type DraftIssue = ApiItem<'/v1/platform/page-inbox/check-draft', 'post'>[number];
export type SettingsPatch = ApiBody<'/v1/platform/page-inbox/settings', 'patch'>;
export type ConversationPatch = ApiBody<'/v1/platform/page-inbox/conversations/{id}', 'patch'>;
export type PageChannel = PageConversation['channel'];
export type ChannelFilter = NonNullable<PageQuery['channel']>;
export type LineInfo = NonNullable<PageDetail['line']>;
export type LineQuota = NonNullable<NonNullable<PageList['line']>['quota']>;
export type InboxStatus = PageConversation['status'];
export type WorkStatus = NonNullable<ConversationPatch['workStatus']>;
export type PageNote = PageDetail['notes'][number];
export type PageShop = NonNullable<PageConversation['shop']>;
export type ShopOption = ApiItem<'/v1/platform/page-inbox/shops'>[number];
export type PreparedImage = ApiItem<'/v1/platform/page-inbox/line-images/{id}/prepare', 'post'>;

export const PAGE_STAGES: PageStage[] = ['new', 'talking', 'sample_sent', 'trial', 'paid', 'lost'];
export const SHOP_TYPES: PageShopType[] = ['dress', 'salon', 'massage', 'barber'];
/** What the team picks by hand; `needs_staff` is the AI's hand-over and is only shown. */
export const WORK_STATUSES: WorkStatus[] = ['new', 'in_progress', 'waiting_customer', 'done'];
export const CHANNEL_FILTERS: ChannelFilter[] = ['all', 'line', 'messenger', 'instagram'];

const part = 'page-inbox';

export const usePageStatus = () =>
  useTenantQuery(
    [part, 'status'],
    async () => (await unwrap(api.GET('/v1/platform/page-inbox/status'))).data,
  );

export const usePageList = (query: PageQuery) =>
  useTenantQuery(
    [part, 'list', query],
    async () => (await unwrap(api.GET('/v1/platform/page-inbox/conversations', { params: { query } }))).data,
    { refetchInterval: 20_000, placeholderData: (prev) => prev },
  );

export const usePageConversation = (id: string | null) =>
  useTenantQuery(
    [part, 'conversation', id],
    async () =>
      (
        await unwrap(
          api.GET('/v1/platform/page-inbox/conversations/{id}', { params: { path: { id: id as string } } }),
        )
      ).data,
    { enabled: id !== null, refetchInterval: 10_000 },
  );

/** `details.reason` / `details.message` / `details.issues` of a refused request, for the inbox's own Thai messages. */
export function refusal(e: unknown): { reason: string | null; message: string | null; issues: DraftIssue[] } {
  const d = isApiError(e) && typeof e.details === 'object' && e.details !== null ? e.details : {};
  return {
    reason: 'reason' in d && typeof d.reason === 'string' ? d.reason : null,
    message: 'message' in d && typeof d.message === 'string' ? d.message : null,
    issues: 'issues' in d && Array.isArray(d.issues) ? (d.issues as DraftIssue[]) : [],
  };
}

function useMut<TVars, TData>(fn: (v: TVars) => Promise<TData>, done?: string) {
  const invalidate = useInvalidate();
  return useApiMutation<TData, TVars>({
    mutationFn: fn,
    onSuccess: () => {
      if (done) toast.success(done);
      return invalidate(part);
    },
  });
}

export const useConnectPage = () => useMut(() => unwrap(api.POST('/v1/platform/page-inbox/connect')));
export const useSyncPage = () => useMut(() => unwrap(api.POST('/v1/platform/page-inbox/sync')));
export const usePatchSettings = () =>
  useMut((body: SettingsPatch) => unwrap(api.PATCH('/v1/platform/page-inbox/settings', { body })));
export const usePatchConversation = () =>
  useMut(({ id, body }: { id: string; body: ConversationPatch }) =>
    unwrap(api.PATCH('/v1/platform/page-inbox/conversations/{id}', { params: { path: { id } }, body })),
  );
export const useLinkTenant = () =>
  useMut(({ id, tenantId }: { id: string; tenantId: string }) =>
    unwrap(
      api.POST('/v1/platform/page-inbox/conversations/{id}/link-tenant', {
        params: { path: { id } },
        body: { tenantId },
      }),
    ),
  );

/** The send is refused with a reason the composer explains itself, so no automatic toast here. */
export function useSendMessage() {
  const invalidate = useInvalidate();
  return useApiMutation({
    mutationFn: ({
      id,
      text,
      confirmWrongFacts,
      followUpStep,
    }: {
      id: string;
      text: string;
      confirmWrongFacts?: boolean;
      followUpStep?: 1 | 2 | 3;
    }) =>
      unwrap(
        api.POST('/v1/platform/page-inbox/conversations/{id}/send', {
          params: { path: { id } },
          body: { text, confirmWrongFacts, followUpStep },
        }),
      ),
    onError: () => undefined,
    onSuccess: () => invalidate(part),
  });
}

export const checkDraft = async (text: string, shopType: PageShopType | null): Promise<DraftIssue[]> =>
  (await unwrap(api.POST('/v1/platform/page-inbox/check-draft', { body: { text, shopType } }))).data;

/** Red badge on the nav item: chats the customer wrote to that nobody on the team has opened. Polled; cheap (counts only). */
export function usePageUnreadCount(): number {
  const q = usePageList({ filter: 'unread', limit: 1 });
  return q.data?.counts.unread ?? 0;
}

/** Presign (purpose `chat_image`) → PUT the photo as it is → the server makes the LINE copies (JPEG original + preview). A failure shows in the composer; the person attaches it again. */
export async function uploadLineImage(file: File): Promise<PreparedImage> {
  const target = (
    await unwrap(
      api.GET('/v1/files/upload-url', {
        params: { query: { purpose: 'chat_image', mime: file.type, size: file.size, filename: file.name } },
      }),
    )
  ).data;
  const put = await fetch(target.uploadUrl, { method: target.method, headers: target.headers, body: file });
  if (!put.ok) throw new Error(`UPLOAD_FAILED_${put.status}`);
  return (
    await unwrap(
      api.POST('/v1/platform/page-inbox/line-images/{id}/prepare', {
        params: { path: { id: target.fileId } },
      }),
    )
  ).data;
}

/** The team has read this chat (one mark for everybody, any channel): its unread badge goes. */
export function useMarkRead() {
  const invalidate = useInvalidate();
  return useApiMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/v1/platform/page-inbox/conversations/{id}/read', { params: { path: { id } } })),
    onError: () => undefined,
    onSuccess: () => invalidate(part),
  });
}

/** "ทำเป็นยังไม่อ่าน": the chat is unread again for the whole team. */
export const useMarkUnread = () =>
  useMut((id: string) =>
    unwrap(api.POST('/v1/platform/page-inbox/conversations/{id}/unread', { params: { path: { id } } })),
  );

/** The shop this chat is about: a customer shop, a typed name (a prospect), or neither to remove it. */
export const useSetShop = () =>
  useMut(({ id, tenantId, shopName }: { id: string; tenantId: string | null; shopName: string | null }) =>
    unwrap(
      api.PUT('/v1/platform/page-inbox/conversations/{id}/shop', {
        params: { path: { id } },
        body: { tenantId, shopName },
      }),
    ),
  );

export const useAddNote = () =>
  useMut(({ id, text }: { id: string; text: string }) =>
    unwrap(
      api.POST('/v1/platform/page-inbox/conversations/{id}/notes', {
        params: { path: { id } },
        body: { text },
      }),
    ),
  );

/** Customer shops by name or slug for "ร้านที่เกี่ยวข้อง". */
export const useShopSearch = (q: string) =>
  useTenantQuery(
    [part, 'shops', q],
    async () =>
      (await unwrap(api.GET('/v1/platform/page-inbox/shops', { params: { query: { q, limit: 8 } } }))).data,
    { enabled: q.trim().length > 0 },
  );

/** A LINE reply: the composer shows a refusal (quota used up …) itself, so no automatic toast. */
export function useSendLine() {
  const invalidate = useInvalidate();
  return useApiMutation({
    mutationFn: ({
      id,
      text,
      images,
      clientId,
    }: {
      id: string;
      text: string;
      images: PreparedImage[];
      clientId: string;
    }) =>
      unwrap(
        api.POST('/v1/platform/page-inbox/conversations/{id}/send', {
          params: { path: { id } },
          body: {
            text,
            clientId,
            ...(images.length > 0
              ? { images: images.map((i) => ({ fileId: i.fileId, previewFileId: i.previewFileId })) }
              : {}),
          },
        }),
      ),
    onError: () => undefined,
    onSuccess: () => invalidate(part),
  });
}

/** "ส่งใหม่": a LINE message that failed goes out again. */
export function useRetryLine() {
  const invalidate = useInvalidate();
  return useApiMutation({
    mutationFn: (messageId: string) =>
      unwrap(
        api.POST('/v1/platform/page-inbox/line-messages/{id}/retry', { params: { path: { id: messageId } } }),
      ),
    onError: () => undefined,
    onSuccess: () => invalidate(part),
  });
}
