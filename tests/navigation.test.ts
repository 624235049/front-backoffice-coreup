import { Home } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { safeRedirect } from '@/lib/home';
import { buildNav, type NavItem } from '@/lib/navigation';
import { membership } from './fixtures';

const item = (over: Partial<NavItem>): NavItem => ({ to: '/x', labelKey: 'nav:x', icon: Home, ...over });

describe('buildNav', () => {
  const m = membership({ permissions: ['customers:read', 'tenant:write'], modules: ['crm'] });

  it('filters by permission and module', () => {
    const groups = buildNav(
      [
        item({ to: '/customers', permission: 'customers:read', module: 'crm' }),
        item({ to: '/payouts', permission: 'payouts:read', module: 'payouts' }),
        item({ to: '/messages', permission: 'customers:read', module: 'messaging' }),
        item({ to: '/open' }),
      ],
      m,
      'full',
    );
    expect(groups.flatMap((g) => g.items.map((i) => i.to)).sort()).toEqual(['/customers', '/open']);
  });

  it('hides advanced items in simple mode only', () => {
    const items = [item({ to: '/a', advanced: true }), item({ to: '/b' })];
    expect(buildNav(items, m, 'simple').flatMap((g) => g.items.map((i) => i.to))).toEqual(['/b']);
    expect(buildNav(items, m, 'full').flatMap((g) => g.items.map((i) => i.to))).toEqual(['/a', '/b']);
  });

  it('supports anyPermission and orders within sections', () => {
    const groups = buildNav(
      [
        item({ to: '/late', order: 50, anyPermission: ['nope:read', 'tenant:write'] }),
        item({ to: '/early', order: 5 }),
        item({ to: '/hidden', anyPermission: ['nope:read'] }),
        item({ to: '/s', section: 'settings' }),
      ],
      m,
      'full',
    );
    expect(groups.map((g) => g.section)).toEqual(['main', 'settings']);
    expect(groups[0]?.items.map((i) => i.to)).toEqual(['/early', '/late']);
  });
});

describe('safeRedirect', () => {
  it('accepts only same-origin absolute paths', () => {
    expect(safeRedirect('/settings/tenant?x=1')).toBe('/settings/tenant?x=1');
    expect(safeRedirect('//evil.example')).toBeUndefined();
    expect(safeRedirect('https://evil.example')).toBeUndefined();
    expect(safeRedirect(undefined)).toBeUndefined();
  });
});
