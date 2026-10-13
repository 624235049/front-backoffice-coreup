import { createContext, type ReactNode, useContext } from 'react';
import type { MeMembership, MeTenant } from '@/lib/types';
import { useSession } from '@/stores/session';

const MembershipContext = createContext<MeMembership | null>(null);

/** Provided by the `_app` layout once /v1/me is loaded and a tenant is selected. */
export function MembershipProvider({ value, children }: { value: MeMembership; children: ReactNode }) {
  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

/** The signed-in member's membership in the active tenant (roles, permissions, branches, modules, terminology). */
export function useMembership(): MeMembership {
  const m = useContext(MembershipContext);
  if (!m) throw new Error('useMembership() must be used inside the authenticated app layout (_app)');
  return m;
}

/** Same as `useMembership()` but returns null outside the `_app` layout (e.g. in shared components). */
export function useOptionalMembership(): MeMembership | null {
  return useContext(MembershipContext);
}

/** Active tenant (id, name, timezone, currency, locale, uiMode, ...). Only inside `_app`. */
export function useTenant(): MeTenant {
  return useMembership().tenant;
}

/** Tenant id for query keys: `[tenantId, 'customers', params]` (docs/04 §7). */
export function useTenantId(): string {
  return useMembership().tenant.id;
}

/** The CoreUp team membership: the `coreup` platform tenant with platform permissions; null for everyone else. */
export function pickPlatformMembership(memberships: readonly MeMembership[]): MeMembership | null {
  return (
    memberships.find(
      (m) => m.tenant.slug === 'coreup' && m.permissions.some((p) => p.startsWith('platform:')),
    ) ?? null
  );
}

/** simple|full: the user's local override wins over the tenant default (docs/08 §8). */
export function useUiMode(): 'simple' | 'full' {
  const tenant = useTenant();
  const override = useSession((s) => s.uiModeOverride);
  return override ?? tenant.uiMode;
}
