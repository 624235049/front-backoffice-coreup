import { useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useReasonMessage } from '@/features/reason-errors';
import { type ApiBody, type ApiData, type ApiItem, api, type ListItem, unwrap } from '@/lib/api';
import { useApiMutation, useInvalidate, useTenantQuery } from '@/lib/query';
import { useSession } from '@/stores/session';

/* Types come from the OpenAPI document only (never hand-written). */
const B = '/v1/platform/accounting';
export type Company = ApiItem<'/v1/platform/accounting/company'>;
export type CompanyBody = ApiBody<'/v1/platform/accounting/company', 'put'>;
export type Contact = ListItem<ApiData<'/v1/platform/accounting/contacts'>>;
export type ContactBody = ApiBody<'/v1/platform/accounting/contacts', 'post'>;
export type ContactPrefill = ApiItem<'/v1/platform/accounting/contacts/prefill'>;
export type Item = ListItem<ApiData<'/v1/platform/accounting/items'>>;
export type ItemBody = ApiBody<'/v1/platform/accounting/items', 'post'>;
export type ExpenseCategory = ListItem<ApiData<'/v1/platform/accounting/expense-categories'>>;
export type DocumentList = ApiData<'/v1/platform/accounting/documents'>;
export type DocumentItem = ListItem<DocumentList>;
export type AccDocument = ApiItem<'/v1/platform/accounting/documents/{id}'>;
export type DocumentBody = ApiBody<'/v1/platform/accounting/documents', 'post'>;
export type DocumentUpdateBody = ApiBody<'/v1/platform/accounting/documents/{id}', 'put'>;
export type LineBody = DocumentBody['lines'][number];
export type PaymentBody = ApiBody<'/v1/platform/accounting/documents/{id}/payments', 'post'>;
export type PaymentInput = NonNullable<DocumentBody['payment']>;
export type Payment = AccDocument['payments'][number];
export type SalesList = ApiData<'/v1/platform/accounting/sales'>;
export type SalesRow = ListItem<SalesList>;
export type ExpenseList = ApiData<'/v1/platform/accounting/expenses'>;
export type ExpenseRow = ListItem<ExpenseList>;
export type Expense = ApiItem<'/v1/platform/accounting/expenses/{id}'>;
export type ExpenseBody = ApiBody<'/v1/platform/accounting/expenses', 'post'>;
export type Dashboard = ApiItem<'/v1/platform/accounting/reports/dashboard'>;
export type ProfitLoss = ApiItem<'/v1/platform/accounting/reports/profit-loss'>;
export type ExpensesByCategory = ApiItem<'/v1/platform/accounting/reports/expenses-by-category'>;
export type Receivables = ApiItem<'/v1/platform/accounting/reports/receivables'>;
export type SalesTaxReport = ApiItem<'/v1/platform/accounting/reports/sales-tax'>;
export type PurchaseTaxReport = ApiItem<'/v1/platform/accounting/reports/purchase-tax'>;
export type WithholdingReport = ApiItem<'/v1/platform/accounting/reports/withholding'>;
export type DocType = DocumentItem['type'];
export type DocStatus = DocumentItem['status'];
export type VatMode = DocumentBody['vatMode'];
export type VatType = LineBody['vatType'] & string;
export type WhtBp = 0 | 100 | 200 | 300 | 500;
export type PaymentMethod = PaymentInput['method'];

const part = 'accounting';
export const PAGE_SIZE = 100;

/* ---------------- queries ---------------- */
export const useCompany = () =>
  useTenantQuery([part, 'company'], async () => (await unwrap(api.GET(`${B}/company`))).data);

/** The API takes booleans in the query string as "true" | "false". */
const flag = (v: boolean | undefined) =>
  v === undefined ? undefined : v ? ('true' as const) : ('false' as const);

export const useContacts = (
  query: { q?: string; kind?: 'customer' | 'vendor'; active?: boolean; limit?: number },
  enabled = true,
) =>
  useTenantQuery(
    [part, 'contacts', query],
    async () =>
      (
        await unwrap(
          api.GET(`${B}/contacts`, { params: { query: { ...query, active: flag(query.active) } } }),
        )
      ).data,
    { enabled, placeholderData: (p) => p },
  );

