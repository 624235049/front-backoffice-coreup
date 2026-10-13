import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MembershipProvider } from '@/lib/membership';
import { hasModule } from '@/lib/modules';
import { Can, can, hasPermission } from '@/lib/permissions';
import type { MeMembership } from '@/lib/types';
import { membership } from './fixtures';

describe('hasPermission', () => {
  it('matches exact permissions', () => {
    expect(hasPermission(['customers:read'], 'customers:read')).toBe(true);
    expect(hasPermission(['customers:read'], 'customers:write')).toBe(false);
  });

  it('lets a broad read satisfy the :own variant, but not the reverse', () => {
    expect(hasPermission(['appointments:read'], 'appointments:read:own')).toBe(true);
    expect(hasPermission(['appointments:read:own'], 'appointments:read')).toBe(false);
  });

  it('lets resource:manage satisfy every action on that resource only', () => {
    expect(hasPermission(['tenant:manage'], 'tenant:write')).toBe(true);
    expect(hasPermission(['tenant:manage'], 'branches:write')).toBe(false);
    expect(hasPermission(['tenant:write'], 'tenant:manage')).toBe(false);
  });

  it('can() treats an empty requirement as allowed', () => {
    expect(can([], undefined)).toBe(true);
    expect(can([], '')).toBe(true);
    expect(can([], 'x:read')).toBe(false);
  });
});

describe('hasModule', () => {
  it('always allows core and undefined', () => {
    expect(hasModule([], 'core')).toBe(true);
    expect(hasModule([], undefined)).toBe(true);
  });
  it('requires other modules to be enabled', () => {
    expect(hasModule(['crm'], 'crm')).toBe(true);
    expect(hasModule(['crm'], 'payouts')).toBe(false);
  });
});

function renderCan(m: MeMembership, props: { permission?: string; module?: string }) {
  return render(
    <MembershipProvider value={m}>
      <Can {...props} fallback={<span>denied</span>}>
        <span>allowed</span>
      </Can>
    </MembershipProvider>,
  );
}

describe('<Can>', () => {
  it('renders children only when both permission and module pass', () => {
    const m = membership({ permissions: ['customers:read'], modules: ['crm'] });
    renderCan(m, { permission: 'customers:read', module: 'crm' });
    expect(screen.getByText('allowed')).toBeTruthy();
  });

  it('falls back when the module is not enabled even if the permission is held', () => {
    const m = membership({ permissions: ['payouts:read'], modules: ['crm'] });
    renderCan(m, { permission: 'payouts:read', module: 'payouts' });
    expect(screen.getByText('denied')).toBeTruthy();
  });

  it('falls back outside a membership provider', () => {
    render(
      <Can permission="x:read" fallback={<span>denied</span>}>
        <span>allowed</span>
      </Can>,
    );
    expect(screen.getByText('denied')).toBeTruthy();
  });
});
