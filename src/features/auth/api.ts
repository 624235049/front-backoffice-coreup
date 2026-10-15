import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { type ApiBody, api, unwrap } from '@/lib/api';
import { meQueryKey } from '@/lib/me';
import { useApiMutation } from '@/lib/query';

/** Email + password. On success the session cookie is set; refresh /me so the route guards see it. The sign-in, magic-link, forgot and reset forms show their failure inline (`meta.inlineError`): no toast. */
export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    meta: { inlineError: true },
    mutationFn: (body: ApiBody<'/v1/auth/sign-in/email', 'post'>) =>
      unwrap(api.POST('/v1/auth/sign-in/email', { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: meQueryKey }),
  });
}

export function useSignOut() {
  return useApiMutation({ mutationFn: () => unwrap(api.POST('/v1/auth/sign-out')) });
}

export function useRequestMagicLink() {
  return useMutation({
    meta: { inlineError: true },
    mutationFn: (body: ApiBody<'/v1/auth/sign-in/magic-link', 'post'>) =>
      unwrap(api.POST('/v1/auth/sign-in/magic-link', { body })),
  });
}

export function useForgotPassword() {
  return useMutation({
    meta: { inlineError: true },
    mutationFn: (body: ApiBody<'/v1/auth/password/forgot', 'post'>) =>
      unwrap(api.POST('/v1/auth/password/forgot', { body })),
  });
}

export function useResetPassword() {
  return useMutation({
    meta: { inlineError: true },
    mutationFn: (body: ApiBody<'/v1/auth/password/reset', 'post'>) =>
      unwrap(api.POST('/v1/auth/password/reset', { body })),
  });
}

/** Where to go after a successful sign-in (`redirect` search param, validated same-origin by the route). */
export function useAfterSignIn() {
  const router = useRouter();
  return (redirect?: string) => router.history.push(redirect ?? '/');
}
