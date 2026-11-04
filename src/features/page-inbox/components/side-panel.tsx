import { Link } from '@tanstack/react-router';
import { Store } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useTenants } from '@/features/platform/api';
import { OnboardDialog } from '@/features/platform/components/onboard-dialog';
import { useCan } from '@/lib/permissions';
import type { PageConversation, PageShopType } from '../api';
import { useLinkTenant } from '../api';
import { useChatTime } from '../lib/time';
import { StageChip } from './thread-list';

/** What the dress / salon / massage / barber lead most likely wants as a trial shop (the template keys of the onboarding dialog). */
const INDUSTRY: Record<PageShopType, string> = {
  dress: 'dress_rental',
  salon: 'salon',
  massage: 'spa',
  barber: 'barber',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/**
 * Right column: where the customer came from (the ad), their stage and send deadlines, and the shop that was opened for them:
 * "เปิดร้านทดลอง" reuses the team's onboarding dialog (the real create-shop flow) and links the new shop to this chat and its lead;
 * an existing shop can be linked by hand.
 */
export function SidePanel({ conversation: c }: { conversation: PageConversation }) {
  const { t } = useTranslation('pageInbox');
  const clock = useChatTime(t);
  const canWrite = useCan('platform:write');
  const link = useLinkTenant();
  const [onboard, setOnboard] = useState(false);
  const [pick, setPick] = useState('');
  const shops = useTenants({ limit: 200 } as never);
  const linkTo = (tenantId: string) =>
    link.mutate({ id: c.id, tenantId }, { onSuccess: () => toast.success(t('side.linked')) });
  return (
    <aside
      className="hidden w-[17rem] shrink-0 overflow-y-auto border-l bg-[var(--card)] p-3 lg:block"
      data-testid="side-panel"
    >
      <h2 className="mb-3 text-sm font-semibold">{t('side.title')}</h2>
      <dl className="grid gap-3">
        <Row label={t('side.stage')}>
          <StageChip stage={c.stage} />
        </Row>
        <Row label={t('side.ad')}>
          {c.adId ? (
            <code className="break-all text-xs">{c.adId}</code>
          ) : (
            <span className="text-muted-foreground">{t('side.adNone')}</span>
          )}
        </Row>
        <Row label={t('side.type')}>{c.shopType ? t(`shopType.${c.shopType}`) : t('shopType.unknown')}</Row>
        <Row label={t('side.lastMessage')}>
          {c.lastCustomerMessageAt ? clock.full(c.lastCustomerMessageAt) : '—'}
        </Row>
        <Row label={t('side.freeEnds')}>{c.windowFreeEndsAt ? clock.full(c.windowFreeEndsAt) : '—'}</Row>
        <Row label={t('side.humanEnds')}>{c.windowHumanEndsAt ? clock.full(c.windowHumanEndsAt) : '—'}</Row>
        <Row label={t('side.shop')}>
          {c.tenantId ? (
            <Link
              to="/platform/tenants/$id"
              params={{ id: c.tenantId }}
              className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
            >
              <Store className="size-3.5" aria-hidden />
              {c.tenantName ?? t('side.openShop')}
            </Link>
          ) : (
            <span className="text-muted-foreground">{t('side.noShop')}</span>
          )}
        </Row>
      </dl>
      {!c.tenantId && canWrite ? (
        <div className="mt-4 grid gap-2">
          <Button type="button" onClick={() => setOnboard(true)} data-testid="create-trial">
            {t('side.createTrial')}
          </Button>
          <div className="grid gap-1.5 rounded-lg border p-2">
            <label htmlFor="link-shop" className="text-xs text-muted-foreground">
              {t('side.linkExisting')}
            </label>
            <select
              id="link-shop"
              className="h-9 rounded-md border bg-background px-2 text-xs"
              value={pick}
              onChange={(e) => setPick(e.target.value)}
            >
              <option value="">{t('side.pickShop')}</option>
              {(shops.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!pick || link.isPending}
              onClick={() => linkTo(pick)}
            >
              {t('side.link')}
            </Button>
          </div>
        </div>
      ) : null}
      <OnboardDialog
        open={onboard}
        onOpenChange={setOnboard}
        defaults={{ name: c.name ?? '', industryKey: c.shopType ? INDUSTRY[c.shopType] : undefined }}
        onCreated={(tenantId) => linkTo(tenantId)}
      />
    </aside>
  );
}