export const useItems = (query: { q?: string; active?: boolean; limit?: number }, enabled = true) =>
  useTenantQuery(
    [part, 'items', query],
    async () =>
      (await unwrap(api.GET(`${B}/items`, { params: { query: { ...query, active: flag(query.active) } } })))
        .data,
    { enabled, placeholderData: (p) => p },
  );

export const useExpenseCategories = () =>
  useTenantQuery(
    [part, 'expense-categories'],
    async () => (await unwrap(api.GET(`${B}/expense-categories`))).data,
  );

export const useDocument = (id: string | undefined) =>
  useTenantQuery(
    [part, 'document', id],
    async () =>
      (await unwrap(api.GET(`${B}/documents/{id}`, { params: { path: { id: id as string } } }))).data,
    { enabled: id !== undefined },
  );

/** Cursor-paged list: pages are appended by "load more"; totals come from the first page (all matches). */
function useCursorList<P extends { page: { nextCursor: string | null } }>(
  key: readonly unknown[],
  fetchPage: (cursor: string | undefined) => Promise<P>,
) {
  const tenantId = useSession((s) => s.tenantId);
  return useInfiniteQuery({
    queryKey: [tenantId, part, ...key],
    enabled: tenantId !== null,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
  });
}

export type DocumentListFilter = {
  type?: DocType;
  status?: DocStatus;
  q?: string;
  from?: string;
  to?: string;
  contactId?: string;
};

export const useDocuments = (filter: DocumentListFilter) =>
  useCursorList(['documents', filter], (cursor) =>
    unwrap(api.GET(`${B}/documents`, { params: { query: { ...filter, limit: PAGE_SIZE, cursor } } })),
  );

export type SalesListFilter = {
  source?: SalesRow['source'];
  type?: Exclude<DocType, 'quotation'>;
  status?: DocStatus | 'overdue';
  q?: string;
  from?: string;
  to?: string;
};

export const useSales = (filter: SalesListFilter) =>
  useCursorList(['sales', filter], (cursor) =>
    unwrap(api.GET(`${B}/sales`, { params: { query: { ...filter, limit: PAGE_SIZE, cursor } } })),
  );

export type ExpenseListFilter = {
  q?: string;
  categoryId?: string;
  paymentStatus?: 'unpaid' | 'paid';
  from?: string;
  to?: string;
};

export const useExpenses = (filter: ExpenseListFilter) =>
  useCursorList(['expenses', filter], (cursor) =>
    unwrap(api.GET(`${B}/expenses`, { params: { query: { ...filter, limit: PAGE_SIZE, cursor } } })),
  );

export const useExpense = (id: string | undefined) =>
  useTenantQuery(
    [part, 'expense', id],
    async () =>
      (await unwrap(api.GET(`${B}/expenses/{id}`, { params: { path: { id: id as string } } }))).data,
    { enabled: id !== undefined },
  );

type Range = { from?: string; to?: string; granularity?: 'month' | 'year' };

export const useDashboard = (month?: string) =>
  useTenantQuery(
    [part, 'report', 'dashboard', month],
    async () => (await unwrap(api.GET(`${B}/reports/dashboard`, { params: { query: { month } } }))).data,
  );

export const useProfitLoss = (query: Range) =>
  useTenantQuery(
    [part, 'report', 'pnl', query],
    async () => (await unwrap(api.GET(`${B}/reports/profit-loss`, { params: { query } }))).data,
  );

export const useExpensesByCategory = (query: Range) =>
  useTenantQuery(
    [part, 'report', 'expenses-by-category', query],
    async () => (await unwrap(api.GET(`${B}/reports/expenses-by-category`, { params: { query } }))).data,
  );

export const useReceivables = (asOf?: string) =>
  useTenantQuery(
    [part, 'report', 'receivables', asOf],
    async () => (await unwrap(api.GET(`${B}/reports/receivables`, { params: { query: { asOf } } }))).data,
  );

export const useSalesTax = (query: Range, enabled = true) =>
  useTenantQuery(
    [part, 'report', 'sales-tax', query.from, query.to],
    async () =>
      (
        await unwrap(
          api.GET(`${B}/reports/sales-tax`, { params: { query: { from: query.from, to: query.to } } }),
        )
      ).data,
    { enabled },
  );

export const usePurchaseTax = (query: Range, enabled = true) =>
  useTenantQuery(
    [part, 'report', 'purchase-tax', query.from, query.to],
    async () =>
      (
        await unwrap(
          api.GET(`${B}/reports/purchase-tax`, { params: { query: { from: query.from, to: query.to } } }),
        )
      ).data,
    { enabled },
  );

