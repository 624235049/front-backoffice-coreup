import { Check, Copy, Dices, KeyRound, Link2, LogOut, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { Textarea } from '@/components/ui/textarea';
import { useErrorMessage } from '@/lib/query';
import { cn } from '@/lib/utils';
import { type UserRow, useCreateUserResetLink, useResetUserPassword, useRevokeUserSessions } from '../api';
import { formatDateTime, useIntlLocale } from '../format';
import {
  buildPasswordMessage,
  buildResetLinkMessage,
  loginUrlFor,
  MAX_PASSWORD,
  MIN_REASON,
  passwordProblem,
  reasonReady,
  userActionError,
} from '../user-helpers';

/** The slice of a user row the account actions need. */
export type ActionUser = Pick<UserRow, 'id' | 'name' | 'email' | 'isTeam' | 'activeSessions'>;

export function CopyButton({
  value,
  label,
  copiedLabel,
  size = 'sm',
  variant = 'outline',
  className,
}: {
  value: string;
  label: string;
  copiedLabel: string;
  size?: 'sm' | 'icon-sm';
  variant?: 'outline' | 'ghost';
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      aria-label={label}
      title={label}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(
          () => {
            setCopied(true);
            toast.success(copiedLabel);
            setTimeout(() => setCopied(false), 2000);
          },
          () => toast.error(label),
        );
      }}
    >
      {copied ? <Check /> : <Copy />}
      {size === 'sm' ? label : null}
    </Button>
  );
}

function ReasonField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation('users');
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{t('reason.label')}</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('reason.placeholder')}
        rows={3}
        maxLength={500}
      />
      <p
        className={cn(
          'text-xs',
          value.length > 0 && !reasonReady(value) ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {t('reason.hint', { min: MIN_REASON })}
      </p>
    </div>
  );
}

function TeamWarning({ user }: { user: ActionUser }) {
  const { t } = useTranslation('users');
  if (!user.isTeam) return null;
  return (
    <p className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-sm text-warning" role="note">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {t('teamWarning')}
    </p>
  );
}

/** One place that turns an action failure into the right Thai message (specific 409 reasons, else the generic one). */
function useActionErrorToast() {
  const { t } = useTranslation('users');
  const msg = useErrorMessage();
  return (e: unknown) => {
    const known = userActionError(e);
    toast.error(known ? t(`error.${known}`) : msg(e));
  };
}

