import { toast } from 'sonner';
import { useReasonMessage } from '@/features/reason-errors';
import { type ApiBody, type ApiData, type ApiItem, api, type ListItem, unwrap } from '@/lib/api';
import type { paths } from '@/lib/api-client';
import { useApiMutation, useInvalidate, useTenantQuery } from '@/lib/query';

/* Types come from the OpenAPI document only (never hand-written). */
export type Overview = ApiItem<'/v1/platform/overview'>;
export type TenantRow = ListItem<ApiData<'/v1/platform/tenants'>>;
export type TenantDetail = ApiItem<'/v1/platform/tenants/{id}'>;
export type TenantsQuery = NonNullable<
  NonNullable<import('@/lib/api-client').paths['/v1/platform/tenants']['get']['parameters']['query']>
>;
export type Plan = ListItem<ApiData<'/v1/platform/plans'>>;
export type Lead = ListItem<ApiData<'/v1/platform/leads'>>;
export type LeadDetail = ApiItem<'/v1/platform/leads/{id}'>;
export type LeadStage = Lead['stage'];
export type TenantLimit = ListItem<ApiData<'/v1/platform/tenants/{id}/limits'>>;
export type Engagement = ListItem<ApiData<'/v1/platform/engagements'>>;
export type EngagementTask = ListItem<ApiData<'/v1/platform/engagements/{id}/tasks'>>;
export type Audit = ListItem<ApiData<'/v1/platform/audits'>>;
export type AuditDetail = ApiItem<'/v1/platform/audits/{id}'>;
export type Rubric = ApiItem<'/v1/platform/rubric'>;
export type Invoice = ListItem<ApiData<'/v1/platform/invoices'>>;
export type Revenue = ApiItem<'/v1/platform/revenue'>;
export type TeamMember = ListItem<ApiData<'/v1/platform/team'>>;
export type Assignment = ListItem<ApiData<'/v1/platform/assignments'>>;
export type TenantBranch = ListItem<ApiData<'/v1/platform/tenants/{id}/branches'>>;
export type AccessLogRow = ListItem<ApiData<'/v1/platform/tenants/{id}/access-log'>>;
export type UsageReport = ApiItem<'/v1/platform/usage-report'>;
export type TenantNotice = ListItem<ApiData<'/v1/platform/tenants/{id}/notices'>>;
export type BusinessTypePreview = ApiItem<'/v1/platform/tenants/{id}/business-type-preview'>;
export type TemplateSection = NonNullable<
  ApiBody<'/v1/platform/tenants/{id}/business-type', 'post'>['sections']
>[number];
export type UsageReportRow = UsageReport['rows'][number];
export type UsageReportQuery = NonNullable<paths['/v1/platform/usage-report']['get']['parameters']['query']>;
export type Onboarding = ApiItem<'/v1/platform/onboarding'>;
export type OnboardingRow = Onboarding['rows'][number];
export type OnboardingQuery = NonNullable<paths['/v1/platform/onboarding']['get']['parameters']['query']>;
export type TenantFollowup = ListItem<ApiData<'/v1/platform/tenants/{id}/followups'>>;

const part = 'platform';

/* ---------------- queries ---------------- */
export const useOverview = () =>
  useTenantQuery([part, 'overview'], () => unwrap(api.GET('/v1/platform/overview')));

export const useTenants = (query: TenantsQuery) =>
  useTenantQuery(
    [part, 'tenants', query],
    async () => (await unwrap(api.GET('/v1/platform/tenants', { params: { query } }))).data,
  );

export const useUsageReport = (query: UsageReportQuery) =>
  useTenantQuery(
    [part, 'usageReport', query],
    async () => (await unwrap(api.GET('/v1/platform/usage-report', { params: { query } }))).data,
  );

export const useTenant = (id: string) =>
  useTenantQuery([part, 'tenant', id], () =>
    unwrap(api.GET('/v1/platform/tenants/{id}', { params: { path: { id } } })),
  );

export const useTenantBranches = (id: string, enabled = true) =>
  useTenantQuery(
    [part, 'tenant', id, 'branches'],
    async () =>
      (await unwrap(api.GET('/v1/platform/tenants/{id}/branches', { params: { path: { id } } }))).data,
    { enabled },
  );

export const useAccessLog = (id: string) =>
  useTenantQuery(
    [part, 'tenant', id, 'access'],
    async () =>
      (await unwrap(api.GET('/v1/platform/tenants/{id}/access-log', { params: { path: { id } } }))).data,
  );

