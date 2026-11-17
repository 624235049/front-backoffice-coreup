import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as PageApi from '@/features/page-inbox/api';
import { ApiError } from '@/lib/api';

const h = vi.hoisted(() => ({
  send: vi.fn(),
  retry: vi.fn(),
  read: vi.fn(),
  patch: vi.fn(),
  detail: null as unknown,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k),
  }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    search,
    params: _params,
    ...rest
  }: {
    children: ReactNode;
    to: string;
    search?: Record<string, string>;
    params?: unknown;
  }) => (
    <a href={`${to}${search ? `?lead=${search.lead}` : ''}`} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));
vi.mock('@/lib/membership', () => ({ useTenant: () => ({ locale: 'th', timezone: 'Asia/Bangkok' }) }));
vi.mock('@/lib/permissions', () => ({ useCan: () => true }));
vi.mock('@/features/platform/api', () => ({ useShopPicker: () => ({ data: [] }) }));
vi.mock('@/features/platform/components/onboard-dialog', () => ({ OnboardDialog: () => null }));
vi.mock('@/features/page-inbox/api', async (orig) => ({
  ...(await orig<typeof PageApi>()),
  useSendLine: () => ({ mutate: h.send, isPending: false }),
  useRetryLine: () => ({ mutate: h.retry, isPending: false }),
  useMarkRead: () => ({ mutate: h.read }),
  usePageConversation: () => ({ isPending: false, isError: false, data: h.detail }),
  usePatchConversation: () => ({ mutate: h.patch, isPending: false }),
  uploadLineImage: vi.fn(),
}));

import type { PageConversation, PageDetail, PageList } from '@/features/page-inbox/api';
import { Conversation } from '@/features/page-inbox/components/conversation';
import { LineComposer } from '@/features/page-inbox/components/line-composer';
import { ThreadList } from '@/features/page-inbox/components/thread-list';

const NOW = new Date().toISOString();
const conv = (over: Partial<PageConversation> = {}): PageConversation => ({
  id: 'c1',
  channel: 'line',
  name: 'คุณมะลิ',
  adId: null,
  shopType: null,
  stage: 'new',
  hot: false,
  leadId: null,
  tenantId: null,
  tenantName: null,
  preview: 'ขอราคาหน่อย',
  lastMessageAt: NOW,
  lastCustomerMessageAt: NOW,
  lastPageMessageAt: null,
  needsReply: true,
  needsStaff: false,
  window: 'free',
  windowFreeEndsAt: null,
  windowHumanEndsAt: null,
  followUpStep: null,
  aiPaused: false,
  unread: 0,
  pictureUrl: null,
  blocked: false,
  ...over,
});
const quota = (used: number, limit: number | null = 1000) => ({
  used,
  limit,
  checkedAt: NOW,
  warn: limit !== null && used / limit >= 0.8,
  low: limit !== null && limit - used < limit * 0.1,
  exhausted: limit !== null && used >= limit,
});
const list = (items: PageConversation[], q = quota(120)): PageList => ({
  items,
  counts: {
    all: items.length,
    needsReply: 1,
    needsStaff: items.filter((i) => i.needsStaff).length,
    hot: 0,
    followUp: 0,
    unread: 2,
  },
  line: { accountName: 'CoreUP.Pro', quota: q },
  ads: [],
});

const q = (o: Partial<Record<string, unknown>> = {}) => ({ filter: 'all' as const, ...o });

