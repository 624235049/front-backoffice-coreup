import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { sleep } from '@/features/accounting/api';
import { isIssuePinError } from '@/features/platform/issue-pin';
import { useReasonMessage } from '@/features/reason-errors';
import { i18n } from '@/i18n';
import { type ApiBody, type ApiData, type ApiItem, api, type ListItem, unwrap } from '@/lib/api';
import { useApiMutation, useInvalidate, useTenantQuery } from '@/lib/query';
import { useSession } from '@/stores/session';

/* Types come from the OpenAPI document only (never hand-written). */
const B = '/v1/platform/sales-mail';
const ACC = '/v1/platform/accounting';
export type MailContext = ApiItem<'/v1/platform/sales-mail/context'>;
export type MailKind = MailContext['kind'];
export type MailPreview = ApiItem<'/v1/platform/sales-mail/preview', 'post'>;
export type MailCompose = ApiBody<'/v1/platform/sales-mail/preview', 'post'>;
export type MailSendBody = ApiBody<'/v1/platform/sales-mail/send', 'post'>;
export type MailSendResult = ApiItem<'/v1/platform/sales-mail/send', 'post'>;
export type OutboundList = ApiData<'/v1/platform/sales-mail/outbox'>;
export type OutboundEmail = ListItem<OutboundList>;
export type OutboundStatus = OutboundEmail['status'];
export type OutboundDetail = ApiItem<'/v1/platform/sales-mail/outbox/{id}'>;
export type MailSettings = ApiItem<'/v1/platform/sales-mail/settings'>;

const part = 'sales-mail';

/* ---------------- queries ---------------- */

/** The composer's first state; never served from cache (the contact email or the link may have changed). */
export const useMailContext = (kind: MailKind, documentId: string | undefined) =>
  useTenantQuery(
    [part, 'context', kind, documentId],
    async () => (await unwrap(api.GET(`${B}/context`, { params: { query: { kind, documentId } } }))).data,
    { staleTime: 0, gcTime: 0, refetchOnWindowFocus: false },
  );

/** The email exactly as the customer gets it; the previous answer stays on screen while the next one loads. */
export const useMailPreview = (body: MailCompose | null) =>
  useTenantQuery(
    [part, 'preview', body],
    async () => (await unwrap(api.POST(`${B}/preview`, { body: body as MailCompose }))).data,
    { enabled: body !== null, placeholderData: keepPreviousData, staleTime: 0, retry: false },
  );

export type OutboxFilter = { documentId?: string; status?: OutboundStatus; kind?: MailKind };

const PAGE = 50;

export function useOutbox(filter: OutboxFilter) {
  const tenantId = useSession((s) => s.tenantId);
  return useInfiniteQuery({
    queryKey: [tenantId, part, 'outbox', filter],
    enabled: tenantId !== null,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrap(api.GET(`${B}/outbox`, { params: { query: { ...filter, limit: PAGE, cursor: pageParam } } })),
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
  });
}

export const useOutboxItem = (id: string | null) =>
  useTenantQuery(
    [part, 'outbox-item', id],
    async () => (await unwrap(api.GET(`${B}/outbox/{id}`, { params: { path: { id: id as string } } }))).data,
    { enabled: id !== null },
  );

export const useMailSettings = (enabled = true) =>
  useTenantQuery([part, 'settings'], async () => (await unwrap(api.GET(`${B}/settings`))).data, { enabled });

/* ---------------- mutations ---------------- */

function useMut<TData, TVars>(fn: (v: TVars) => Promise<TData>) {
  const invalidate = useInvalidate();
  const message = useReasonMessage();
  return useApiMutation<TData, TVars>({
    mutationFn: fn,
    onSuccess: () => invalidate(part),
    // a PIN problem is shown by the PIN dialog itself
    onError: (e) => {
      const daily = typeof e.details === 'object' && e.details !== null && 'reason' in e.details;
      if (e.code === 'RATE_LIMITED' && !daily) toast.error(i18n.t('mail:rateLimited'));
      else if (!isIssuePinError(e)) toast.error(message(e));
    },
  });
}

