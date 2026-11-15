import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { useIssuePin, useSetIssuePin } from '../api';
import { PIN_PATTERN } from '../issue-pin';

const digits = (v: string) => v.replace(/\D/g, '');

function SetPinDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('platform');
  const save = useSetIssuePin();
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const reason = !PIN_PATTERN.test(pin)
    ? t('issuePin.card.errFormat')
    : pin !== again
      ? t('issuePin.card.errMismatch')
      : false;
  const submit = () => {
    if (reason || save.isPending) return;
    save.mutate(pin, {
      onSuccess: () => {
        toast.success(t('issuePin.card.saved'));
        onClose();
      },
    });
  };
  const field = (id: string, label: string, value: string, set: (v: string) => void) => (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        data-testid={id}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="new-password"
        maxLength={8}
        value={value}
        className="max-w-48 text-center text-lg tracking-[0.5em]"
        onChange={(e) => set(digits(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
      />
    </div>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t('common.close')} data-testid="set-issue-pin">
        <DialogHeader>
          <DialogTitle>{t('issuePin.card.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('issuePin.card.dialogHint')}</DialogDescription>
        </DialogHeader>
        {field('issue-pin-new', t('issuePin.card.new'), pin, setPin)}
        {field('issue-pin-again', t('issuePin.card.again'), again, setAgain)}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={save.isPending}
            blockedReason={reason}
            data-testid="set-issue-pin-save"
            onClick={submit}
          >
            {t('issuePin.card.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** platform_owner only: the PIN every team member types to issue a bill. Shows whether it is set, never the PIN. */
export function IssuePinCard() {
  const { t } = useTranslation('platform');
  const status = useIssuePin();
  const [editing, setEditing] = useState(false);
  return (
    <Card data-testid="issue-pin-card">
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">{t('issuePin.card.title')}</h2>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} data-testid="issue-pin-edit">
            <KeyRound /> {status.data?.isSet ? t('issuePin.card.change') : t('issuePin.card.set')}
          </Button>
        </div>
        <QueryState query={status}>
          {(s) => (
            <>
              <p className="flex items-center gap-2 text-sm">
                <Badge variant={s.isSet ? 'success' : 'outline'} data-testid="issue-pin-status">
                  {s.isSet ? t('issuePin.card.isSet') : t('issuePin.card.notSet')}
                </Badge>
                <span className="text-muted-foreground">{t('issuePin.card.about')}</span>
              </p>
              {s.isDefault ? (
                <p className="rounded-md bg-muted p-2 text-sm" role="alert" data-testid="issue-pin-default">
                  {t('issuePin.card.defaultHint')}
                </p>
              ) : null}
            </>
          )}
        </QueryState>
        {editing ? <SetPinDialog onClose={() => setEditing(false)} /> : null}
      </CardContent>
    </Card>
  );
}