export const useWithholding = (query: Range) =>
  useTenantQuery(
    [part, 'report', 'withholding', query.from, query.to],
    async () =>
      (
        await unwrap(
          api.GET(`${B}/reports/withholding`, { params: { query: { from: query.from, to: query.to } } }),
        )
      ).data,
  );

/* ---------------- mutations ---------------- */
function useMut<TData, TVars>(fn: (v: TVars) => Promise<TData>) {
  const invalidate = useInvalidate();
  const message = useReasonMessage();
  return useApiMutation<TData, TVars>({
    mutationFn: fn,
    onSuccess: () => invalidate(part),
    // the API's real cause (`details.reason`) in plain Thai instead of the generic "invalid data"
    onError: (e) => toast.error(message(e)),
  });
}

export const useSaveCompany = () =>
  useMut(async (body: CompanyBody) => (await unwrap(api.PUT(`${B}/company`, { body }))).data);

export const useCreateContact = () =>
  useMut(async (body: ContactBody) => (await unwrap(api.POST(`${B}/contacts`, { body }))).data);

export const usePatchContact = () =>
  useMut(
    async (v: { id: string; body: ApiBody<'/v1/platform/accounting/contacts/{id}', 'patch'> }) =>
      (await unwrap(api.PATCH(`${B}/contacts/{id}`, { params: { path: { id: v.id } }, body: v.body }))).data,
  );

export const useDeleteContact = () =>
  useMut((id: string) => unwrap(api.DELETE(`${B}/contacts/{id}`, { params: { path: { id } } })));

export const useCreateItem = () =>
  useMut(async (body: ItemBody) => (await unwrap(api.POST(`${B}/items`, { body }))).data);

export const usePatchItem = () =>
  useMut(
    async (v: { id: string; body: ApiBody<'/v1/platform/accounting/items/{id}', 'patch'> }) =>
      (await unwrap(api.PATCH(`${B}/items/{id}`, { params: { path: { id: v.id } }, body: v.body }))).data,
  );

export const useDeleteItem = () =>
  useMut((id: string) => unwrap(api.DELETE(`${B}/items/{id}`, { params: { path: { id } } })));

export const useCreateCategory = () =>
  useMut(
    async (body: ApiBody<'/v1/platform/accounting/expense-categories', 'post'>) =>
      (await unwrap(api.POST(`${B}/expense-categories`, { body }))).data,
  );

export const usePatchCategory = () =>
  useMut(
    async (v: { id: string; body: ApiBody<'/v1/platform/accounting/expense-categories/{id}', 'patch'> }) =>
      (
        await unwrap(
          api.PATCH(`${B}/expense-categories/{id}`, { params: { path: { id: v.id } }, body: v.body }),
        )
      ).data,
  );

export const useDeleteCategory = () =>
  useMut((id: string) => unwrap(api.DELETE(`${B}/expense-categories/{id}`, { params: { path: { id } } })));

export const useCreateDocument = () =>
  useMut(async (body: DocumentBody) => (await unwrap(api.POST(`${B}/documents`, { body }))).data);

export const useUpdateDocument = () =>
  useMut(
    async (v: { id: string; body: DocumentUpdateBody }) =>
      (await unwrap(api.PUT(`${B}/documents/{id}`, { params: { path: { id: v.id } }, body: v.body }))).data,
  );

export const useDeleteDocument = () =>
  useMut((id: string) => unwrap(api.DELETE(`${B}/documents/{id}`, { params: { path: { id } } })));

export const useIssueDocument = () =>
  useMut(
    async (v: { id: string; payment?: PaymentInput | null }) =>
      (
        await unwrap(
          api.POST(`${B}/documents/{id}/issue`, {
            params: { path: { id: v.id } },
            body: { payment: v.payment ?? null },
          }),
        )
      ).data,
  );

export const useVoidDocument = () =>
  useMut(
    async (v: { id: string; reason: string }) =>
      (
        await unwrap(
          api.POST(`${B}/documents/{id}/void`, {
            params: { path: { id: v.id } },
            body: { reason: v.reason },
          }),
        )
      ).data,
  );

export const useQuotationStatus = () =>
  useMut(
    async (v: { id: string; status: 'accepted' | 'rejected' | 'expired' }) =>
      (
        await unwrap(
          api.POST(`${B}/documents/{id}/quotation-status`, {
            params: { path: { id: v.id } },
            body: { status: v.status },
          }),
        )
      ).data,
  );