export const useBusinessTypePreview = (id: string, industryKey: string | null) =>
  useTenantQuery(
    [part, 'tenant', id, 'business-type-preview', industryKey],
    async () =>
      (
        await unwrap(
          api.GET('/v1/platform/tenants/{id}/business-type-preview', {
            params: { path: { id }, query: { industryKey: industryKey as string } },
          }),
        )
      ).data,
    { enabled: industryKey !== null },
  );

export const useTenantNotices = (id: string) =>
  useTenantQuery(
    [part, 'tenant', id, 'notices'],
    async () =>
      (await unwrap(api.GET('/v1/platform/tenants/{id}/notices', { params: { path: { id } } }))).data,
  );

export const useTenantLimits = (id: string) =>
  useTenantQuery(
    [part, 'tenant', id, 'limits'],
    async () =>
      (await unwrap(api.GET('/v1/platform/tenants/{id}/limits', { params: { path: { id } } }))).data,
  );

export const useTenantUsage = (id: string) =>
  useTenantQuery(
    [part, 'tenant', id, 'usage'],
    async () =>
      (await unwrap(api.GET('/v1/platform/tenants/{id}/usage', { params: { path: { id }, query: {} } })))
        .data,
  );

export const useTenantReport = (id: string, key: string) =>
  useTenantQuery(
    [part, 'tenant', id, 'report', key],
    () =>
      unwrap(
        api.GET('/v1/platform/tenants/{id}/reports/{key}', { params: { path: { id, key }, query: {} } }),
      ),
    { retry: false },
  );

export const usePlans = () =>
  useTenantQuery([part, 'plans'], async () => (await unwrap(api.GET('/v1/platform/plans'))).data);

export const useAssignments = (tenantId?: string) =>
  useTenantQuery(
    [part, 'assignments', tenantId ?? 'all'],
    async () => (await unwrap(api.GET('/v1/platform/assignments', { params: { query: { tenantId } } }))).data,
  );

export const useTeam = (enabled = true) =>
  useTenantQuery([part, 'team'], async () => (await unwrap(api.GET('/v1/platform/team'))).data, { enabled });

export const useLeads = () =>
  useTenantQuery(
    [part, 'leads'],
    async () => (await unwrap(api.GET('/v1/platform/leads', { params: { query: {} } }))).data,
  );

export const useLead = (id: string | null) =>
  useTenantQuery(
    [part, 'lead', id],
    () => unwrap(api.GET('/v1/platform/leads/{id}', { params: { path: { id: id as string } } })),
    { enabled: id !== null },
  );

/** Leads nobody has contacted yet; polled so the nav badge (and the toast) notice a new website lead. */
export const useLeadSummary = (enabled = true) =>
  useTenantQuery(
    [part, 'leads-summary'],
    async () => (await unwrap(api.GET('/v1/platform/leads/summary'))).data,
    { enabled, refetchInterval: 30_000 },
  );

/** Active CoreUp team members a lead can be handed to. */
export const useLeadAssignees = () =>
  useTenantQuery(
    [part, 'lead-assignees'],
    async () => (await unwrap(api.GET('/v1/platform/leads/assignees'))).data,
  );

export const useOnboarding = (days: OnboardingQuery['days']) =>
  useTenantQuery(
    [part, 'onboarding', days],
    async () => (await unwrap(api.GET('/v1/platform/onboarding', { params: { query: { days } } }))).data,
  );

/** Shops to follow up today; polled so the nav badge stays current. */
export const useOnboardingSummary = (enabled = true) =>
  useTenantQuery(
    [part, 'onboarding-summary'],
    async () => (await unwrap(api.GET('/v1/platform/onboarding/summary'))).data,
    { enabled, refetchInterval: 60_000 },
  );

export const useTenantFollowups = (id: string | null) =>
  useTenantQuery(
    [part, 'tenant', id, 'followups'],
    async () =>
      (
        await unwrap(
          api.GET('/v1/platform/tenants/{id}/followups', { params: { path: { id: id as string } } }),
        )
      ).data,
    { enabled: id !== null },
  );

export const useEngagements = (query: { tenantId?: string; status?: Engagement['status'] } = {}) =>
  useTenantQuery(
    [part, 'engagements', query],
    async () => (await unwrap(api.GET('/v1/platform/engagements', { params: { query } }))).data,
  );

