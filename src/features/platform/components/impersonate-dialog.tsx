import { ExternalLink, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useImpersonate } from '../api';
import { formatDateTime, useIntlLocale } from '../format';

const MIN_REASON = 10;

/**
 * docs/02 §2.3: view a shop as CoreUp staff. A reason is mandatory, the session lasts 60 minutes, and the shop's
 * owner sees the access in their history. Opens the shop back office (APP_URL) with the session token in the URL
 * fragment (never sent to a server).
 */
export function ImpersonateDialog({
  tenantId,
  tenantName,
  open,
  onOpenChange,
}: {
  tenantId: string;
  tenantName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('platform');
  const { t: tc } = useTranslation('common');
  const locale = useIntlLocale();
  const [reason, setReason] = useState('');
  const impersonate = useImpersonate(tenantId);
  const session = impersonate.data?.data;
  const valid = reason.trim().length >= MIN_REASON;

  const close = (next: boolean) => {
    if (!next) {
      setReason('');
      impersonate.reset();
    }
    onOpenChange(next);
  };

  const start = async () => {
    const res = await impersonate.mutateAsync({ reason: reason.trim() });
    window.open(res.data.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-warning" aria-hidden />
            {t('impersonate.title', { name: tenantName })}
          </DialogTitle>
          <DialogDescription>{t('impersonate.description')}</DialogDescription>
        </DialogHeader>
        {session ? (
          <div className="grid gap-3" role="status">
            <p className="text-sm">
              {t('impersonate.started', { until: formatDateTime(session.expiresAt, locale) })}
            </p>
            <Button asChild variant="outline">
              <a href={session.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> {t('impersonate.openAgain')}
              </a>
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="imp-reason">{t('impersonate.reason')}</Label>
            <Textarea
              id="imp-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('impersonate.reasonPlaceholder')}
              rows={3}
              maxLength={500}
            />
            <p
              className={`text-xs ${reason.length > 0 && !valid ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {t('impersonate.reasonHint', { min: MIN_REASON })}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            {session ? tc('close') : tc('cancel')}
          </Button>
          {session ? null : (
            <Button onClick={() => void start()} disabled={!valid || impersonate.isPending}>
              {impersonate.isPending ? t('impersonate.starting') : t('impersonate.start')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