export const useConvertDocument = () =>
  useMut(
    async (v: { id: string; to: 'invoice' | 'credit_note'; issue?: boolean }) =>
      (
        await unwrap(
          api.POST(`${B}/documents/{id}/convert`, {
            params: { path: { id: v.id } },
            body: { to: v.to, issue: v.issue ?? false },
          }),
        )
      ).data,
  );

export const useRecordPayment = () =>
  useMut(
    async (v: { id: string; body: PaymentBody }) =>
      (
        await unwrap(
          api.POST(`${B}/documents/{id}/payments`, { params: { path: { id: v.id } }, body: v.body }),
        )
      ).data,
  );

export const useVoidPayment = () =>
  useMut(
    async (v: { id: string; reason: string }) =>
      (
        await unwrap(
          api.POST(`${B}/payments/{id}/void`, {
            params: { path: { id: v.id } },
            body: { reason: v.reason },
          }),
        )
      ).data,
  );

export const useCreateExpense = () =>
  useMut(async (body: ExpenseBody) => (await unwrap(api.POST(`${B}/expenses`, { body }))).data);

export const useUpdateExpense = () =>
  useMut(
    async (v: { id: string; body: ExpenseBody }) =>
      (await unwrap(api.PUT(`${B}/expenses/{id}`, { params: { path: { id: v.id } }, body: v.body }))).data,
  );

export const useDeleteExpense = () =>
  useMut((id: string) => unwrap(api.DELETE(`${B}/expenses/{id}`, { params: { path: { id } } })));

/* ---------------- imperative helpers ---------------- */

/** Fetch a shop's data to pre-fill the contact form. */
export const fetchContactPrefill = async (tenantId: string) =>
  (await unwrap(api.GET(`${B}/contacts/prefill`, { params: { query: { tenantId } } }))).data;

export type PdfMode = 'original' | 'copy' | 'both';

/**
 * What an A4 document is made from: one of our own documents, or an invoice CoreUp sent to a shop (read through the
 * accounting module or through the platform invoices page — each has its own permission).
 */
export type A4Source = { kind: 'document' | 'shop-accounting' | 'shop-platform'; id: string };
export type A4Preview = ApiItem<'/v1/platform/accounting/documents/{id}/preview'>;
type PdfJob = ApiItem<'/v1/platform/accounting/documents/{id}/pdf'>;

/** Server-rendered pages of the document (the exact HTML the PDF is made from), as A4 sheets. */
export const fetchA4Preview = async (src: A4Source, mode: PdfMode): Promise<A4Preview> => {
  const path = { id: src.id };
  const query = { mode };
  if (src.kind === 'document')
    return (await unwrap(api.GET(`${B}/documents/{id}/preview`, { params: { path, query } }))).data;
  if (src.kind === 'shop-accounting')
    return (await unwrap(api.GET(`${B}/shop-invoices/{id}/preview`, { params: { path, query } }))).data;
  return (await unwrap(api.GET('/v1/platform/invoices/{id}/preview', { params: { path, query } }))).data;
};

export const useA4Preview = (src: A4Source, mode: PdfMode) =>
  useTenantQuery(['accounting', 'a4', src.kind, src.id, mode], () => fetchA4Preview(src, mode));

