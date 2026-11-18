import { Link } from '@tanstack/react-router';
import { Store, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useDebounced } from '@/features/accounting/lib/use-debounced';
import { useShopPicker } from '@/features/platform/api';
import { OnboardDialog } from '@/features/platform/components/onboard-dialog';
import { useCan } from '@/lib/permissions';
import type { PageConversation, PageDetail, PageNote, PageShopType } from '../api';
import { useAddNote, useLinkTenant, useSetShop, useShopSearch } from '../api';
import { useChatTime } from '../lib/time';
import { ChannelIcon } from './channel-icon';
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

const panelCls =
  'w-full shrink-0 overflow-y-auto border-l bg-[var(--card)] p-3 max-lg:min-h-0 max-lg:flex-1 lg:w-[17rem]';

/**
 * "ร้านที่เกี่ยวข้อง": the shop this chat is about. Search our customer shops by name or slug and link one, or type the name of a shop
 * that is not a customer yet (a prospect). The shop name also shows on the list row; the AI's verified shop is prefilled.
 */
function ShopSection({ conversation: c }: { conversation: PageConversation }) {
  const { t } = useTranslation('pageInbox');
  const [text, setText] = useState('');
  const q = useDebounced(text.trim(), 300);
  const found = useShopSearch(q);
  const set = useSetShop();
  const shop = c.shop;
  const save = (tenantId: string | null, shopName: string | null) =>
    set.mutate({ id: c.id, tenantId, shopName }, { onSuccess: () => setText('') });
  return (
    <section className="mt-4 grid gap-2 border-t pt-3" data-testid="shop-section">
      <h3 className="text-sm font-semibold">{t('shop.title')}</h3>
      {shop ? (
        <div className="flex items-start justify-between gap-2" data-testid="shop-current">
          <div className="grid min-w-0 gap-0.5">
            {shop.tenantId ? (
              <Link
                to="/platform/tenants/$id"
                params={{ id: shop.tenantId }}
                className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
                data-testid="shop-link"
              >
                <Store className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{shop.name || t('side.openShop')}</span>
              </Link>
            ) : (
              <span className="text-sm">{shop.name}</span>
            )}
            <span className="text-xs text-muted-foreground">{t(`shop.source.${shop.source}`)}</span>
          </div>
          {shop.source === 'linked' || shop.source === 'typed' ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('shop.remove')}
              disabled={set.isPending}
              onClick={() => save(null, null)}
            >
              <X aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('shop.none')}</p>
      )}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('shop.search')}
        aria-label={t('shop.search')}
        maxLength={120}
        className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="shop-search"
      />
      {q ? (
        <ul className="grid gap-1" data-testid="shop-results">
          {(found.data ?? []).map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={set.isPending}
                onClick={() => save(s.id, null)}
                className="flex w-full items-baseline justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-sm hover:bg-muted"
                data-testid="shop-result"
              >
                <span className="truncate">{s.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{s.slug}</span>
              </button>
            </li>
          ))}
          {found.isFetching ? null : (found.data ?? []).length === 0 ? (
            <li className="text-xs text-muted-foreground">{t('shop.noMatch')}</li>
          ) : null}
          <li>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto w-full justify-start whitespace-normal py-1.5 text-left"
              disabled={set.isPending}
              onClick={() => save(null, q)}
              data-testid="shop-typed"
            >
              {t('shop.useName', { name: q })}
            </Button>
          </li>
        </ul>
      ) : null}
    </section>
  );
}

