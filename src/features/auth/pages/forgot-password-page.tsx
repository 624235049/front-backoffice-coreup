import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForgotPassword } from '@/features/auth/api';
import { AuthCard } from '@/features/auth/components/auth-card';

const schema = z.object({ email: z.email('validation.email') });
type Values = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { t } = useTranslation('auth');
  const forgot = useForgotPassword();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  return (
    <AuthCard title={t('forgot.title')} description={t('forgot.description')}>
      {forgot.isSuccess ? (
        // Same message whether or not the email exists (no account enumeration).
        <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
          {t('forgot.sent')}
        </p>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => forgot.mutate(v))} className="grid gap-4" noValidate>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('email')}</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" inputMode="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {forgot.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {t('forgot.failed')}
              </p>
            ) : null}
            <Button type="submit" size="lg" disabled={forgot.isPending}>
              {t('forgot.submit')}
            </Button>
          </form>
        </Form>
      )}
      <Link
        to="/sign-in"
        search={{}}
        className="text-center text-sm text-primary underline-offset-4 hover:underline"
      >
        {t('backToSignIn')}
      </Link>
    </AuthCard>
  );
}
