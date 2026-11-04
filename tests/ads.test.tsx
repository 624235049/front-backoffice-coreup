import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AdsGoals,
  AdsOverview,
  AdsRecommendations,
  AdsReportView,
  AdsStatus,
} from '@/features/platform/ads-api';
import { bahtToMinor, evidenceVars, rangeOf, wholeOrNull } from '@/features/platform/ads-format';
import { AdsPage } from '@/features/platform/pages/ads-page';
import ads from '@/locales/th/ads.json';
import common from '@/locales/th/common.json';
import platform from '@/locales/th/platform.json';

const h = vi.hoisted(() => ({
  roles: ['platform_owner'] as string[],
  sync: vi.fn(),
  saveGoals: vi.fn(),
  requestReport: vi.fn(),
  invalidate: vi.fn(),
  polling: [] as boolean[],
  failed: [] as string[],
  fast: [] as boolean[],
  data: {} as Record<string, unknown>,
  enabled: [] as boolean[],
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('@/lib/membership', () => ({ useMembership: () => ({ roles: h.roles }) }));
vi.mock('@/lib/query', () => ({ useInvalidate: () => h.invalidate, useErrorMessage: () => () => 'error' }));
const q = (key: string) => ({
  isPending: h.data[key] === undefined && !h.failed.includes(key),
  isError: h.failed.includes(key),
  error: h.failed.includes(key) ? new Error('boom') : null,
  data: h.data[key],
  refetch: vi.fn(),
});
vi.mock('@/features/platform/ads-api', () => ({
  useAdsStatus: (enabled: boolean, fast = false) => {
    h.enabled.push(enabled);
    h.fast.push(fast);
    return q('status');
  },
  useAdsOverview: () => q('overview'),
  useAdsGoals: () => q('goals'),
  useAdsRecommendations: () => q('recs'),
  useAdsReport: (_enabled: boolean, polling = false) => {
    h.polling.push(polling);
    return q('report');
  },
  useAdsSync: () => ({ mutate: h.sync, isPending: false }),
  useSaveAdsGoals: () => ({ mutate: h.saveGoals, isPending: false }),
  useAdsReportRequest: () => ({
    mutate: (_v: unknown, o?: { onSuccess?: () => void }) => {
      h.requestReport();
      o?.onSuccess?.();
    },
    isPending: false,
  }),
}));

const i18n = i18next.createInstance();
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'th',
    resources: { th: { ads, common, platform } },
    defaultNS: 'ads',
    interpolation: { escapeValue: false },
  });
});

const metrics = (o: Partial<AdsOverview['totals']['metrics']> = {}) => ({
  costPerChatMinor: 5000,
  costPerTrialMinor: 20_000,
  cacMinor: 60_000,
  roasFirst: 0.67,
  roas3m: 2,
  paybackMonths: 1.5,
  ...o,
});
const row = (id: string, name: string, o: Record<string, unknown> = {}) => ({
  id,
  name,
  status: 'ACTIVE',
  dailyBudgetMinor: 30_000,
  creativeName: null,
  creativeThumbUrl: null,
  spendMinor: 60_000,
  impressions: 5000,
  reach: 3000,
  frequency: 1.7,
  clicks: 90,
  ctr: 1.8,
  cpcMinor: 667,
  cpmMinor: 12_000,
  metaChats: 12,
  leads: 0,
  funnel: { chats: 12, qualified: 6, demoSent: 4, trials: 3, paidShops: 1 },
  revenue: { firstMinor: 39_900, mrrMinor: 39_900, projected3mMinor: 119_700 },
  metrics: metrics(),
  ...o,
});
const overview = (): AdsOverview =>
  ({
    from: '2026-11-01',
    to: '2026-11-04',
    totals: row('t', 'total'),
    days: [{ day: '2026-11-02', spendMinor: 30_000, chats: 6, revenueMinor: 0 }],
    weeks: [{ day: '2026-10-26', spendMinor: 30_000, chats: 6, revenueMinor: 0 }],
    campaigns: [
      { ...row('c1', 'เช่าชุด'), ads: [row('a1', 'วิดีโอ Reels'), row('a2', 'ภาพนิ่ง', { status: 'PAUSED' })] },
    ],
    creatives: [row('cr1', 'Reels 9:16')],
    shopTypes: [
      {
        shopType: 'dress',
        spendMinor: 30_000,
        funnel: row('x', 'x').funnel,
        revenue: row('x', 'x').revenue,
        metrics: metrics(),
      },
    ],
    placements: [
      {
        placement: 'facebook/facebook_reels',
        spendMinor: 20_000,
        impressions: 2000,
        clicks: 40,
        chats: 2,
        costPerChatMinor: 10_000,
      },
    ],
  }) as unknown as AdsOverview;
