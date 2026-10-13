import { describe, expect, it } from 'vitest';
import { formatMoney, parseBahtToMinor } from '@/features/platform/format';
import { navItems } from '@/features/platform/nav';
import { pickPlatformMembership } from '@/lib/membership';
import { buildNav } from '@/lib/navigation';
import { membership } from './fixtures';

describe('money (integer satang, AGENTS rule 7)', () => {
  it('parses what people type into satang without float drift', () => {
    expect(parseBahtToMinor('1,250.50')).toBe(125_050);
    expect(parseBahtToMinor('0.29')).toBe(29);
    expect(parseBahtToMinor('45000')).toBe(4_500_000);
    expect(parseBahtToMinor('1.234')).toBeNull();
    expect(parseBahtToMinor('abc')).toBeNull();
    expect(parseBahtToMinor('-5')).toBeNull();
  });

  it('formats satang as baht, hiding decimals only for whole baht', () => {
    expect(formatMoney(4_500_000, 'en-US')).toBe('฿45,000');
    expect(formatMoney(125_050, 'en-US')).toBe('฿1,250.50');
  });
});

describe('platform access', () => {
  it('only a membership in the coreup tenant with platform permissions opens the back office', () => {
    const shop = membership({
      tenant: { ...membership().tenant, slug: 'spa' },
      permissions: ['tenant:read'],
    });
    const staff = membership({
      tenant: { ...membership().tenant, slug: 'coreup' },
      permissions: ['platform:read'],
    });
    const plainCoreup = membership({
      tenant: { ...membership().tenant, slug: 'coreup' },
      permissions: ['tenant:read'],
    });
    expect(pickPlatformMembership([shop, plainCoreup])).toBeNull();
    expect(pickPlatformMembership([shop, staff])).toBe(staff);
  });

  it('shows revenue and team only to platform_owner, leads only with the leads permission', () => {
    const base = membership({
      tenant: { ...membership().tenant, slug: 'coreup' },
      modules: ['platform'],
    });
    const routes = (m: ReturnType<typeof membership>) =>
      buildNav(navItems, m, 'full').flatMap((g) => g.items.map((i) => i.to));

    const owner = {
      ...base,
      roles: ['platform_owner'],
      permissions: [
        'platform:read',
        'platform:leads',
        'platform:audits',
        'platform:billing',
        'platform:revenue',
        'platform:manage',
      ],
    };
    expect(routes(owner)).toEqual(
      expect.arrayContaining(['/platform/revenue', '/platform/team', '/platform/leads']),
    );

    // an admin holds platform:manage (which satisfies every platform:*) but is not the owner
    const admin = {
      ...base,
      roles: ['platform_admin'],
      permissions: ['platform:read', 'platform:manage', 'platform:billing'],
    };
    expect(routes(admin)).not.toContain('/platform/revenue');
    expect(routes(admin)).not.toContain('/platform/team');
    expect(routes(admin)).toContain('/platform/invoices');

    const consultant = {
      ...base,
      roles: ['platform_consultant'],
      permissions: ['platform:read', 'platform:audits'],
    };
    expect(routes(consultant)).toEqual(
      expect.arrayContaining(['/platform', '/platform/tenants', '/platform/audits']),
    );
    expect(routes(consultant)).not.toContain('/platform/leads');
    expect(routes(consultant)).not.toContain('/platform/invoices');
  });
});
