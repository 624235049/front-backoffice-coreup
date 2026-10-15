import {
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type ApiError, isApiError } from '@/lib/api';
import { useSession } from '@/stores/session';

/**
 * Query keys are `[tenantId, ...parts]` so switching shop gives a separate cache automatically (docs/04 §7).
 * Include `branchId` in `parts` for branch-scoped data (the X-Branch-Id header follows the session store).
 *
 *   useTenantQuery(['customers', params], () => unwrap(api.GET('/v1/customers', { params: { query: params } })))
 */
export function useTenantQuery<T>(
  parts: readonly unknown[],
  fn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T, ApiError, T, QueryKey>, 'queryKey' | 'queryFn'>,
) {
  const tenantId = useSession((s) => s.tenantId);
  return useQuery<T, ApiError>({
    ...options,
    queryKey: [tenantId, ...parts],
    queryFn: fn,
    enabled: tenantId !== null && (options?.enabled ?? true),
  });
}

/** Invalidate everything under `[tenantId, ...parts]`. */
export function useInvalidate() {
  const qc = useQueryClient();
  const tenantId = useSession((s) => s.tenantId);
  return (...parts: unknown[]) => qc.invalidateQueries({ queryKey: [tenantId, ...parts] });
}

/** Human message for any thrown error: server message (already localised) or the i18n fallback by code. */
export function errorMessageOf(e: unknown, t: TFunction<'errors'>): string {
  if (isApiError(e)) {
    if (e.code === 'NETWORK') return t('NETWORK');
    return e.message && e.message !== e.code ? e.message : t(e.code, { defaultValue: t('UNKNOWN') });
  }
  return t('UNKNOWN');
}

export function useErrorMessage() {
  const { t } = useTranslation('errors');
  return (e: unknown): string => errorMessageOf(e, t);
}

/** Mutation that toasts the error by default. Pass `onError` to override. */
export function useApiMutation<TData, TVars>(options: UseMutationOptions<TData, ApiError, TVars>) {
  const msg = useErrorMessage();
  return useMutation<TData, ApiError, TVars>({
    onError: (e) => toast.error(msg(e)),
    ...options,
  });
}
