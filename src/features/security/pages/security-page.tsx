import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type TwoFactorSetup,
  type TwoFactorStatus,
  useDisableTwoFactor,
  useRegenerateBackupCodes,
  useSetupTwoFactor,
  useTwoFactorStatus,
  useVerifyTwoFactorSetup,
} from '@/features/security/api';
import { isApiError } from '@/lib/api';
import { useErrorMessage } from '@/lib/query';

export function SecurityPage() {
  const { t } = useTranslation('security');
  const status = useTwoFactorStatus();
  return (
    <>
      <PageHeader title={t('page.title')} description={t('page.description')} />
      <QueryState query={status}>{(s) => <TwoFactorCard status={s} />}</QueryState>
    </>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  const { t } = useTranslation('security');
  const text = codes.join('\n');
  return (
    <div className="grid gap-2 rounded-lg border bg-muted/40 p-4" data-testid="backup-codes">
      <p className="text-sm font-medium">{t('setup.backupTitle')}</p>
      <p className="text-xs text-muted-foreground">{t('setup.backupHint')}</p>
      <ul className="grid grid-cols-2 gap-1 font-mono text-sm">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void navigator.clipboard.writeText(text).then(() => toast.success(t('setup.copied')))
          }
        >
          {t('setup.copy')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'coreup-backup-codes.txt';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          {t('setup.download')}
        </Button>
      </div>
    </div>
  );
}

function TwoFactorCard({ status }: { status: TwoFactorStatus }) {
  const { t } = useTranslation('security');
  const errorMessage = useErrorMessage();
  const setup = useSetupTwoFactor();
  const verify = useVerifyTwoFactorSetup();
  const disable = useDisableTwoFactor();
  const regenerate = useRegenerateBackupCodes();
  const [password, setPassword] = useState('');
  const [material, setMaterial] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');
  const [dialog, setDialog] = useState<'disable' | 'codes' | null>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  return (
    <div className="grid max-w-xl gap-4">
      {status.setupNeeded ? (
        <p
          role="alert"
          className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          {t('page.required')}
        </p>
      ) : null}

      <section
        className="grid gap-4 rounded-xl border bg-card p-5 shadow-xs"
        aria-label={t('page.cardTitle')}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t('page.cardTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('page.cardHint')}</p>
          </div>
          <Badge variant={status.enabled ? 'success' : 'outline'}>
            {status.enabled ? t('page.enabled') : t('page.disabled')}
          </Badge>
        </div>

        {status.enabled ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPassword('');
                setDialog('codes');
              }}
            >
              {t('page.newCodes')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPassword('');
                setDialog('disable');
              }}
            >
              {t('page.disable')}
            </Button>
          </div>
        ) : material ? (
          <div className="grid gap-4">
            <ol className="grid gap-1 text-sm text-muted-foreground">
              <li>1. {t('setup.step1')}</li>
              <li>2. {t('setup.step2')}</li>
            </ol>
            <div className="flex flex-wrap items-start gap-4">
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <QRCodeSVG value={material.totpUri} size={176} level="M" title={t('setup.qr')} />
              </div>
              <div className="grid min-w-0 flex-1 gap-1 text-sm">
                <span className="text-muted-foreground">{t('setup.manual')}</span>
                <code className="break-all rounded bg-muted px-2 py-1" data-testid="totp-secret">
                  {material.secret}
                </code>
              </div>
            </div>
            <BackupCodes codes={material.backupCodes} />
            <form
              className="grid gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setVerifyError(null);
                try {
                  await verify.mutateAsync(code.trim());
                  setMaterial(null);
                  setCode('');
                  toast.success(t('setup.done'));
                } catch (err) {
                  setVerifyError(
                    isApiError(err) && err.code === 'TWO_FACTOR_INVALID'
                      ? t('challenge.invalid')
                      : errorMessage(err),
                  );
                }
              }}
            >
              <Label htmlFor="verify-code">{t('setup.codeLabel')}</Label>
              <div className="flex gap-2">
                <Input
                  id="verify-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="w-40 text-center text-lg tracking-widest"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <Button
                  type="submit"
                  disabled={verify.isPending}
                  blockedReason={code.trim().length < 6 && t('setup.codeNeeded')}
                >
                  {t('setup.confirm')}
                </Button>
              </div>
              {verifyError ? (
                <p role="alert" className="text-sm text-destructive">
                  {verifyError}
                </p>
              ) : null}
            </form>
          </div>
        ) : (
          <form
            className="grid max-w-sm gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const m = await setup.mutateAsync(password).catch(() => null);
              if (m) {
                setMaterial(m);
                setPassword('');
              }
            }}
          >
            <Label htmlFor="setup-password">{t('setup.password')}</Label>
            <Input
              id="setup-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('setup.passwordHint')}</p>
            <div>
              <Button
                type="submit"
                disabled={setup.isPending}
                blockedReason={!password && t('setup.passwordNeeded')}
              >
                <ShieldCheck className="size-4" aria-hidden />
                {t('page.enable')}
              </Button>
            </div>
          </form>
        )}
      </section>

      <Dialog
        open={dialog !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDialog(null);
            setNewCodes(null);
          }
        }}
      >
        <DialogContent closeLabel={t('challenge.cancel')}>
          <DialogHeader>
            <DialogTitle>{dialog === 'disable' ? t('page.disable') : t('page.newCodes')}</DialogTitle>
            <DialogDescription>
              {dialog === 'disable' ? t('page.disableHint') : t('page.newCodesHint')}
            </DialogDescription>
          </DialogHeader>
          {newCodes ? (
            <BackupCodes codes={newCodes} />
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="confirm-password">{t('setup.password')}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              {disable.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {isApiError(disable.error) && disable.error.status === 403
                    ? t('page.cannotDisable')
                    : errorMessage(disable.error)}
                </p>
              ) : null}
            </div>
          )}
          {newCodes ? null : (
            <DialogFooter>
              <Button
                variant={dialog === 'disable' ? 'destructive' : 'default'}
                disabled={disable.isPending || regenerate.isPending}
                blockedReason={!password && t('setup.passwordNeeded')}
                onClick={async () => {
                  if (dialog === 'disable') {
                    const ok = await disable
                      .mutateAsync(password)
                      .then(() => true)
                      .catch(() => false);
                    if (ok) setDialog(null);
                  } else {
                    const r = await regenerate.mutateAsync(password).catch(() => null);
                    if (r) setNewCodes(r.backupCodes);
                  }
                }}
              >
                {t('setup.confirm')}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
