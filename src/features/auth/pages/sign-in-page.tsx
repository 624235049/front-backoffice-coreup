import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAfterSignIn, useRequestMagicLink, useSignIn } from '@/features/auth/api';
import { AuthCard } from '@/features/auth/components/auth-card';
import { TwoFactorChallenge } from '@/features/security/components/two-factor-challenge';
import { isApiError } from '@/lib/api';
import { useInvalidToast } from '@/lib/form-errors';
import { useErrorMessage } from '@/lib/query';

const schema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('validation.email')),
  password: z.string().min(1, 'validation.required'),
});
type Values = z.infer<typeof schema>;

export function SignInPage() {
  const { t } = useTranslation('auth');
  const { redirect, error: queryError } = useSearch({ from: '/_auth/sign-in' });
  const errorMessage = useErrorMessage();
  const afterSignIn = useAfterSignIn();
  const signIn = useSignIn();
  const magic = useRequestMagicLink();
  const [failure, setFailure] = useState<unknown>(null);
  const invalid = useInvalidToast<Values>();
  // password accepted but the account has 2FA: the code screen finishes the sign-in
  const [needsCode, setNeedsCode] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      const res = await signIn.mutateAsync(values);
      if ('twoFactorRequired' in res.data) setNeedsCode(true);
      else afterSignIn(redirect);
    } catch (e) {
      setFailure(e);
    }
  }, invalid);

  const sendMagicLink = async () => {
    const ok = await form.trigger('email');
    if (ok) magic.mutate({ email: form.getValues('email') });
  };

  if (needsCode) {
    return (
      <AuthCard title={t('twoFactor.title')} description={t('twoFactor.description')}>
        <TwoFactorChallenge onSuccess={() => afterSignIn(redirect)} onCancel={() => setNeedsCode(false)} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('signIn.title')} description={t('signIn.description')}>
      <Form {...form}>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('email')}</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="username" inputMode="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('password')}</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {/* 400/401 = wrong email or password (the API does not say which: no account enumeration). */}
              {isApiError(failure) && (failure.status === 401 || failure.status === 400)
                ? t('signIn.failed')
                : errorMessage(failure)}
            </p>
          ) : queryError ? (
            <p role="alert" className="text-sm text-destructive">
              {t('signIn.failed')}
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={signIn.isPending}>
            {signIn.isPending ? t('signIn.submitting') : t('signIn.submit')}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="text-primary underline-offset-4 hover:underline">
              {t('forgotLink')}
            </Link>
            <button
              type="button"
              className="text-primary underline-offset-4 hover:underline disabled:opacity-50"
              onClick={sendMagicLink}
              disabled={magic.isPending}
            >
              {t('magicLink.send')}
            </button>
          </div>
          {magic.isSuccess ? (
            <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
              {t('magicLink.sent')}
            </p>
          ) : null}
          {magic.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {t('magicLink.failed')}
            </p>
          ) : null}
        </form>
      </Form>
    </AuthCard>
  );
}