describe('one list for LINE, Facebook and Instagram', () => {
  const render_ = (data: PageList, query = q(), onQuery = vi.fn()) => {
    render(
      <ThreadList
        data={data}
        loading={false}
        error={false}
        query={query}
        onQuery={onQuery}
        activeId={null}
        onOpen={vi.fn()}
      />,
    );
    return onQuery;
  };

  it('every row has its channel icon; a LINE chat has the unread badge, a blocked one says so', () => {
    render_(
      list([
        conv({ id: 'a', unread: 3 }),
        conv({ id: 'b', channel: 'messenger', name: 'FB', unread: 0 }),
        conv({ id: 'c', channel: 'instagram', name: 'IG', unread: 0 }),
        conv({ id: 'd', blocked: true, name: 'ปิดกั้น' }),
      ]),
    );
    const rows = screen.getAllByTestId('page-row');
    expect(within(rows[0] as HTMLElement).getByTestId('channel-line')).toBeTruthy();
    expect(within(rows[0] as HTMLElement).getByTestId('unread-badge').textContent).toBe('3');
    expect(within(rows[1] as HTMLElement).getByTestId('channel-messenger')).toBeTruthy();
    expect(within(rows[1] as HTMLElement).queryByTestId('unread-badge')).toBeNull();
    expect(within(rows[2] as HTMLElement).getByTestId('channel-instagram')).toBeTruthy();
    expect(rows[3]?.textContent).toContain('row.blocked');
  });

  it('a chat that asked for a person has the red chip; the "needs staff" tab carries its count and filters', () => {
    const onQuery = render_(list([conv({ id: 'a', needsStaff: true }), conv({ id: 'b' })]));
    const rows = screen.getAllByTestId('page-row');
    expect(within(rows[0] as HTMLElement).getByTestId('needs-staff-chip').textContent).toBe('row.needsStaff');
    expect(within(rows[1] as HTMLElement).queryByTestId('needs-staff-chip')).toBeNull();
    const tab = screen.getByRole('tab', { name: /tabs\.needs_staff/ });
    expect(tab.textContent).toContain('1');
    fireEvent.click(tab);
    expect(onQuery).toHaveBeenLastCalledWith({ filter: 'needs_staff' });
  });

  it('the channel filter picks one channel (all clears it); the LINE tab carries the unread count', () => {
    const onQuery = render_(list([conv()]));
    expect(screen.getByTestId('count-unread').textContent).toBe('2');
    fireEvent.click(screen.getByTestId('channel-filter-line'));
    expect(onQuery).toHaveBeenLastCalledWith({ filter: 'all', channel: 'line' });
    fireEvent.click(screen.getByTestId('channel-filter-instagram'));
    expect(onQuery).toHaveBeenLastCalledWith({ filter: 'all', channel: 'instagram' });
    fireEvent.click(screen.getByTestId('channel-filter-all'));
    expect(onQuery).toHaveBeenLastCalledWith({ filter: 'all', channel: undefined });
  });

  it('on the LINE tab the Facebook-only filters (ad, shop type) are gone', () => {
    render_(list([conv()]), q({ channel: 'line' }));
    expect(screen.queryByLabelText('filters.adLabel')).toBeNull();
    expect(screen.queryByLabelText('filters.typeLabel')).toBeNull();
  });

  it('the header shows the OA, the monthly push quota used / limit, and the OA Manager note', () => {
    render_(list([conv()]));
    expect(screen.getByTestId('line-quota').textContent).toContain('CoreUP.Pro');
    expect(screen.getByTestId('line-quota-count').textContent).toBe(
      'quota.usedOf{"used":"120","limit":"1,000"}',
    );
    expect(screen.queryByTestId('line-quota-low')).toBeNull();
    expect(screen.getByTestId('line-oa-note').textContent).toBe('quota.oaManagerNote');
  });

  it('under 10 % left the header warns; used up says so; no quota data is said too; Facebook tab has no strip', () => {
    const { unmount } = render(
      <ThreadList
        data={list([conv()], quota(950))}
        loading={false}
        error={false}
        query={q()}
        onQuery={vi.fn()}
        activeId={null}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByTestId('line-quota-low').textContent).toBe('quota.low');
    unmount();
    const b = render(
      <ThreadList
        data={list([conv()], quota(1000))}
        loading={false}
        error={false}
        query={q()}
        onQuery={vi.fn()}
        activeId={null}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByTestId('line-quota-low').textContent).toBe('quota.exhausted');
    b.unmount();
    render(
      <ThreadList
        data={{ ...list([conv()]), line: { accountName: 'CoreUP.Pro', quota: null } }}
        loading={false}
        error={false}
        query={q({ channel: 'messenger' })}
        onQuery={vi.fn()}
        activeId={null}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('line-quota')).toBeNull();
  });
});

const detail = (
  over: Partial<NonNullable<PageDetail['line']>> = {},
  c: Partial<PageConversation> = {},
): PageDetail => ({
  conversation: conv(c),
  messages: [],
  suggestion: null,
  followUpDraft: null,
  line: { canReply: true, replyBlock: null, freeReplyUntil: null, quota: quota(100), lead: null, ...over },
});

