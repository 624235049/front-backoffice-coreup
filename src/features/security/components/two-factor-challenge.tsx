import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTwoFactorChallenge } from '@/features/security/api';
import { isApiError } from '@/lib/api';
import { useErrorMessage } from '@/lib/query';

/** Authenticator code (or a backup code) after the password step; the API answers with the session cookie. */
export function TwoFactorChallenge({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const { t } = useTranslation('security');
  const errorMessage = useErrorMessage();
  const challenge = useTwoFactorChallenge();
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await challenge.mutateAsync({ code: code.trim(), backup, trustDevice });
      onSuccess();
    } catch {
      setCode('');
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <p className="text-sm text-muted-foreground">
        {backup ? t('challenge.backupHint') : t('challenge.hint')}
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="otp">{backup ? t('challenge.backupLabel') : t('challenge.label')}</Label>
        <Input
          id="otp"
          autoFocus
          autoComplete="one-time-code"
          inputMode={backup ? 'text' : 'numeric'}
          maxLength={backup ? 24 : 6}
          className="text-center text-xl tracking-widest"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={trustDevice}
          onChange={(e) => setTrustDevice(e.target.checked)}
          className="size-4"
        />
        {t('challenge.trust')}
      </label>
      {challenge.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {isApiError(challenge.error) && challenge.error.code === 'TWO_FACTOR_INVALID'
            ? t('challenge.invalid')
            : errorMessage(challenge.error)}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={challenge.isPending}
        blockedReason={code.trim().length < 6 && t('challenge.codeNeeded')}
      >
        {t('challenge.submit')}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          className="text-primary underline-offset-4 hover:underline"
          onClick={() => {
            setBackup((b) => !b);
            setCode('');
          }}
        >
          {backup ? t('challenge.useApp') : t('challenge.useBackup')}
        </button>
        <button
          type="button"
          className="text-muted-foreground underline-offset-4 hover:underline"
          onClick={onCancel}
        >
          {t('challenge.cancel')}
        </button>
      </div>
    </form>
  );
}
