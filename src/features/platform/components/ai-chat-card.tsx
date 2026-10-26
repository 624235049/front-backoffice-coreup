import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useCan } from '@/lib/permissions';
import { type AiChatAdmin, useAiChatAdmin, useAiChatTopup, usePatchAiChatAdmin } from '../ai-chat-api';
import { useAddons } from '../api';
import { formatMoney, useIntlLocale } from '../format';

/** Tenant detail › "AI ตอบแชท": switch the add-on on a shop, set its quota, add a ฿290 top-up, see usage and cost. */
/** Add-on prices as the admin edited them, formatted for the card texts. */
export function useAddonParams() {
  const locale = useIntlLocale();
  const ai = useAddons().data?.settings.aiChat;
  return ai
    ? {
        monthly: formatMoney(ai.monthlyMinor, locale),
        included: ai.includedMessages.toLocaleString(locale),
        topup: formatMoney(ai.topupMinor, locale),
        topupMessages: ai.topupMessages.toLocaleString(locale),
      }
    : { monthly: '', included: '', topup: '', topupMessages: '' };
}

export function AiChatCard({ id }: { id: string }) {
  const { t } = useTranslation('platform');
  const price = useAddonParams();
  const q = useAiChatAdmin(id);
  return (
    <Card data-testid="ai-chat-card">
      <CardHeader>
        <CardTitle className="text-base">{t('aiChat.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('aiChat.hint', price)}</p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <QueryState query={q}>{(d) => <Body id={id} d={d} />}</QueryState>
      </CardContent>
    </Card>
  );
}

function Body({ id, d }: { id: string; d: AiChatAdmin }) {
  const { t } = useTranslation('platform');
  const price = useAddonParams();
  const locale = useIntlLocale();
  const canWrite = useCan('platform:write');
  const patch = usePatchAiChatAdmin(id);
  const topup = useAiChatTopup(id);
  const [quota, setQuota] = useState(String(d.monthlyQuota));
  const [confirmTopup, setConfirmTopup] = useState(false);
  const quotaValue = /^\d+$/.test(quota.trim()) ? Number(quota.trim()) : null;
  const n = (v: number) => v.toLocaleString(locale);

  return (
    <>
      {d.available ? null : (
        <p role="status" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          {t('aiChat.noKey')}
        </p>
      )}

      <label htmlFor="ai-chat-active" className="flex min-h-11 items-start gap-2 text-sm">
        <Checkbox
          id="ai-chat-active"
          className="mt-0.5"
          checked={d.active}
          disabled={!canWrite || patch.isPending}
          onCheckedChange={(on) =>
            patch.mutate(
              { active: on === true },
              {
                onSuccess: () =>
                  toast.success(t(on === true ? 'aiChat.enabledToast' : 'aiChat.disabledToast')),
              },
            )
          }
        />
        <span className="grid gap-0.5">
          <span className="flex flex-wrap items-center gap-2 font-medium">
            {t('aiChat.active')}
            {d.active ? (
              <Badge variant="outline">{d.shopEnabled ? t('aiChat.shopOn') : t('aiChat.shopOff')}</Badge>
            ) : null}
          </span>
          <span className="text-xs text-muted-foreground">{t('aiChat.activeHint', price)}</span>
        </span>
      </label>

      {d.active ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label htmlFor="ai-chat-quota" className="grid gap-1 text-sm">
              <span className="font-medium">{t('aiChat.quota')}</span>
              <Input
                id="ai-chat-quota"
                inputMode="numeric"
                className="w-32"
                value={quota}
                disabled={!canWrite}
                onChange={(e) => setQuota(e.target.value)}
              />
            </label>
            <Button
              variant="outline"
              disabled={!canWrite || patch.isPending || quotaValue === null || quotaValue === d.monthlyQuota}
              onClick={() =>
                quotaValue !== null &&
                patch.mutate(
                  { monthlyQuota: quotaValue },
                  { onSuccess: () => toast.success(t('aiChat.saved')) },
                )
              }
            >
              {t('aiChat.save')}
            </Button>
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-2" data-testid="ai-chat-usage">
            <Row label={t('aiChat.used', { month: d.month })}>
              <span className={d.state === 'ok' ? '' : 'font-semibold text-destructive'}>
                {n(d.used)} / {n(d.quota)}
              </span>
            </Row>
            <Row label={t('aiChat.topups')}>{n(d.topupMessages)}</Row>
            <Row label={t('aiChat.tokens')}>
              {n(d.inputTokens)} / {n(d.outputTokens)}
            </Row>
            <Row label={t('aiChat.cost')}>
              {d.costEstimateMinor === null ? t('aiChat.noPrice') : formatMoney(d.costEstimateMinor, locale)}
            </Row>
          </dl>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={!canWrite || topup.isPending}
              onClick={() => setConfirmTopup(true)}
            >
              {t('aiChat.topupAction', price)}
            </Button>
            {d.topupRequested ? <Badge>{t('aiChat.requested')}</Badge> : null}
            {d.pendingTopups > 0 ? (
              <span className="text-xs text-muted-foreground">
                {t('aiChat.pendingTopups', { count: d.pendingTopups })}
              </span>
            ) : null}
          </div>
          <ConfirmDialog
            open={confirmTopup}
            onOpenChange={setConfirmTopup}
            title={t('aiChat.topupConfirmTitle', price)}
            description={t('aiChat.topupConfirmBody', price)}
            confirmLabel={t('aiChat.topupConfirm')}
            pending={topup.isPending}
            onConfirm={() =>
              topup.mutate(undefined, {
                onSuccess: () => {
                  setConfirmTopup(false);
                  toast.success(t('aiChat.topupDone'));
                },
              })
            }
          />
        </>
      ) : null}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  );
}
