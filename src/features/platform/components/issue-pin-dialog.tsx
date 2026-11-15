import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { isIssuePinError, PIN_PATTERN, pinProblemOf } from '../issue-pin';

/**
 * The confirm step of every action that ISSUES a payment bill to a customer, with the team PIN on it (the API refuses
 * the issue without it). `onSubmit` must reject when the issue fails: a PIN problem is shown here with the attempts
 * left, anything else was already toasted by the mutation. Resolve → the caller closes the dialog.
 */
export function IssuePinDialog({
  testId,
  title,
  description,
  confirmLabel,
  blockedReason,
  onClose,
  onSubmit,
  children,
}: {
  testId: string;
  title: string;
  description: string;
  confirmLabel: string;
  blockedReason?: string | false;
  onClose: () => void;
  onSubmit: (pin: string) => Promise<unknown>;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation('platform');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fired = useRef(false); // a second click in the same frame must not issue twice
  const input = useRef<HTMLInputElement>(null);
  const valid = PIN_PATTERN.test(pin);

  const submit = async () => {
    if (!valid || fired.current) return;
    fired.current = true;
    setPending(true);
    setError(null);
    try {
      await onSubmit(pin);
    } catch (e) {
      if (isIssuePinError(e)) {
        const p = pinProblemOf(e);
        setError(t(`issuePin.${p.key}`, p));
        setPin('');
        input.current?.focus();
      }
    } finally {
      fired.current = false;
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        closeLabel={t('common.close')}
        className="max-h-[92dvh] overflow-y-auto"
        data-testid={testId}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <div className="grid gap-1.5">
          <Label htmlFor={`${testId}-pin`}>{t('issuePin.label')}</Label>
          <Input
            id={`${testId}-pin`}
            ref={input}
            data-testid={`${testId}-pin`}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={8}
            autoFocus
            value={pin}
            aria-invalid={error !== null}
            aria-describedby={`${testId}-pin-msg`}
            className="max-w-48 text-center text-lg tracking-[0.5em]"
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''));
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <p
            id={`${testId}-pin-msg`}
            data-testid={`${testId}-pin-msg`}
            role={error ? 'alert' : undefined}
            className={error ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'}
          >
            {error ?? t('issuePin.hint')}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={pending || !valid}
            blockedReason={blockedReason}
            data-testid={`${testId}-confirm`}
            onClick={() => void submit()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