/** "โน้ต": internal notes of the team (author + time), never sent to the customer; the newest is on top. */
function NotesSection({ id, notes }: { id: string; notes: PageNote[] }) {
  const { t } = useTranslation('pageInbox');
  const clock = useChatTime(t);
  const [text, setText] = useState('');
  const add = useAddNote();
  return (
    <section className="mt-4 grid gap-2 border-t pt-3" data-testid="notes-section">
      <h3 className="text-sm font-semibold">{t('notes.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('notes.hint')}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('notes.placeholder')}
        aria-label={t('notes.placeholder')}
        maxLength={2000}
        rows={3}
        className="rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="note-text"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={text.trim() === '' || add.isPending}
        onClick={() => add.mutate({ id, text: text.trim() }, { onSuccess: () => setText('') })}
        data-testid="note-add"
      >
        {t('notes.add')}
      </Button>
      {notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('notes.empty')}</p>
      ) : (
        <ul className="grid gap-2" data-testid="note-list">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md bg-muted/60 p-2" data-testid="note">
              <p className="whitespace-pre-wrap break-words text-sm">{n.text}</p>
              <p className="mt-1 text-[0.7rem] text-muted-foreground">
                {n.authorName} · {clock.full(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Right column: where the customer came from (the ad), their stage and send deadlines, and the shop that was opened for them:
 * "เปิดร้านทดลอง" reuses the team's onboarding dialog (the real create-shop flow) and links the new shop to this chat and its lead;
 * an existing shop can be linked by hand.
 */
function MetaPanel({ conversation: c, notes }: { conversation: PageConversation; notes: PageNote[] }) {
  const { t } = useTranslation('pageInbox');
  const clock = useChatTime(t);
  const canWrite = useCan('platform:write');
  const link = useLinkTenant();
  const [onboard, setOnboard] = useState(false);
  const [pick, setPick] = useState('');
  const shops = useShopPicker({ limit: 200 });
  const linkTo = (tenantId: string) =>
    link.mutate({ id: c.id, tenantId }, { onSuccess: () => toast.success(t('side.linked')) });
  return (
    <aside className={panelCls} data-testid="side-panel">
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
      <ShopSection conversation={c} />
      <NotesSection id={c.id} notes={notes} />
      <OnboardDialog
        open={onboard}
        onOpenChange={setOnboard}
        defaults={{ name: c.name ?? '', industryKey: c.shopType ? INDUSTRY[c.shopType] : undefined }}
        onCreated={(tenantId) => linkTo(tenantId)}
      />
    </aside>
  );
}

type Lead = NonNullable<NonNullable<PageDetail['line']>['lead']>;

/** A LINE chat: the sales lead and the shop it is matched to, and when it started. */
function LinePanel({
  conversation: c,
  lead,
  notes,
}: {
  conversation: PageConversation;
  lead: Lead | null;
  notes: PageNote[];
}) {
  const { t } = useTranslation('pageInbox');
  const clock = useChatTime(t);
  return (
    <aside className={panelCls} data-testid="side-panel">
      <h2 className="mb-3 text-sm font-semibold">{t('side.title')}</h2>
      <dl className="grid gap-3">
        <Row label={t('side.channel')}>
          <span className="inline-flex items-center gap-1.5">
            <ChannelIcon channel="line" /> {t('channelFilter.line')}
          </span>
        </Row>
        <Row label={t('side.stage')}>
          <StageChip stage={c.stage} />
        </Row>
        <Row label={t('side.lead')}>
          {lead ? (
            <Link
              to="/platform/sales"
              search={{ lead: lead.id }}
              className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
              data-testid="side-lead"
            >
              <UserRound className="size-3.5" aria-hidden />
              {lead.name ?? lead.ref}
            </Link>
          ) : (
            <span className="text-muted-foreground">{t('side.noLead')}</span>
          )}
        </Row>
        <Row label={t('side.lastMessage')}>
          {c.lastCustomerMessageAt ? clock.full(c.lastCustomerMessageAt) : '—'}
        </Row>
        {c.blocked ? <Row label={t('side.status')}>{t('row.blocked')}</Row> : null}
      </dl>
      <ShopSection conversation={c} />
      <NotesSection id={c.id} notes={notes} />
    </aside>
  );
}

export function SidePanel({
  conversation,
  lead,
  notes,
}: {
  conversation: PageConversation;
  lead: Lead | null;
  notes: PageNote[];
}) {
  return conversation.channel === 'line' ? (
    <LinePanel conversation={conversation} lead={lead} notes={notes} />
  ) : (
    <MetaPanel conversation={conversation} notes={notes} />
  );
}