describe('the LINE reply box', () => {
  beforeEach(() => {
    h.send.mockReset();
    h.retry.mockReset();
    h.read.mockReset();
  });
  const type = (text: string) =>
    fireEvent.change(screen.getByTestId('composer-text'), { target: { value: text } });

  it('a fresh customer message = a free reply: says so and sends at once', () => {
    render(
      <LineComposer
        detail={detail({ freeReplyUntil: new Date(Date.now() + 40_000).toISOString(), quota: quota(990) })}
      />,
    );
    expect(screen.getByTestId('line-free').textContent).toBe('composer.freeHint');
    // the quota is low but a free reply never asks
    expect(screen.queryByTestId('quota-low-note')).toBeNull();
    type('สวัสดีค่ะ');
    fireEvent.click(screen.getByTestId('send-button'));
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.send.mock.calls[0]?.[0]).toMatchObject({ id: 'c1', text: 'สวัสดีค่ะ', images: [] });
  });

  it('a push with plenty of quota says it is a push and sends at once', () => {
    render(<LineComposer detail={detail()} />);
    expect(screen.getByTestId('line-push').textContent).toBe('composer.pushHint{"n":1}');
    type('ข้อความ');
    fireEvent.click(screen.getByTestId('send-button'));
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('confirm-push')).toBeNull();
  });

  it('under 10 % left a push is warned about and only goes after the person confirms', () => {
    render(<LineComposer detail={detail({ quota: quota(950) })} />);
    expect(screen.getByTestId('quota-low-note').textContent).toContain(
      'composer.quotaLow{"left":"50","limit":"1,000"}',
    );
    type('ข้อความ');
    fireEvent.click(screen.getByTestId('send-button'));
    expect(h.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('confirm-push'));
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it('a used-up quota with no free reply blocks the box', () => {
    render(<LineComposer detail={detail({ quota: quota(1000) })} />);
    expect(screen.getByTestId('line-push').textContent).toBe('composer.quotaExhausted');
    expect((screen.getByTestId('composer-text') as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByTestId('send-button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('a refusal from the server is said in Thai in the box; a blocked customer is warned about', () => {
    h.send.mockImplementation((_v, o) =>
      o.onError(
        new ApiError({ status: 409, code: 'CONFLICT', message: 'x', details: { reason: 'quota_exhausted' } }),
      ),
    );
    render(<LineComposer detail={detail({}, { blocked: true })} />);
    expect(screen.getByTestId('blocked-note')).toBeTruthy();
    type('ข้อความ');
    fireEvent.click(screen.getByTestId('send-button'));
    expect(screen.getByTestId('send-error').textContent).toBe(
      'lineErrors.quota_exhausted{"defaultValue":"lineErrors.generic"}',
    );
  });

  it('a message edited after a failed send gets its own id, so the server cannot answer with the stored one', () => {
    h.send.mockImplementation((_v, o) =>
      o.onError(new ApiError({ status: 503, code: 'UNAVAILABLE', message: 'x' })),
    );
    render(<LineComposer detail={detail()} />);
    type('ข้อความแรก');
    fireEvent.click(screen.getByTestId('send-button'));
    const first = h.send.mock.calls[0]?.[0] as { clientId: string };
    h.send.mockImplementation(() => undefined);
    type('ข้อความที่แก้แล้ว');
    fireEvent.click(screen.getByTestId('send-button'));
    const second = h.send.mock.calls[1]?.[0] as { clientId: string; text: string };
    expect(second.text).toBe('ข้อความที่แก้แล้ว');
    expect(second.clientId).not.toBe(first.clientId);
  });

  it('an OA that is not connected cannot be answered', () => {
    render(<LineComposer detail={detail({ canReply: false, replyBlock: 'no_account' })} />);
    expect(screen.getByTestId('line-push').textContent).toBe('lineBlock.no_account');
    expect((screen.getByTestId('send-button') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('the LINE conversation', () => {
  // jsdom has no layout: the chat scrolls to its newest message with this
  Element.prototype.scrollIntoView = vi.fn();
  const msg = (over: Record<string, unknown>) => ({
    id: `m${Math.random()}`,
    direction: 'in',
    sender: 'customer',
    text: 'x',
    imageUrl: null,
    sentAt: NOW,
    authorName: null,
    via: null,
    ...over,
  });
  beforeEach(() => {
    h.read.mockReset();
    h.retry.mockReset();
  });

  it('a chat that needs staff: the banner, and the done button gives the chat back to the AI', () => {
    h.patch.mockReset();
    h.detail = {
      ...detail({}, { needsStaff: true, aiPaused: true }),
      messages: [msg({ id: 'a', kind: 'text', text: 'ขอคุยคน' })],
    };
    render(<Conversation id="c1" onBack={vi.fn()} panelOpen={false} onPanel={vi.fn()} />);
    expect(screen.getByTestId('needs-staff-banner').textContent).toBe('conversation.needsStaff');
    fireEvent.click(screen.getByRole('button', { name: /conversation\.staffDone/ }));
    expect(h.patch).toHaveBeenCalledWith({ id: 'c1', body: { staffDone: true } });
  });

  it('shows text, a sticker picture, pictures, the follow event, the team’s sent message and how it went out', () => {
    h.detail = {
      ...detail(
        { lead: { id: 'L1', ref: 'abc', name: 'Boat', stage: 'talking' } },
        { unread: 2, tenantId: 't9', tenantName: 'ร้านบอท' },
      ),
      messages: [
        msg({ id: 'f', sender: 'system', kind: 'follow', text: 'ลูกค้าเพิ่มร้านเป็นเพื่อน' }),
        msg({ id: 'a', kind: 'text', text: 'อยากลองใช้' }),
        msg({ id: 's', kind: 'sticker', text: '[ลูกค้าส่งสติกเกอร์]', stickerUrl: 'https://s.test/1.png' }),
        msg({ id: 'i', kind: 'image', text: '[ลูกค้าส่งรูปภาพ]', images: ['https://s.test/p.jpg'] }),
        msg({
          id: 'o',
          direction: 'out',
          sender: 'staff',
          kind: 'text',
          text: 'ยินดีค่ะ',
          authorName: 'เซลส์',
          via: 'reply',
          delivery: 'sent',
        }),
      ],
    };
    render(<Conversation id="c1" onBack={vi.fn()} panelOpen={false} onPanel={vi.fn()} />);
    expect(screen.getByTestId('msg-system').textContent).toContain('lineEvent.follow');
    expect(screen.getByTestId('msg-sticker').getAttribute('src')).toBe('https://s.test/1.png');
    expect(screen.getByTestId('msg-image').getAttribute('src')).toBe('https://s.test/p.jpg');
    const staff = screen.getByTestId('msg-staff');
    expect(staff.textContent).toBe('ยินดีค่ะ');
    expect(staff.parentElement?.textContent).toContain('conversation.viaReply');
    // the lead and the shop of the matched user are one tap away; the Facebook-only controls are not here
    expect(screen.getByTestId('open-lead').getAttribute('href')).toBe('/platform/sales?lead=L1');
    expect(screen.getByTestId('open-shop').textContent).toContain('ร้านบอท');
    expect(screen.queryByLabelText('side.type')).toBeNull();
    // opening it reads it
    expect(h.read).toHaveBeenCalledWith('c1');
  });

  it('a message that failed says why and "ส่งใหม่" sends it again; a queued one says it is sending', () => {
    h.detail = {
      ...detail(),
      messages: [
        msg({
          id: 'bad',
          direction: 'out',
          sender: 'staff',
          text: 'ส่งไม่ไป',
          delivery: 'failed',
          error: 'not_friend',
        }),
        msg({ id: 'q', direction: 'out', sender: 'staff', text: 'รอ', delivery: 'queued' }),
      ],
    };
    render(<Conversation id="c1" onBack={vi.fn()} panelOpen={false} onPanel={vi.fn()} />);
    expect(screen.getByTestId('delivery-failed').textContent).toContain('lineErrors.not_friend');
    expect(screen.getByTestId('delivery-queued').textContent).toBe('conversation.sending');
    fireEvent.click(within(screen.getByTestId('delivery-failed')).getByRole('button'));
    expect(h.retry).toHaveBeenCalledWith('bad');
    // nothing unread: nothing to mark
    expect(h.read).not.toHaveBeenCalled();
  });
});