export const useEngagement = (id: string) =>
  useTenantQuery([part, 'engagement', id], () =>
    unwrap(api.GET('/v1/platform/engagements/{id}', { params: { path: { id } } })),
  );

export const useEngagementTasks = (id: string) =>
  useTenantQuery(
    [part, 'engagement', id, 'tasks'],
    async () =>
      (await unwrap(api.GET('/v1/platform/engagements/{id}/tasks', { params: { path: { id } } }))).data,
  );

export const useAudits = (query: { tenantId?: string } = {}) =>
  useTenantQuery(
    [part, 'audits', query],
    async () => (await unwrap(api.GET('/v1/platform/audits', { params: { query } }))).data,
  );

export const useAudit = (id: string) =>
  useTenantQuery(
    [part, 'audit', id],
    () => unwrap(api.GET('/v1/platform/audits/{id}', { params: { path: { id } } })),
    {
      // while the PDF is rendering by the worker, poll until it is ready
      refetchInterval: (q) => (q.state.data?.data.report.status === 'queued' ? 2000 : false),
    },
  );

export const useRubric = () =>
  useTenantQuery([part, 'rubric'], () => unwrap(api.GET('/v1/platform/rubric')), {
    staleTime: Number.POSITIVE_INFINITY,
  });

export const useInvoices = (
  query: {
    status?: Invoice['status'];
    source?: Invoice['source'];
    tenantId?: string;
    /** the "รอยืนยันรับเงิน" queue: unpaid invoices with a slip */
    awaiting?: 'true';
  } = {},
  /** Poll while mounted (the nav badge of slips waiting for review). */
  refetchInterval?: number,
) =>
  useTenantQuery(
    [part, 'invoices', query],
    async () => (await unwrap(api.GET('/v1/platform/invoices', { params: { query } }))).data,
    { refetchInterval },
  );

