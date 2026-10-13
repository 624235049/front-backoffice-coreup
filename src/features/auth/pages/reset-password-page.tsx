import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useResetPassword } from '@/features/auth/api';
import { AuthCard } from '@/features/auth/components/auth-card';

const schema = z
  .object({
    newPassword: z.string().min(8, 'validation.passwordMin'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'validation.passwordMismatch' });
type Values = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const { t } = useTranslation('auth');
  const { token } = useSearch({ from: '/_auth/reset-password' });
  const navigate = useNavigate();
  const reset = useResetPassword();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirm: '' },
  });

  if (!token) {
    return (
      <AuthCard title={t('reset.title')}>
        <p role="alert" className="text-sm text-destructive">
          {t('reset.missingToken')}
        </p>
        <Link
          to="/forgot-password"
          className="text-center text-sm text-primary underline-offset-4 hover:underline"
        >
          {t('forgotLink')}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('reset.title')} description={t('reset.description')}>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(async (v) => {
            await reset.mutateAsync({ token, newPassword: v.newPassword }).then(
              () => {
                toast.success(t('reset.done'));
                void navigate({ to: '/sign-in', search: {} });
              },
              () => undefined,
            );
          })}
          className="grid gap-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('reset.newPassword')}</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('reset.confirm')}</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {reset.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {t('reset.failed')}
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={reset.isPending}>
            {t('reset.submit')}
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
