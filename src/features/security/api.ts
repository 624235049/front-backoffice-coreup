import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ApiBody, type ApiItem, api, unwrapData } from '@/lib/api';
import { meQueryKey } from '@/lib/me';
import { useApiMutation } from '@/lib/query';

export type TwoFactorStatus = ApiItem<'/v1/auth/2fa/status'>;
export type TwoFactorSetup = ApiItem<'/v1/auth/2fa/setup', 'post'>;

export const twoFactorStatusKey = ['two-factor', 'status'] as const;

/** Not tenant-scoped: the status belongs to the signed-in user. */
export function useTwoFactorStatus() {
  return useQuery({
    queryKey: twoFactorStatusKey,
    queryFn: () => unwrapData(api.GET('/v1/auth/2fa/status')),
  });
}

/** Wrong password etc. is toasted by `useApiMutation`. */
export function useSetupTwoFactor() {
  return useApiMutation({
    mutationFn: (password: string) => unwrapData(api.POST('/v1/auth/2fa/setup', { body: { password } })),
  });
}

/** Confirms the first authenticator code; the API renews the session cookie, so refresh /me too. */
export function useVerifyTwoFactorSetup() {
  const qc = useQueryClient();
  // the setup form shows the failure inline (wrong code) → no toast
  return useMutation({
    meta: { inlineError: true },
    mutationFn: (code: string) => unwrapData(api.POST('/v1/auth/2fa/verify-setup', { body: { code } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: twoFactorStatusKey });
      void qc.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}

export function useDisableTwoFactor() {
  const qc = useQueryClient();
  // the confirm dialog shows the failure inline
  return useMutation({
    meta: { inlineError: true },
    mutationFn: (password: string) => unwrapData(api.POST('/v1/auth/2fa/disable', { body: { password } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: twoFactorStatusKey }),
  });
}

export function useRegenerateBackupCodes() {
  return useApiMutation({
    mutationFn: (password: string) =>
      unwrapData(api.POST('/v1/auth/2fa/backup-codes', { body: { password } })),
  });
}

/** Second step of sign-in after `twoFactorRequired`. */
export function useTwoFactorChallenge() {
  const qc = useQueryClient();
  // the challenge form shows the failure inline
  return useMutation({
    meta: { inlineError: true },
    mutationFn: (body: ApiBody<'/v1/auth/2fa/challenge', 'post'>) =>
      unwrapData(api.POST('/v1/auth/2fa/challenge', { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: meQueryKey }),
  });
}
