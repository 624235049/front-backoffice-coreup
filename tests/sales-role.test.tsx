import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import type { ReactNode } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RequirePermission } from '@/components/require-permission';
import { homeFor } from '@/lib/home';
import { meQueryOptions } from '@/lib/me';
import { allNavItems, buildNav } from '@/lib/navigation';
import common from '@/locales/th/common.json';
import { Route as IndexRoute } from '@/routes/_app/index';
import { membership } from './fixtures';

const h = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/lib/membership', async (orig) => ({
  ...(await orig<typeof import('@/lib/membership')>()),
  useMembership: () => h.current,
}));
vi.mock('@tanstack/react-router', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-router')>()),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

/** The platform roles' permissions as the API's role map grants them (packages/schema `SYSTEM_ROLES`). */
const OWNER = [
  'platform:read',
  'platform:write',
  'platform:manage',
  'platform:impersonate',
  'platform:leads',
  'platform:audits',
  'platform:billing',
  'platform:revenue',
  'platform:accounting',
  'platform:expenses',
  'platform:billing_issue',
  'platform:shops',
];
// `platform:manage` satisfies every other platform:* in `can`, exactly as on the server
const ADMIN = ['platform:read', 'platform:write', 'platform:manage', 'platform:billing', 'platform:shops'];
const CONSULTANT = ['platform:read', 'platform:shops', 'platform:audits', 'platform:impersonate'];
const SALES = [
  'platform:read',
  'platform:write',
  'platform:leads',
  'platform:audits',
  'platform:expenses',
  'platform:billing_issue',
];

const as = (permissions: string[], roles: string[]) =>
  membership({
    tenant: { ...membership().tenant, slug: 'coreup' },
    permissions,
    roles,
    modules: ['platform'],
  });
const navOf = (m: ReturnType<typeof as>) =>
  buildNav(allNavItems, m, 'full').flatMap((g) => g.items.map((i) => i.to));

const HIDDEN_FROM_SALES = ['/platform', '/platform/tenants', '/platform/usage'];

describe('sidebar per platform role', () => {
  it('owner, admin and consultant keep the dashboard, shops and usage report', () => {
    for (const [perms, role] of [
      [OWNER, 'platform_owner'],
      [ADMIN, 'platform_admin'],
      [CONSULTANT, 'platform_consultant'],
    ] as const) {
      const nav = navOf(as(perms, [role]));
      for (const to of HIDDEN_FROM_SALES) expect(nav, `${role} ${to}`).toContain(to);
    }
  });

  it('owner and admin see the bills; the consultant sees neither bills nor quotations', () => {
    expect(navOf(as(OWNER, ['platform_owner']))).toEqual(
      expect.arrayContaining(['/platform/invoices', '/accounting', '/accounting/quotations']),
    );
    expect(navOf(as(ADMIN, ['platform_admin']))).toContain('/platform/invoices');
    const consultant = navOf(as(CONSULTANT, ['platform_consultant']));
    expect(consultant).not.toContain('/platform/invoices');
    expect(consultant).not.toContain('/accounting/quotations');
  });

  it('sales: new shops, leads, quotations and bills; not the dashboard, the shops or the usage report', () => {
    const nav = navOf(as(SALES, ['platform_sales']));
    for (const to of HIDDEN_FROM_SALES) expect(nav, to).not.toContain(to);
    expect(nav).toEqual(
      expect.arrayContaining([
        '/platform/onboarding',
        '/platform/leads',
        '/platform/invoices',
        '/accounting/quotations',
        '/accounting/expenses',
        '/accounting/contacts',
      ]),
    );
    // money-in, accounting overview, plans and the team stay hidden
    for (const to of [
      '/accounting',
      '/accounting/invoices',
      '/accounting/receipts',
      '/accounting/credit-notes',
      '/accounting/reports',
      '/platform/plans',
      '/platform/team',
      '/platform/users',
      '/platform/revenue',
    ])
      expect(nav, to).not.toContain(to);
  });
});

describe('landing page per role', () => {
  it('sales lands on the leads board; everyone else on the dashboard', () => {
    expect(homeFor(as(SALES, ['platform_sales']))).toBe('/platform/leads');
    expect(homeFor(as(OWNER, ['platform_owner']))).toBe('/platform');
    expect(homeFor(as(ADMIN, ['platform_admin']))).toBe('/platform');
    expect(homeFor(as(CONSULTANT, ['platform_consultant']))).toBe('/platform');
  });

  it('a role with neither the dashboard nor leads lands on its first menu item', () => {
    expect(homeFor(as(['platform:read', 'platform:billing_issue'], ['custom']))).toBe(
      navOf(as(['platform:read', 'platform:billing_issue'], ['custom']))[0],
    );
  });

  it('"/" redirects by role', async () => {
    const beforeLoad = IndexRoute.options.beforeLoad as (a: {
      context: { queryClient: QueryClient };
    }) => Promise<void>;
    const redirectFor = async (m: ReturnType<typeof as>) => {
      const qc = new QueryClient();
      qc.setQueryData(meQueryOptions.queryKey, { memberships: [m] } as never);
      return beforeLoad({ context: { queryClient: qc } }).then(
        () => null,
        (e: { options?: { href?: string } }) => e.options?.href,
      );
    };
    expect(await redirectFor(as(SALES, ['platform_sales']))).toBe('/platform/leads');
    expect(await redirectFor(as(OWNER, ['platform_owner']))).toBe('/platform');
  });
});

describe('direct URL of a hidden page', () => {
  beforeAll(async () => {
    await i18next
      .use(initReactI18next)
      .init({ lng: 'th', resources: { th: { common } }, defaultNS: 'common' });
  });
  afterEach(cleanup);

  const renderGuard = (m: ReturnType<typeof as>) => {
    h.current = m;
    return render(
      <I18nextProvider i18n={i18next}>
        <RequirePermission permission="platform:shops">
          <span>dashboard</span>
        </RequirePermission>
      </I18nextProvider>,
    );
  };

  it('sales sees "ไม่มีสิทธิ์ดูหน้านี้" and a link to its own home (no crash)', () => {
    renderGuard(as(SALES, ['platform_sales']));
    expect(screen.getByText('ไม่มีสิทธิ์ดูหน้านี้')).toBeTruthy();
    expect(screen.queryByText('dashboard')).toBeNull();
    expect(screen.getByRole('link', { name: common.noPermission.home }).getAttribute('href')).toBe(
      '/platform/leads',
    );
  });

  it('the dashboard roles see the page', () => {
    renderGuard(as(ADMIN, ['platform_admin']));
    expect(screen.getByText('dashboard')).toBeTruthy();
  });
});