const status = (o: Partial<AdsStatus> = {}): AdsStatus => ({
  state: 'ok',
  lastRunAt: '2026-11-04T01:00:00Z',
  lastOkAt: '2026-11-04T01:00:00Z',
  error: null,
  usagePct: 12,
  rowsUpserted: 40,
  ...o,
});
const goals = (): AdsGoals => ({
  month: '2026-11',
  dayOfMonth: 10,
  daysInMonth: 30,
  targets: { chats: 90, trials: null, paidShops: 5, mrrMinor: null, adBudgetMinor: 600_000 },
  items: [
    {
      key: 'chats',
      target: 90,
      actual: 30,
      expected: 30,
      pct: 33.3,
      forecast: 90,
      forecastPct: 100,
      dailyNeeded: 3,
      status: 'on_track',
    },
    {
      key: 'trials',
      target: null,
      actual: 4,
      expected: null,
      pct: null,
      forecast: 12,
      forecastPct: null,
      dailyNeeded: null,
      status: 'no_target',
    },
    {
      key: 'paidShops',
      target: 5,
      actual: 1,
      expected: 2,
      pct: 20,
      forecast: 3,
      forecastPct: 60,
      dailyNeeded: 0.2,
      status: 'behind',
    },
    {
      key: 'mrrMinor',
      target: null,
      actual: 39_900,
      expected: null,
      pct: null,
      forecast: 90_000,
      forecastPct: null,
      dailyNeeded: null,
      status: 'no_target',
    },
    {
      key: 'adBudgetMinor',
      target: 600_000,
      actual: 300_000,
      expected: 200_000,
      pct: 50,
      forecast: 900_000,
      forecastPct: 150,
      dailyNeeded: 15_000,
      status: 'ahead',
    },
  ],
  channels: [
    { channel: 'meta_ads', chats: 20, trials: 3, paidShops: 1, newMrrMinor: 39_900 },
    { channel: 'organic_page', chats: 5, trials: 1, paidShops: 0, newMrrMinor: 0 },
    { channel: 'referral', chats: 0, trials: 0, paidShops: 0, newMrrMinor: 0 },
    { channel: 'line', chats: 5, trials: 0, paidShops: 0, newMrrMinor: 0 },
  ],
});
const recs = (): AdsRecommendations => ({
  suggestionOnly: true,
  items: [
    {
      code: 'cost_per_chat_high',
      severity: 'warn',
      entityLevel: 'ad',
      entityId: 'a1',
      entityName: 'วิดีโอ Reels',
      evidence: {
        thresholdMinor: 4500,
        days: 2,
        spendMinor: 29_151,
        chats: 6,
        lastDayCostPerChatMinor: 4717,
      },
    },
    {
      code: 'chats_unanswered',
      severity: 'warn',
      entityLevel: 'account',
      entityId: null,
      entityName: null,
      evidence: { count: 1, oldestHours: 3 },
    },
  ],
  chats: [
    {
      conversationId: '00000000-0000-4000-8000-000000000001',
      name: 'Nednapa',
      channel: 'messenger',
      shopType: 'dress',
      adId: 'a1',
      kind: 'unanswered',
      hoursSince: 3,
      lastCustomerAt: '2026-11-04T10:00:00Z',
      freeUntil: '2026-11-05T10:00:00Z',
      humanUntil: '2026-11-11T10:00:00Z',
      closingMessage: 'ขอโทษที่ตอบช้านะคะ 🙏 ลองจองชุด https://www.coreup.pro/b/dress-demo',
    },
  ],
});
const report = (o: Partial<AdsReportView> = {}): AdsReportView => ({
  latest: {
    id: 'r1',
    weekStart: '2026-11-02',
    body: 'สัปดาห์นี้ใช้เงิน 600 บาท ได้แชท 12',
    model: 'm',
    createdAt: '2026-11-09T02:00:00Z',
  },
  canGenerate: true,
  generatedThisWeek: 1,
  ...o,
});