function ShownOnce({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const { t } = useTranslation('users');
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <code
          className={cn(
            'min-w-0 flex-1 select-all break-all rounded-md border bg-muted px-3 py-2 text-base',
            mono && 'font-mono tracking-wide',
          )}
        >
          {value}
        </code>
        <CopyButton value={value} label={t('copy')} copiedLabel={t('copied')} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- reset password */

type Mode = 'generate' | 'typed';

export function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: ActionUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const reset = useResetUserPassword();
  const onError = useActionErrorToast();
  const [mode, setMode] = useState<Mode>('generate');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  /** Kept in component state only while the dialog is open: shown once, never persisted. */
  const [done, setDone] = useState<{ password: string; revoked: number } | null>(null);

  const problem = mode === 'typed' && password.length > 0 ? passwordProblem(password) : null;
  const blockedReason = !reasonReady(reason)
    ? t('reason.needed', { min: MIN_REASON })
    : mode === 'typed' && password.length === 0
      ? t('reset.typeFirst')
      : problem
        ? t(`reset.problem.${problem}`)
        : null;
  const email = user.email ?? '';

  const close = (next: boolean) => {
    if (!next) {
      setMode('generate');
      setPassword('');
      setReason('');
      setDone(null);
      reset.reset();
    }
    onOpenChange(next);
  };

  const submit = () =>
    reset.mutate(
      {
        id: user.id,
        body:
          mode === 'generate'
            ? { generate: true, reason: reason.trim() }
            : { password, reason: reason.trim() },
      },
      {
        onSuccess: (res) =>
          setDone({ password: res.data.password ?? password, revoked: res.data.revokedSessions }),
        onError,
      },
    );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent closeLabel={tc('close')}>
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="size-5 text-success" aria-hidden />
                {t('reset.doneTitle')}
              </DialogTitle>
              <DialogDescription>{t('reset.doneHint', { count: done.revoked })}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4" role="status">
              <ShownOnce label={t('reset.newPassword')} value={done.password} />
              <div className="grid gap-1.5">
                <Label htmlFor="reset-msg">{t('reset.messageLabel')}</Label>
                <Textarea
                  id="reset-msg"
                  readOnly
                  rows={8}
                  value={buildPasswordMessage({
                    email,
                    password: done.password,
                    loginUrl: loginUrlFor(user, window.location.origin),
                  })}
                />
                <CopyButton
                  value={buildPasswordMessage({
                    email,
                    password: done.password,
                    loginUrl: loginUrlFor(user, window.location.origin),
                  })}
                  label={t('reset.copyMessage')}
                  copiedLabel={t('copied')}
                  className="w-fit"
                />
              </div>
              <p className="flex items-start gap-2 text-sm text-warning">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t('reset.onceWarning')}
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => close(false)}>{t('reset.doneClose')}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="size-5" aria-hidden />
                {t('reset.title', { name: user.name })}
              </DialogTitle>
              <DialogDescription>{t('reset.description', { email: user.email ?? '–' })}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <TeamWarning user={user} />
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('reset.modeLabel')}>
                {(['generate', 'typed'] as const).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    variant={mode === m ? 'default' : 'outline'}
                    onClick={() => setMode(m)}
                  >
                    {m === 'generate' ? <Dices /> : <KeyRound />}
                    {t(`reset.mode.${m}`)}
                  </Button>
                ))}
              </div>
              {mode === 'generate' ? (
                <p className="text-sm text-muted-foreground">{t('reset.generateHint')}</p>
              ) : (
                <div className="grid gap-1.5">
                  <Label htmlFor="reset-pw">{t('reset.newPassword')}</Label>
                  <Input
                    id="reset-pw"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={MAX_PASSWORD + 1}
                  />
                  <p className={cn('text-xs', problem ? 'text-destructive' : 'text-muted-foreground')}>
                    {t('reset.passwordHint')}
                  </p>
                </div>
              )}
              <ReasonField id="reset-reason" value={reason} onChange={setReason} />
              <p className="text-xs text-muted-foreground">{t('reset.sideEffects')}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)} disabled={reset.isPending}>
                {tc('cancel')}
              </Button>
              <Button onClick={submit} disabled={reset.isPending} blockedReason={blockedReason}>
                {reset.isPending ? t('working') : t('reset.confirm')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- reset link */

export function ResetLinkDialog({
  user,
  open,
  onOpenChange,
}: {
  user: ActionUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const locale = useIntlLocale();
  const create = useCreateUserResetLink();
  const onError = useActionErrorToast();
  const [reason, setReason] = useState('');
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);

  const close = (next: boolean) => {
    if (!next) {
      setReason('');
      setLink(null);
      create.reset();
    }
    onOpenChange(next);
  };

  const message = link
    ? buildResetLinkMessage({
        email: user.email ?? '',
        url: link.url,
        expiresAtLabel: formatDateTime(link.expiresAt, locale),
      })
    : '';

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-5" aria-hidden />
            {t('link.title', { name: user.name })}
          </DialogTitle>
          <DialogDescription>{t('link.description')}</DialogDescription>
        </DialogHeader>
        {link ? (
          <div className="grid gap-4" role="status">
            <ShownOnce label={t('link.url')} value={link.url} mono={false} />
            <p className="text-sm text-muted-foreground">
              {t('link.expires', { at: formatDateTime(link.expiresAt, locale) })}
            </p>
            <div className="grid gap-1.5">
              <Label htmlFor="link-msg">{t('reset.messageLabel')}</Label>
              <Textarea id="link-msg" readOnly rows={8} value={message} />
              <CopyButton
                value={message}
                label={t('reset.copyMessage')}
                copiedLabel={t('copied')}
                className="w-fit"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <TeamWarning user={user} />
            <ReasonField id="link-reason" value={reason} onChange={setReason} />
            <p className="text-xs text-muted-foreground">{t('link.sideEffects')}</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={create.isPending}>
            {link ? tc('close') : tc('cancel')}
          </Button>
          {link ? null : (
            <Button
              disabled={create.isPending}
              blockedReason={!reasonReady(reason) && t('reason.needed', { min: MIN_REASON })}
              onClick={() =>
                create.mutate(
                  { id: user.id, reason: reason.trim() },
                  { onSuccess: (res) => setLink(res.data), onError },
                )
              }
            >
              {create.isPending ? t('working') : t('link.confirm')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- revoke sessions */

export function RevokeSessionsDialog({
  user,
  open,
  onOpenChange,
}: {
  user: ActionUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const revoke = useRevokeUserSessions();
  const onError = useActionErrorToast();
  const [reason, setReason] = useState('');

  const close = (next: boolean) => {
    if (!next) {
      setReason('');
      revoke.reset();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="size-5" aria-hidden />
            {t('revoke.title', { name: user.name })}
          </DialogTitle>
          <DialogDescription>{t('revoke.description', { count: user.activeSessions })}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <TeamWarning user={user} />
          <ReasonField id="revoke-reason" value={reason} onChange={setReason} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={revoke.isPending}>
            {tc('cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={revoke.isPending}
            blockedReason={!reasonReady(reason) && t('reason.needed', { min: MIN_REASON })}
            onClick={() =>
              revoke.mutate(
                { id: user.id, reason: reason.trim() },
                {
                  onSuccess: (res) => {
                    toast.success(t('revoke.done', { count: res.data.revokedSessions }));
                    close(false);
                  },
                  onError,
                },
              )
            }
          >
            {revoke.isPending ? t('working') : t('revoke.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
