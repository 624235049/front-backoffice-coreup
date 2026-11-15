import { allNavItems, buildNav } from '@/lib/navigation';
import { can } from '@/lib/permissions';
import type { MeMembership } from '@/lib/types';

/** Open redirect guard: only same-origin absolute paths. */
export function safeRedirect(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : undefined;
}

/** `search` for a redirect to /sign-in: remember where the user was, except for the default landing page. */
export function signInSearch(href: string): { redirect?: string } {
  const target = safeRedirect(href);
  return target && target !== '/' ? { redirect: target } : {};
}

/**
 * Where a member lands: the dashboard for roles that may see it; otherwise the sales board (leads), otherwise the
 * first menu item they can open.
 */
export function homeFor(m: MeMembership): string {
  if (can(m.permissions, 'platform:shops')) return '/platform';
  if (can(m.permissions, 'platform:leads')) return '/platform/leads';
  return buildNav(allNavItems, m, 'full')[0]?.items[0]?.to ?? '/platform';
}
