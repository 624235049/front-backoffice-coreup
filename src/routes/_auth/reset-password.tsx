import { createFileRoute } from '@tanstack/react-router';
import { ResetPasswordPage } from '@/features/auth/pages/reset-password-page';

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({
    token: typeof s.token === 'string' ? s.token : undefined,
  }),
  component: ResetPasswordPage,
});
