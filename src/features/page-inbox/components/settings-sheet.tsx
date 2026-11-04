import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { CopyButton } from '@/features/platform/components/user-actions';
import { useCan } from '@/lib/permissions';
import { type PageStatus, useConnectPage, usePatchSettings, useSyncPage } from '../api';
import { useChatTime } from '../lib/time';

function Setting({
  label,
  hint,
  checked,
  disabled,
  onChange,
  testId,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <div className="grid gap-1">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={label}
        data-testid={testId}
      />
    </div>
  );
}

/** The owner's side: what is connected, what to paste in the Meta dashboard, "sync now" and the two automatic switches (both OFF by default). */
export function SettingsSheet({
  open,
  onOpenChange,
  status,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  status: PageStatus;
}) {
  const { t } = useTranslation('pageInbox');
  const clock = useChatTime(t);
  const canManage = useCan('platform:manage');
  const connect = useConnectPage();
  const sync = useSyncPage();
  const patch = usePatchSettings();
  const s = status.settings;
  const save = (body: Parameters<typeof patch.mutate>[0]) =>
    patch.mutate(body, { onSuccess: () => toast.success(t('settings.saved')) });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(28rem,94vw)] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('settings.title')}</SheetTitle>
          <SheetDescription className="sr-only">{t('description')}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 p-4">
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">{t('settings.connected')}</dt>
              <dd className="font-medium">
                {s.pageName ?? '—'} <span className="text-xs text-muted-foreground">({s.pageId})</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t('settings.instagram')}</dt>
              <dd>{s.igName ? `@${s.igName}` : t('settings.noInstagram')}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t('settings.lastSync')}</dt>
              <dd>{s.lastSyncAt ? clock.full(s.lastSyncAt) : t('settings.never')}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t('settings.webhookUrl')}</dt>
              <dd className="flex items-center gap-2">
                <code className="min-w-0 flex-1 select-all break-all rounded border bg-muted px-2 py-1 text-xs">
                  {status.webhookUrl}
                </code>
                <CopyButton
                  value={status.webhookUrl}
                  label={t('settings.copy')}
                  copiedLabel={t('settings.copied')}
                />
              </dd>
            </div>
          </dl>
          {!status.tokenConfigured ? (
            <p className="rounded-lg bg-warning/10 p-2 text-xs text-warning">{t('setup.tokenMissing')}</p>
          ) : null}
          {!status.webhookConfigured ? (
            <p className="rounded-lg bg-warning/10 p-2 text-xs text-warning">{t('setup.webhookMissing')}</p>
          ) : null}
          {canManage ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!status.tokenConfigured || sync.isPending}
                  onClick={() =>
                    sync.mutate(undefined, { onSuccess: () => toast.success(t('settings.synced')) })
                  }
                >
                  {t('settings.sync')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!status.tokenConfigured || connect.isPending}
                  onClick={() => connect.mutate(undefined)}
                >
                  {t('settings.reconnect')}
                </Button>
              </div>
              <Setting
                label={t('settings.autoReply')}
                hint={t('settings.autoReplyHint')}
                checked={s.autoReply.enabled}
                disabled={patch.isPending}
                onChange={(v) => save({ autoReplyEnabled: v })}
                testId="switch-auto-reply"
              />
              <label className="grid gap-1 text-xs text-muted-foreground">
                {t('settings.maxPerDay')}
                <select
                  className="h-9 w-24 rounded-md border bg-background px-2 text-sm text-foreground"
                  value={s.autoReply.maxPerDay}
                  disabled={patch.isPending}
                  onChange={(e) => save({ autoReplyMaxPerDay: Number(e.target.value) })}
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <Setting
                label={t('settings.autoFollowUp')}
                hint={t('settings.autoFollowUpHint')}
                checked={s.autoFollowUp.enabled}
                disabled={patch.isPending}
                onChange={(v) => save({ autoFollowUpEnabled: v })}
                testId="switch-auto-followup"
              />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{t('settings.ownerOnly')}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