/** The structured document behind an A4 page (own document, or the shop invoice shaped like one). */
export const fetchA4Document = async (src: A4Source): Promise<AccDocument> => {
  const path = { id: src.id };
  if (src.kind === 'document')
    return (await unwrap(api.GET(`${B}/documents/{id}`, { params: { path } }))).data;
  if (src.kind === 'shop-accounting')
    return (await unwrap(api.GET(`${B}/shop-invoices/{id}`, { params: { path } }))).data;
  return (await unwrap(api.GET('/v1/platform/invoices/{id}', { params: { path } }))).data;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll a started worker job until the file is ready. Throws PDF_FAILED / PDF_TIMEOUT. */
async function pollPdf(
  started: PdfJob,
  check: (jobId: string) => Promise<PdfJob>,
  timeoutMs: number,
): Promise<{ url: string; filename: string | null }> {
  let job = started;
  const deadline = Date.now() + timeoutMs;
  while (job.status !== 'ready') {
    if (job.status === 'failed') throw new Error('PDF_FAILED');
    if (Date.now() > deadline) throw new Error('PDF_TIMEOUT');
    await sleep(1500);
    job = await check(started.id);
  }
  if (!job.url) throw new Error('PDF_FAILED');
  return { url: job.url, filename: job.filename };
}

/**
 * Start the PDF render (worker `pdf.render`) and poll until the file is ready. Resolves to the presigned URL
 * and file name. Throws when the render fails or takes longer than `timeoutMs`.
 */
export async function renderA4Pdf(
  src: A4Source,
  mode: PdfMode,
  timeoutMs = 60_000,
): Promise<{ url: string; filename: string | null }> {
  const path = { id: src.id };
  const body = { mode };
  if (src.kind === 'document') {
    const started = (await unwrap(api.POST(`${B}/documents/{id}/pdf`, { params: { path }, body }))).data;
    return pollPdf(
      started,
      async (job) =>
        (await unwrap(api.GET(`${B}/documents/{id}/pdf`, { params: { path, query: { job } } }))).data,
      timeoutMs,
    );
  }
  if (src.kind === 'shop-accounting') {
    const started = (await unwrap(api.POST(`${B}/shop-invoices/{id}/pdf`, { params: { path }, body }))).data;
    return pollPdf(
      started,
      async (job) =>
        (await unwrap(api.GET(`${B}/shop-invoices/{id}/pdf`, { params: { path, query: { job } } }))).data,
      timeoutMs,
    );
  }
  const started = (await unwrap(api.POST('/v1/platform/invoices/{id}/pdf', { params: { path }, body }))).data;
  return pollPdf(
    started,
    async (job) =>
      (await unwrap(api.GET('/v1/platform/invoices/{id}/pdf', { params: { path, query: { job } } }))).data,
    timeoutMs,
  );
}

export type ListPdfBody = ApiBody<'/v1/platform/accounting/export/documents-pdf', 'post'>;

/** A4 landscape summary of a list (same filters as the screen). */
export async function renderListPdf(
  body: ListPdfBody,
  timeoutMs = 90_000,
): Promise<{ url: string; filename: string | null }> {
  const started = (await unwrap(api.POST(`${B}/export/documents-pdf`, { body }))).data;
  return pollPdf(
    started,
    async (job) => (await unwrap(api.GET(`${B}/export/documents-pdf`, { params: { query: { job } } }))).data,
    timeoutMs,
  );
}

/** Every row of a list for the Excel export (the screen only holds the pages loaded so far). */
export async function fetchAllSales(filter: SalesListFilter): Promise<SalesRow[]> {
  const rows: SalesRow[] = [];
  let cursor: string | undefined;
  do {
    const page = await unwrap(
      api.GET(`${B}/sales`, { params: { query: { ...filter, limit: 500, cursor } } }),
    );
    rows.push(...page.data);
    cursor = page.page.nextCursor ?? undefined;
  } while (cursor);
  return rows;
}

export async function fetchAllDocuments(filter: DocumentListFilter): Promise<DocumentItem[]> {
  const rows: DocumentItem[] = [];
  let cursor: string | undefined;
  do {
    const page = await unwrap(
      api.GET(`${B}/documents`, { params: { query: { ...filter, limit: 500, cursor } } }),
    );
    rows.push(...page.data);
    cursor = page.page.nextCursor ?? undefined;
  } while (cursor);
  return rows;
}

export type AccountingFilePurpose = 'accounting_file' | 'expense_receipt';

/** Presign → PUT straight to storage → file id (logo, WHT certificate, expense receipt). */
export async function uploadAccountingFile(file: File, purpose: AccountingFilePurpose): Promise<string> {
  const mime = file.type || 'application/octet-stream';
  const signed = (
    await unwrap(
      api.GET('/v1/files/upload-url', {
        params: { query: { purpose, mime, size: file.size, filename: file.name } },
      }),
    )
  ).data;
  const res = await fetch(signed.uploadUrl, { method: 'PUT', headers: signed.headers, body: file });
  if (!res.ok) throw new Error(`UPLOAD_FAILED_${res.status}`);
  return signed.fileId;
}

/** Short-lived presigned GET URL of an uploaded file. */
export async function fileDownloadUrl(fileId: string): Promise<string> {
  const res = (await unwrap(api.GET('/v1/files/{id}/download-url', { params: { path: { id: fileId } } })))
    .data;
  return res.url;
}
