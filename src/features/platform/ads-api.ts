import { toast } from 'sonner';
import { useReasonMessage } from '@/features/reason-errors';
import { type ApiBody, type ApiItem, api, unwrap } from '@/lib/api';
import { useApiMutation, useInvalidate, useTenantQuery } from '@/lib/query';

export type AdsOverview = ApiItem<'/v1/platform/ads/overview'>;
export type AdsRow = AdsOverview['campaigns'][number]['ads'][number];
export type AdsStatus = ApiItem<'/v1/platform/ads/status'>;
export type AdsRecommendations = ApiItem<'/v1/platform/ads/recommendations'>;
export type AdsRecommendation = AdsRecommendations['items'][number];
export type AdsChat = AdsRecommendations['chats'][number];
export type AdsGoals = ApiItem<'/v1/platform/ads/goals'>;
export type AdsGoalTargets = AdsGoals['targets'];
export type AdsReportView = ApiItem<'/v1/platform/ads/report'>;

/** The Ads page is owner-only (spend + revenue); the API enforces it, `enabled` keeps other roles from asking. */
/** `fast` = a sync was just asked for: look every 3 s until the worker has picked it up and finished. */
export const useAdsStatus = (enabled: boolean, fast = false) =>
  useTenantQuery(
    ['platform', 'ads', 'status'],
    async () => (await unwrap(api.GET('/v1/platform/ads/status'))).data,
    {
      enabled,
      // a sync can be running: look again until it is done
      refetchInterval: (q) => (fast || q.state.data?.state === 'syncing' ? 3000 : 60_000),
    },
  );

export const useAdsOverview = (range: { from: string; to: string }, enabled: boolean) =>
  useTenantQuery(
    ['platform', 'ads', 'overview', range],
    async () => (await unwrap(api.GET('/v1/platform/ads/overview', { params: { query: range } }))).data,
    { enabled },
  );

export const useAdsRecommendations = (enabled: boolean) =>
  useTenantQuery(
    ['platform', 'ads', 'recommendations'],
    async () => (await unwrap(api.GET('/v1/platform/ads/recommendations'))).data,
    { enabled, refetchInterval: 5 * 60_000 },
  );

export const useAdsGoals = (month: string, enabled: boolean) =>
  useTenantQuery(
    ['platform', 'ads', 'goals', month],
    async () => (await unwrap(api.GET('/v1/platform/ads/goals', { params: { query: { month } } }))).data,
    { enabled },
  );

export const REPORT_POLL_MS = 4000;

/** `polling` = a report was just asked for: look every 4 s until it appears. */
export const useAdsReport = (enabled: boolean, polling = false) =>
  useTenantQuery(
    ['platform', 'ads', 'report'],
    async () => (await unwrap(api.GET('/v1/platform/ads/report'))).data,
    { enabled, refetchInterval: polling ? REPORT_POLL_MS : false },
  );

/** "Sync now": the worker pulls from Meta (read-only); the status poll shows when it is done. */
export function useAdsSync() {
  const invalidate = useInvalidate();
  const message = useReasonMessage();
  return useApiMutation({
    mutationFn: async () => (await unwrap(api.POST('/v1/platform/ads/sync'))).data,
    onSuccess: () => invalidate('platform', 'ads'),
    onError: (e) => toast.error(message(e)),
  });
}

export function useSaveAdsGoals() {
  const invalidate = useInvalidate();
  const message = useReasonMessage();
  return useApiMutation({
    mutationFn: async (body: ApiBody<'/v1/platform/ads/goals', 'put'>) =>
      (await unwrap(api.PUT('/v1/platform/ads/goals', { body }))).data,
    onSuccess: () => invalidate('platform', 'ads', 'goals'),
    onError: (e) => toast.error(message(e)),
  });
}

export function useAdsReportRequest() {
  const invalidate = useInvalidate();
  const message = useReasonMessage();
  return useApiMutation({
    mutationFn: async () => (await unwrap(api.POST('/v1/platform/ads/report'))).data,
    // the worker writes it some seconds later: the card polls until it shows up
    onSuccess: () => invalidate('platform', 'ads', 'report'),
    onError: (e) => toast.error(message(e)),
  });
}
