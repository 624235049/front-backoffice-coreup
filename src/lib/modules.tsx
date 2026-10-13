import type { ReactNode } from 'react';
import { useMembership } from '@/lib/membership';

/** `core` is always on (docs/02 §5). No key = no requirement. */
export function hasModule(modules: ReadonlySet<string> | readonly string[], key?: string | null): boolean {
  if (!key || key === 'core') return true;
  return modules instanceof Set ? modules.has(key) : (modules as readonly string[]).includes(key);
}

/** `const crmOn = useModule('crm')` */
export function useModule(key?: string | null): boolean {
  return hasModule(useMembership().modules, key);
}

/** Show children only when the tenant has the module enabled. */
export function ModuleGate({
  module,
  fallback = null,
  children,
}: {
  module: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  return <>{useModule(module) ? children : fallback}</>;
}
