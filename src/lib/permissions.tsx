import type { ReactNode } from 'react';
import { useMembership, useOptionalMembership } from '@/lib/membership';
import { hasModule } from '@/lib/modules';

/**
 * Same rule the API enforces: exact match; `x:read` satisfies `x:read:own`; `x:manage` satisfies every `x:*`.
 * (Copy of the backend rule — this repo must not import backend packages.)
 */
export function hasPermission(granted: ReadonlySet<string> | readonly string[], required: string): boolean {
  const set = granted instanceof Set ? granted : new Set(granted as readonly string[]);
  if (set.has(required)) return true;
  const parts = required.split(':');
  const resource = parts[0];
  if (parts.length === 3 && parts[2] === 'own' && set.has(`${resource}:${parts[1]}`)) return true;
  return resource !== undefined && set.has(`${resource}:manage`) && required !== `${resource}:manage`;
}

/** Pure check. `required` empty = no requirement. */
export function can(granted: ReadonlySet<string> | readonly string[], required?: string | null): boolean {
  if (!required) return true;
  return hasPermission(granted, required);
}

/** `const canWrite = useCan('customers:write')` */
export function useCan(permission?: string | null): boolean {
  return can(useMembership().permissions, permission);
}

type CanProps = {
  permission?: string;
  module?: string;
  /** Rendered when the check fails (default: nothing). */
  fallback?: ReactNode;
  children: ReactNode;
};

/** Hide UI the member may not use. The API still enforces permissions; this is UX only. */
export function Can({ permission, module, fallback = null, children }: CanProps) {
  const m = useOptionalMembership();
  const ok = m !== null && can(m.permissions, permission) && hasModule(m.modules, module);
  return <>{ok ? children : fallback}</>;
}
