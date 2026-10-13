import type { LucideIcon } from 'lucide-react';
import { hasModule } from '@/lib/modules';
import { can } from '@/lib/permissions';
import type { MeMembership } from '@/lib/types';

export type NavSection = 'main' | 'me' | 'manage' | 'settings';

/**
 * A sidebar entry. Each feature exports `navItems: NavItem[]` from `src/features/<area>/nav.ts`;
 * they are collected automatically (`import.meta.glob`), so nobody edits a shared registry.
 */
export type NavItem = {
  /** Route path, e.g. '/customers'. */
  to: string;
  /** i18n key `namespace:key`, e.g. 'nav:customers'. Add the string to `src/locales/{th,en}/nav.json`. */
  labelKey: string;
  icon: LucideIcon;
  /** Hidden unless the member has this permission. */
  permission?: string;
  /** Hidden unless at least one of these permissions is held (use instead of `permission`). */
  anyPermission?: readonly string[];
  /** Hidden unless the member holds this exact role key (e.g. owner-only screens). */
  role?: string;
  /** Hidden unless the tenant has this module. */
  module?: string;
  /** Grouping in the sidebar. Default 'main'. */
  section?: NavSection;
  /** Sort order inside the section (lower first). Default 100. */
  order?: number;
  /** Hidden in simple mode (docs/08 §8). Default: visible in both modes. */
  advanced?: boolean;
  /** Match only the exact path for the active state (default: prefix match). */
  exact?: boolean;
};

const modules = import.meta.glob<{ navItems?: NavItem[] }>('../features/*/nav.ts', { eager: true });

export const allNavItems: NavItem[] = Object.values(modules).flatMap((m) => m.navItems ?? []);

/** Tabs of the /settings area: each feature may export `settingsTabs: NavItem[]` from `features/<area>/settings-tabs.ts`. */
const tabModules = import.meta.glob<{ settingsTabs?: NavItem[] }>('../features/*/settings-tabs.ts', {
  eager: true,
});

export const allSettingsTabs: NavItem[] = Object.values(tabModules)
  .flatMap((m) => m.settingsTabs ?? [])
  .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

export function isNavItemVisible(item: NavItem, m: MeMembership, uiMode: 'simple' | 'full'): boolean {
  if (item.advanced && uiMode === 'simple') return false;
  if (item.role && !m.roles.includes(item.role)) return false;
  if (!hasModule(m.modules, item.module)) return false;
  if (item.anyPermission && !item.anyPermission.some((p) => can(m.permissions, p))) return false;
  return can(m.permissions, item.permission);
}

const SECTION_ORDER: NavSection[] = ['main', 'me', 'manage', 'settings'];

/** Visible items grouped by section, sections and items in stable order. */
export function buildNav(
  items: readonly NavItem[],
  m: MeMembership,
  uiMode: 'simple' | 'full',
): { section: NavSection; items: NavItem[] }[] {
  const visible = items.filter((i) => isNavItemVisible(i, m, uiMode));
  return SECTION_ORDER.map((section) => ({
    section,
    items: visible
      .filter((i) => (i.section ?? 'main') === section)
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100)),
  })).filter((g) => g.items.length > 0);
}