const page = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <AdsPage />
    </I18nextProvider>,
  );

beforeEach(() => {
  h.roles = ['platform_owner'];
  h.enabled = [];
  h.sync.mockReset();
  h.saveGoals.mockReset();
  h.requestReport.mockReset();
  h.invalidate.mockReset();
  h.polling = [];
  h.failed = [];
  h.fast = [];
  h.data = { status: status(), overview: overview(), goals: goals(), recs: recs(), report: report() };
});
afterEach(cleanup);

describe('Ads page', () => {
  it('is for the platform owner only: another role sees a notice and asks the API for nothing', () => {
    h.roles = ['platform_sales'];
    page();
    expect(screen.getByText('หน้านี้สำหรับเจ้าของ CoreUp เท่านั้น')).toBeTruthy();
    expect(screen.queryByTestId('ads-cards')).toBeNull();
    expect(h.enabled.every((e) => e === false)).toBe(true);
  });

  it('top cards show spend, chats, trials, paid shops, revenue, ROAS and CAC', () => {
    page();
    const cards = within(screen.getByTestId('ads-cards'));
    expect(cards.getAllByText('฿600')).toHaveLength(2); // spend and CAC
    expect(cards.getByText('12')).toBeTruthy(); // chats
    expect(cards.getByText('฿50 ต่อแชท')).toBeTruthy();
    expect(cards.getByText('฿399')).toBeTruthy(); // revenue
    expect(cards.getByText('0.67×')).toBeTruthy(); // ROAS
    expect(cards.getByText(/คืนทุนใน 1.5 เดือน/)).toBeTruthy();
    expect(screen.getByTestId('ads-chart')).toBeTruthy();
  });

  it('metrics without a denominator show a dash, never NaN or Infinity', () => {
    const o = overview();
    o.totals = {
      ...(row('t', 't', {
        spendMinor: 0,
        funnel: { chats: 0, qualified: 0, demoSent: 0, trials: 0, paidShops: 0 },
        revenue: { firstMinor: 0, mrrMinor: 0, projected3mMinor: 0 },
        metrics: metrics({
          costPerChatMinor: null,
          costPerTrialMinor: null,
          cacMinor: null,
          roasFirst: null,
          roas3m: null,
          paybackMonths: null,
        }),
      }) as unknown as AdsOverview['totals']),
    };
    o.days = [];
    h.data.overview = o;
    page();
    const text = screen.getByTestId('ads-cards').textContent ?? '';
    expect(text).not.toMatch(/NaN|Infinity|null/);
    expect(text).toContain('–');
  });

  describe('connection status', () => {
    it('ok: shows the last success and "sync now" asks the worker to pull', () => {
      page();
      expect(screen.getByTestId('ads-status').textContent).toBe('เชื่อม Meta แล้ว');
      fireEvent.click(screen.getByRole('button', { name: 'ดึงข้อมูลตอนนี้' }));
      expect(h.sync).toHaveBeenCalledTimes(1);
    });

    it('no token: says how to connect it', () => {
      h.data.status = status({ state: 'no_token', lastOkAt: null, error: 'META_ADS_TOKEN is not set' });
      page();
      expect(screen.getByTestId('ads-status').textContent).toBe('ยังไม่ได้เชื่อม Meta');
      expect(screen.getByText(/META_ADS_TOKEN/, { selector: 'p' })).toBeTruthy();
    });

    it("token refused: shows Meta's own words", () => {
      h.data.status = status({
        state: 'token_error',
        error: 'Meta 403 (#200): Requires ads_read permission',
      });
      page();
      expect(screen.getByTestId('ads-status').textContent).toContain('Meta ไม่รับคีย์');
      expect(screen.getByText('Meta 403 (#200): Requires ads_read permission')).toBeTruthy();
    });

    it('while syncing the button is disabled', () => {
      h.data.status = status({ state: 'syncing' });
      page();
      expect((screen.getByRole('button', { name: 'ดึงข้อมูลตอนนี้' }) as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('suggestions', () => {
    it('show their evidence numbers and say they are suggestions only', () => {
      page();
      expect(screen.getByText('เป็นข้อเสนอแนะเท่านั้น ระบบไม่ได้แก้หรือหยุดโฆษณาให้')).toBeTruthy();
      const rec = within(screen.getByTestId('rec-cost_per_chat_high'));
      expect(rec.getByText('ค่าต่อแชทเกินเกณฑ์ 2 วันติด')).toBeTruthy();
      expect(rec.getByText(/เกิน ฿45 ต่อเนื่อง 2 วัน \(ใช้ไป ฿291\.51 ได้ 6 แชท วันล่าสุด ฿47\.17/)).toBeTruthy();
      expect(rec.getByText('วิดีโอ Reels', { exact: false })).toBeTruthy();
      expect(screen.getByTestId('rec-chats_unanswered').textContent).toContain('1 แชทที่ลูกค้ารอเกิน 1 ชั่วโมง');
    });

    it('lists chats with the ready message and copies it for a person to send', async () => {
      const writeText = vi.fn(async () => {});
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      page();
      const chat = within(screen.getByTestId('chat-to-close'));
      expect(chat.getByText('Nednapa')).toBeTruthy();
      expect(chat.getByText('ลูกค้ารอ 3 ชม.')).toBeTruthy();
      fireEvent.click(chat.getByRole('button', { name: /คัดลอกข้อความ/ }));
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('dress-demo')));
      expect(h.toast.success).toHaveBeenCalledWith('คัดลอกแล้ว');
    });

    it('nothing to suggest is said plainly', () => {
      h.data.recs = { suggestionOnly: true, items: [], chats: [] };
      page();
      expect(screen.getByText('ตอนนี้ยังไม่มีอะไรต้องทำ')).toBeTruthy();
    });
  });

  describe('goals', () => {
    it('shows progress, pace and forecast per target and the channel split', () => {
      page();
      const chats = within(screen.getByTestId('goal-chats'));
      expect(chats.getByText('30 จาก 90 (33.3%)')).toBeTruthy();
      expect(chats.getByText('ทันเป้า')).toBeTruthy();
      expect(chats.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('33');
      expect(within(screen.getByTestId('goal-paidShops')).getByText('ตามหลัง')).toBeTruthy();
      expect(within(screen.getByTestId('goal-adBudgetMinor')).getByText('ใช้เร็วกว่าแผน')).toBeTruthy();
      expect(within(screen.getByTestId('goal-trials')).getByText(/ยังไม่ได้ตั้งเป้า/)).toBeTruthy();
      expect(screen.getByText('โฆษณา Meta')).toBeTruthy();
      expect(screen.getByText('เพจ (ไม่ผ่านโฆษณา)')).toBeTruthy();
      expect(screen.getByText('แนะนำต่อ')).toBeTruthy();
    });

    it('saves targets: whole numbers as they are, baht as satang, empty as no target', () => {
      page();
      fireEvent.click(screen.getByRole('button', { name: 'ตั้งเป้าหมาย' }));
      fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('แชทใหม่'), {
        target: { value: '120' },
      });
      fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('MRR'), {
        target: { value: '15,000.50' },
      });
      fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('ร้านที่จ่ายแล้ว'), {
        target: { value: '' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
      expect(h.saveGoals).toHaveBeenCalledTimes(1);
      expect(h.saveGoals.mock.calls[0]?.[0]).toEqual({
        month: '2026-11',
        targets: { chats: 120, trials: null, paidShops: null, mrrMinor: 1_500_050, adBudgetMinor: 600_000 },
      });
    });

    it('does not save an invalid number', () => {
      page();
      fireEvent.click(screen.getByRole('button', { name: 'ตั้งเป้าหมาย' }));
      fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('แชทใหม่'), {
        target: { value: '12.5' },
      });
      expect((screen.getByRole('button', { name: 'บันทึก' }) as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('sync', () => {
    it('reads the numbers again when a new run has finished, not before', () => {
      const view = page();
      expect(h.invalidate).not.toHaveBeenCalled();
      h.data.status = status({ lastOkAt: '2026-11-05T01:00:00Z' });
      view.rerender(
        <I18nextProvider i18n={i18n}>
          <AdsPage />
        </I18nextProvider>,
      );
      expect(h.invalidate.mock.calls.map((c) => c[2]).sort()).toEqual([
        'goals',
        'overview',
        'recommendations',
      ]);
    });

    it('opening the page, even when the status arrives late, is not "a run finished"', () => {
      h.data.status = undefined;
      const view = page();
      h.data.status = status();
      view.rerender(
        <I18nextProvider i18n={i18n}>
          <AdsPage />
        </I18nextProvider>,
      );
      expect(screen.getByTestId('ads-status')).toBeTruthy();
      expect(h.invalidate).not.toHaveBeenCalled();
    });

    it('after "sync now" the status is read often, until a run finishes', () => {
      const view = page();
      expect(h.fast.at(-1)).toBe(false);
      fireEvent.click(screen.getByRole('button', { name: 'ดึงข้อมูลตอนนี้' }));
      act(() => h.sync.mock.calls[0]?.[1]?.onSuccess?.());
      expect(h.fast.at(-1)).toBe(true);
      h.data.status = status({ lastOkAt: '2026-11-05T01:00:00Z' });
      view.rerender(
        <I18nextProvider i18n={i18n}>
          <AdsPage />
        </I18nextProvider>,
      );
      expect(h.fast.at(-1)).toBe(false);
    });
  });

  describe('failures stay where they happen', () => {
    it('goals failing does not take the numbers or the tables with it, and shows one error only', () => {
      h.failed = ['goals'];
      h.data.goals = undefined;
      page();
      expect(screen.getByTestId('ads-cards')).toBeTruthy();
      expect(screen.getByTestId('ads-mobile-list')).toBeTruthy();
      expect(screen.getByTestId('rec-cost_per_chat_high')).toBeTruthy();
    });

    it('the overview failing leaves goals, suggestions and the report', () => {
      h.failed = ['overview'];
      h.data.overview = undefined;
      page();
      expect(screen.queryByTestId('ads-cards')).toBeNull();
      expect(screen.getByTestId('goal-chats')).toBeTruthy();
      expect(screen.getByTestId('ads-report-body')).toBeTruthy();
    });
  });

  describe('tables', () => {
    it('campaigns fold their ads underneath, on a phone as cards', () => {
      page();
      expect(screen.getAllByText('เช่าชุด').length).toBeGreaterThan(0);
      expect(within(screen.getByTestId('ads-mobile-list')).getByText('วิดีโอ Reels')).toBeTruthy();
      // the wide table starts folded
      expect(screen.getAllByText('วิดีโอ Reels')).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: 'ดูโฆษณาในแคมเปญ' }));
      expect(screen.getAllByText('วิดีโอ Reels')).toHaveLength(2);
    });
  });

  describe('weekly report', () => {
    it('shows the latest summary and asks for a new one', () => {
      page();
      expect(screen.getByTestId('ads-report-body').textContent).toContain('ได้แชท 12');
      fireEvent.click(screen.getByRole('button', { name: 'สร้างตอนนี้' }));
      expect(h.requestReport).toHaveBeenCalledTimes(1);
    });

    it('after pressing, the button stays off and the card polls until a NEW report appears', () => {
      const view = page();
      fireEvent.click(screen.getByRole('button', { name: 'สร้างตอนนี้' }));
      const waiting = screen.getByRole('button', { name: 'กำลังเขียน… รอสักครู่' }) as HTMLButtonElement;
      expect(waiting.disabled).toBe(true);
      expect(h.polling.at(-1)).toBe(true);
      fireEvent.click(waiting); // a second click does nothing
      expect(h.requestReport).toHaveBeenCalledTimes(1);

      // the worker finished: a report with another id is there
      h.data.report = report({
        latest: {
          id: 'r2',
          weekStart: '2026-11-02',
          body: 'ใหม่',
          model: 'm',
          createdAt: '2026-11-09T03:00:00Z',
        },
      });
      view.rerender(
        <I18nextProvider i18n={i18n}>
          <AdsPage />
        </I18nextProvider>,
      );
      expect((screen.getByRole('button', { name: 'สร้างตอนนี้' }) as HTMLButtonElement).disabled).toBe(false);
      expect(h.polling.at(-1)).toBe(false);
      expect(screen.getByTestId('ads-report-body').textContent).toBe('ใหม่');
    });

    it('gives up waiting after 2 minutes with a text that does not invite another click', () => {
      vi.useFakeTimers();
      try {
        page();
        fireEvent.click(screen.getByRole('button', { name: 'สร้างตอนนี้' }));
        act(() => {
          vi.advanceTimersByTime(2 * 60_000 + 10);
        });
        expect(screen.getByTestId('ads-report-timeout').textContent).toContain('ไม่ต้องกดซ้ำ');
        expect(h.requestReport).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('stops at the weekly cap', () => {
      h.data.report = report({ canGenerate: false, generatedThisWeek: 3 });
      page();
      expect((screen.getByRole('button', { name: 'สร้างตอนนี้' }) as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText('สร้างครบ 3 ครั้งแล้วในสัปดาห์นี้')).toBeTruthy();
    });
  });
});

describe('ads format helpers', () => {
  it('turns evidence into text: …Minor is baht, null is a dash', () => {
    expect(
      evidenceVars({ spendMinor: 29_151, chats: 6, last: null, name: 'x', frequency: 2.8 }, 'th-TH'),
    ).toEqual({
      spendMinor: '฿291.51',
      chats: '6',
      last: '–',
      name: 'x',
      frequency: '2.8',
    });
  });

  it('range presets end today', () => {
    expect(rangeOf('month', '2026-11-04')).toEqual({ from: '2026-11-01', to: '2026-11-04' });
    expect(rangeOf('7', '2026-11-04')).toEqual({ from: '2026-10-29', to: '2026-11-04' });
    expect(rangeOf('30', '2026-03-05')).toEqual({ from: '2026-02-04', to: '2026-03-05' });
  });

  it('parses target inputs', () => {
    expect(bahtToMinor('1,200.5')).toBe(120_050);
    expect(bahtToMinor('')).toBeNull();
    expect(bahtToMinor('12.345')).toBeUndefined();
    expect(wholeOrNull(' 7 ')).toBe(7);
    expect(wholeOrNull('-1')).toBeUndefined();
  });
});