export const useSendMail = () =>
  useMut(async (body: MailSendBody) => (await unwrap(api.POST(`${B}/send`, { body }))).data);

export const useSaveMailSettings = () =>
  useMut(async (body: MailSettings) => (await unwrap(api.PUT(`${B}/settings`, { body }))).data);

/** Issue the customer link of a quotation from the composer (same call as the link panel; no PIN). */
export const useMakeQuoteLink = () => {
  const invalidate = useInvalidate();
  const message = useReasonMessage();
  return useApiMutation<{ url: string }, string>({
    mutationFn: async (id) =>
      (await unwrap(api.POST(`${ACC}/documents/{id}/link`, { params: { path: { id } } }))).data,
    onSuccess: () => invalidate('accounting'),
    onError: (e) => toast.error(message(e)),
  });
};

/* ---------------- the system PDF (original page only) ---------------- */

export type MailPdf = {
  status: 'off' | 'rendering' | 'ready' | 'failed';
  jobId: string | null;
  filename: string | null;
  retry: () => void;
};

const PDF_POLL_MS = 1500;
const PDF_TIMEOUT_MS = 60_000;

/**
 * Renders the document's PDF (original only) with the worker while the composer is open, and tells when it is ready.
 * `enabled` false (the toggle is off) pauses it; a finished render is kept.
 */
export function useMailPdf(documentId: string | undefined, enabled: boolean): MailPdf {
  const [state, setState] = useState<Pick<MailPdf, 'status' | 'jobId' | 'filename'>>({
    status: 'off',
    jobId: null,
    filename: null,
  });
  const [attempt, setAttempt] = useState(0);

  // `attempt` only restarts the render (Retry); `state.status` is read once per start, not a trigger
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (!enabled || !documentId || state.status === 'ready') return;
    let cancelled = false;
    const path = { id: documentId };
    const run = async () => {
      setState({ status: 'rendering', jobId: null, filename: null });
      try {
        const started = (
          await unwrap(
            api.POST(`${ACC}/documents/{id}/pdf`, { params: { path }, body: { mode: 'original' } }),
          )
        ).data;
        const deadline = Date.now() + PDF_TIMEOUT_MS;
        for (;;) {
          await sleep(PDF_POLL_MS);
          if (cancelled) return;
          const job = (
            await unwrap(
              api.GET(`${ACC}/documents/{id}/pdf`, { params: { path, query: { job: started.id } } }),
            )
          ).data;
          if (job.status === 'ready')
            return setState({ status: 'ready', jobId: started.id, filename: job.filename });
          if (job.status === 'failed' || Date.now() > deadline) throw new Error('PDF_FAILED');
        }
      } catch {
        if (!cancelled) setState({ status: 'failed', jobId: null, filename: null });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [documentId, enabled, attempt]);

  return enabled || state.status === 'ready'
    ? { ...state, retry: () => setAttempt((n) => n + 1) }
    : { status: 'off', jobId: null, filename: null, retry: () => setAttempt((n) => n + 1) };
}

/** Presign → PUT straight to storage → file id (a customer-email attachment). */
export async function uploadMailFile(file: File): Promise<string> {
  const signed = (
    await unwrap(
      api.GET('/v1/files/upload-url', {
        params: {
          query: {
            purpose: 'sales_mail_attachment',
            mime: file.type || 'application/octet-stream',
            size: file.size,
            filename: file.name,
          },
        },
      }),
    )
  ).data;
  const res = await fetch(signed.uploadUrl, { method: 'PUT', headers: signed.headers, body: file });
  if (!res.ok) throw new Error(`UPLOAD_FAILED_${res.status}`);
  return signed.fileId;
}