export const useRevenue = (query: { from?: string; to?: string }, enabled = true) =>
  useTenantQuery(
    [part, 'revenue', query],
    () => unwrap(api.GET('/v1/platform/revenue', { params: { query } })),
    { enabled },
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

export const useCreateTenant = () =>
  useMut((body: ApiBody<'/v1/platform/tenants', 'post'>) =>
    unwrap(api.POST('/v1/platform/tenants', { body })),
  );

export const usePatchTenant = (id: string) =>
  useMut((body: ApiBody<'/v1/platform/tenants/{id}', 'patch'>) =>
    unwrap(api.PATCH('/v1/platform/tenants/{id}', { params: { path: { id } }, body })),
  );

export const useSetModules = (id: string) =>
  useMut((body: ApiBody<'/v1/platform/tenants/{id}/modules', 'put'>) =>
    unwrap(api.PUT('/v1/platform/tenants/{id}/modules', { params: { path: { id } }, body })),
  );

export const useSetTenantLimit = (id: string) =>
  useMut((body: ApiBody<'/v1/platform/tenants/{id}/limits', 'put'>) =>
    unwrap(api.PUT('/v1/platform/tenants/{id}/limits', { params: { path: { id } }, body })),
  );

export const useSwitchBusinessType = (id: string) =>
  useMut((body: ApiBody<'/v1/platform/tenants/{id}/business-type', 'post'>) =>
    unwrap(api.POST('/v1/platform/tenants/{id}/business-type', { params: { path: { id } }, body })),
  );

export const useSendNotice = (id: string) =>
  useMut((body: ApiBody<'/v1/platform/tenants/{id}/notices', 'post'>) =>
    unwrap(api.POST('/v1/platform/tenants/{id}/notices', { params: { path: { id } }, body })),
  );

export const useFillDemoData = (id: string) =>
  useMut((body: ApiBody<'/v1/platform/tenants/{id}/demo-data', 'post'>) =>
    unwrap(api.POST('/v1/platform/tenants/{id}/demo-data', { params: { path: { id } }, body })),
  );

export const useClearDemoData = (id: string) =>
  useMut(() => unwrap(api.DELETE('/v1/platform/tenants/{id}/demo-data', { params: { path: { id } } })));

export const useImpersonate = (id: string) =>
  useMut((body: ApiBody<'/v1/platform/tenants/{id}/impersonate', 'post'>) =>
    unwrap(api.POST('/v1/platform/tenants/{id}/impersonate', { params: { path: { id } }, body })),
  );

export const useAddAssignment = () =>
  useMut((body: ApiBody<'/v1/platform/assignments', 'post'>) =>
    unwrap(api.POST('/v1/platform/assignments', { body })),
  );

export const useRemoveAssignment = () =>
  useMut((a: { tenantId: string; userId: string; role: 'consultant' | 'sales' }) =>
    unwrap(api.DELETE('/v1/platform/assignments/{tenantId}/{userId}/{role}', { params: { path: a } })),
  );

export const useAddTeamMember = () =>
  useMut((body: ApiBody<'/v1/platform/team', 'post'>) => unwrap(api.POST('/v1/platform/team', { body })));

export const usePatchTeamMember = () =>
  useMut((v: { id: string; body: ApiBody<'/v1/platform/team/{id}', 'patch'> }) =>
    unwrap(api.PATCH('/v1/platform/team/{id}', { params: { path: { id: v.id } }, body: v.body })),
  );

export const useCreatePlan = () =>
  useMut((body: ApiBody<'/v1/platform/plans', 'post'>) => unwrap(api.POST('/v1/platform/plans', { body })));

export const usePatchPlan = () =>
  useMut((v: { id: string; body: ApiBody<'/v1/platform/plans/{id}', 'patch'> }) =>
    unwrap(api.PATCH('/v1/platform/plans/{id}', { params: { path: { id: v.id } }, body: v.body })),
  );

export const useCreateLead = () =>
  useMut((body: ApiBody<'/v1/platform/leads', 'post'>) => unwrap(api.POST('/v1/platform/leads', { body })));

/** Optimistic kanban moves are handled by the page; this just persists the change. */
export const usePatchLead = () =>
  useMut((v: { id: string; body: ApiBody<'/v1/platform/leads/{id}', 'patch'> }) =>
    unwrap(api.PATCH('/v1/platform/leads/{id}', { params: { path: { id: v.id } }, body: v.body })),
  );

export const useAddLeadActivity = () =>
  useMut((v: { id: string; body: ApiBody<'/v1/platform/leads/{id}/activities', 'post'> }) =>
    unwrap(api.POST('/v1/platform/leads/{id}/activities', { params: { path: { id: v.id } }, body: v.body })),
  );

/** Logging a contact refreshes the board, the badge and the shop's timeline (all under the `platform` key). */
export const useAddTenantFollowup = (id: string) =>
  useMut((body: ApiBody<'/v1/platform/tenants/{id}/followups', 'post'>) =>
    unwrap(api.POST('/v1/platform/tenants/{id}/followups', { params: { path: { id } }, body })),
  );

export const useConvertLead = () =>
  useMut((v: { id: string; body: ApiBody<'/v1/platform/leads/{id}/convert', 'post'> }) =>
    unwrap(api.POST('/v1/platform/leads/{id}/convert', { params: { path: { id: v.id } }, body: v.body })),
  );

export const useCreateEngagement = () =>
  useMut((body: ApiBody<'/v1/platform/engagements', 'post'>) =>
    unwrap(api.POST('/v1/platform/engagements', { body })),
  );

export const usePatchEngagement = () =>
  useMut((v: { id: string; body: ApiBody<'/v1/platform/engagements/{id}', 'patch'> }) =>
    unwrap(api.PATCH('/v1/platform/engagements/{id}', { params: { path: { id: v.id } }, body: v.body })),
  );

export const useGenerateTasks = () =>
  useMut((id: string) =>
    unwrap(api.POST('/v1/platform/engagements/{id}/tasks/generate', { params: { path: { id } }, body: {} })),
  );

export const usePatchTask = () =>
  useMut((v: { id: string; body: ApiBody<'/v1/platform/engagement-tasks/{id}', 'patch'> }) =>
    unwrap(api.PATCH('/v1/platform/engagement-tasks/{id}', { params: { path: { id: v.id } }, body: v.body })),
  );

export const useCreateAudit = () =>
  useMut((body: ApiBody<'/v1/platform/audits', 'post'>) => unwrap(api.POST('/v1/platform/audits', { body })));

export const usePatchAudit = (id: string) =>
  useMut((body: ApiBody<'/v1/platform/audits/{id}', 'patch'>) =>
    unwrap(api.PATCH('/v1/platform/audits/{id}', { params: { path: { id } }, body })),
  );

export const useSaveScores = (id: string) =>
  useMut((body: ApiBody<'/v1/platform/audits/{id}/rubric-scores', 'post'>) =>
    unwrap(api.POST('/v1/platform/audits/{id}/rubric-scores', { params: { path: { id } }, body })),
  );

export const useAddFinding = (id: string) =>
  useMut((body: ApiBody<'/v1/platform/audits/{id}/findings', 'post'>) =>
    unwrap(api.POST('/v1/platform/audits/{id}/findings', { params: { path: { id } }, body })),
  );

export const useDeleteFinding = (id: string) =>
  useMut((findingId: string) =>
    unwrap(
      api.DELETE('/v1/platform/audits/{id}/findings/{findingId}', { params: { path: { id, findingId } } }),
    ),
  );

export const useSaveActionPlan = (id: string) =>
  useMut((body: ApiBody<'/v1/platform/audits/{id}/action-plan', 'put'>) =>
    unwrap(api.PUT('/v1/platform/audits/{id}/action-plan', { params: { path: { id } }, body })),
  );

export const useRequestReport = (id: string) =>
  useMut(() => unwrap(api.POST('/v1/platform/audits/{id}/report', { params: { path: { id } } })));

export const useCreateInvoice = () =>
  useMut((body: ApiBody<'/v1/platform/invoices', 'post'>) =>
    unwrap(api.POST('/v1/platform/invoices', { body })),
  );

export const usePatchInvoice = () =>
  useMut((v: { id: string; body: ApiBody<'/v1/platform/invoices/{id}', 'patch'> }) =>
    unwrap(api.PATCH('/v1/platform/invoices/{id}', { params: { path: { id: v.id } }, body: v.body })),
  );

export const useConfirmPayment = () =>
  useMut((id: string) =>
    unwrap(api.POST('/v1/platform/invoices/{id}/confirm-payment', { params: { path: { id } } })),
  );

export const useRejectSlip = () =>
  useMut((v: { id: string; note: string }) =>
    unwrap(
      api.POST('/v1/platform/invoices/{id}/reject-slip', {
        params: { path: { id: v.id } },
        body: { note: v.note },
      }),
    ),
  );

export const useGenerateInvoices = () =>
  useMut((month: string | undefined) =>
    unwrap(api.POST('/v1/platform/invoices/generate', { body: { month } })),
  );

/* ---------------- user accounts (ผู้ใช้งาน) ---------------- */
export type UserRow = ListItem<ApiData<'/v1/platform/users'>>;
export type UserDetail = ApiItem<'/v1/platform/users/{id}'>;
export type UsersQuery = NonNullable<
  NonNullable<import('@/lib/api-client').paths['/v1/platform/users']['get']['parameters']['query']>
>;
export type ResetPasswordBody = ApiBody<'/v1/platform/users/{id}/reset-password', 'post'>;

export const useUsers = (query: UsersQuery) =>
  useTenantQuery([part, 'users', query], () => unwrap(api.GET('/v1/platform/users', { params: { query } })), {
    placeholderData: (prev) => prev,
  });

export const useUser = (id: string | null) =>
  useTenantQuery(
    [part, 'users', 'detail', id],
    async () =>
      (await unwrap(api.GET('/v1/platform/users/{id}', { params: { path: { id: id as string } } }))).data,
    { enabled: id !== null },
  );

/** Account actions refresh the user list/detail only; their own error handling (specific Thai messages) lives in the dialogs. */
function useUserMut<TData, TVars>(fn: (v: TVars) => Promise<TData>) {
  const invalidate = useInvalidate();
  return useApiMutation<TData, TVars>({
    mutationFn: fn,
    onSuccess: () => invalidate(part, 'users'),
    onError: () => undefined,
  });
}

export const useResetUserPassword = () =>
  useUserMut((v: { id: string; body: ResetPasswordBody }) =>
    unwrap(
      api.POST('/v1/platform/users/{id}/reset-password', { params: { path: { id: v.id } }, body: v.body }),
    ),
  );

export const useCreateUserResetLink = () =>
  useUserMut((v: { id: string; reason: string }) =>
    unwrap(
      api.POST('/v1/platform/users/{id}/reset-link', {
        params: { path: { id: v.id } },
        body: { reason: v.reason },
      }),
    ),
  );

export const useRevokeUserSessions = () =>
  useUserMut((v: { id: string; reason: string }) =>
    unwrap(
      api.POST('/v1/platform/users/{id}/revoke-sessions', {
        params: { path: { id: v.id } },
        body: { reason: v.reason },
      }),
    ),
  );
