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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useImpersonate, useTenantBranches } from '../api';
import { formatDateTime, useIntlLocale } from '../format';

const MIN_REASON = 10;
const WHOLE_SHOP = 'all';

/**
 * docs/02 §2.3: view a shop as CoreUp staff. A reason is mandatory, the session lasts 60 minutes, and the shop's
 * owner sees the access in their history. Opens the shop back office (APP_URL) with the session token in the URL
 * fragment (never sent to a server), on the chosen branch (or the whole shop). The shop signs the CoreUp user in by
 * the token alone: no shop e-mail / password is involved.
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
  const [branchId, setBranchId] = useState(WHOLE_SHOP);
  const [blocked, setBlocked] = useState(false);
  const impersonate = useImpersonate(tenantId);
  const branches = useTenantBranches(tenantId, open).data ?? [];
  const session = impersonate.data?.data;
  const valid = reason.trim().length >= MIN_REASON;
  const openedBranch = branches.find((b) => b.id === session?.branchId);

  const close = (next: boolean) => {
    if (!next) {
      setReason('');
      setBranchId(WHOLE_SHOP);
      setBlocked(false);
      impersonate.reset();
    }
    onOpenChange(next);
  };

  const start = async () => {
    // Open the tab inside the click (before the request) so popup blockers allow it, then point it at the shop.
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    try {
      const res = await impersonate.mutateAsync({
        reason: reason.trim(),
        ...(branchId === WHOLE_SHOP ? {} : { branchId }),
      });
      if (tab) tab.location.replace(res.data.url);
      else setBlocked(true);
    } catch {
      tab?.close(); // the error toast comes from the mutation
    }
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
              {blocked
                ? t('impersonate.popupBlocked')
                : openedBranch
                  ? t('impersonate.startedBranch', {
                      branch: openedBranch.name,
                      until: formatDateTime(session.expiresAt, locale),
                    })
                  : t('impersonate.started', { until: formatDateTime(session.expiresAt, locale) })}
            </p>
            <Button asChild variant="outline">
              <a href={session.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> {t('impersonate.openAgain')}
              </a>
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            {branches.length > 1 ? (
              <>
                <Label htmlFor="imp-branch">{t('impersonate.branch')}</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger id="imp-branch" className="mb-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WHOLE_SHOP}>{t('impersonate.allBranches')}</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : null}
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
