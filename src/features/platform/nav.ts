import {
  Activity,
  Bot,
  Headset,
  KanbanSquare,
  LayoutDashboard,
  Package,
  Receipt,
  Rocket,
  Store,
  TrendingUp,
  UserRoundSearch,
  Users,
} from 'lucide-react';
import type { NavItem } from '@/lib/navigation';
import { useOnboardingSummary } from './api';
import { usePendingSlipCount } from './invoice-slip';
import { useNewLeadBadge } from './new-lead-badge';

/** Red badge on "New shops": self-serve shops the team should contact today. */
function useDueOnboardingCount(): number {
  return useOnboardingSummary().data?.dueCount ?? 0;
}

export const navItems: NavItem[] = [
  {
    to: '/platform',
    labelKey: 'nav:dashboard',
    icon: LayoutDashboard,
    permission: 'platform:read',
    module: 'platform',
    exact: true,
    order: 10,
  },
  {
    to: '/platform/tenants',
    labelKey: 'nav:tenants',
    icon: Store,
    permission: 'platform:read',
    module: 'platform',
    order: 20,
  },
  {
    to: '/platform/usage',
    labelKey: 'nav:usageReport',
    icon: Activity,
    permission: 'platform:read',
    module: 'platform',
    order: 25,
  },
  {
    to: '/platform/ai-demo',
    labelKey: 'nav:aiDemo',
    icon: Bot,
    permission: 'platform:manage',
    module: 'platform',
    order: 26,
  },
  {
    to: '/platform/sales',
    labelKey: 'nav:aiSales',
    icon: Headset,
    permission: 'platform:leads',
    module: 'platform',
    order: 28,
  },
  {
    to: '/platform/onboarding',
    labelKey: 'nav:onboarding',
    icon: Rocket,
    permission: 'platform:read',
    module: 'platform',
    order: 27,
    useBadge: useDueOnboardingCount,
    badgeLabel: 'dueCount',
  },
  {
    to: '/platform/leads',
    labelKey: 'nav:leads',
    icon: KanbanSquare,
    permission: 'platform:leads',
    module: 'platform',
    order: 30,
    useBadge: useNewLeadBadge,
  },
  {
    to: '/platform/invoices',
    labelKey: 'nav:invoices',
    icon: Receipt,
    permission: 'platform:billing',
    module: 'platform',
    order: 60,
    useBadge: usePendingSlipCount,
    badgeLabel: 'slipCount',
  },
  {
    to: '/platform/revenue',
    labelKey: 'nav:revenue',
    icon: TrendingUp,
    permission: 'platform:revenue',
    role: 'platform_owner',
    module: 'platform',
    order: 70,
  },
  {
    to: '/platform/team',
    labelKey: 'nav:team',
    icon: Users,
    permission: 'platform:manage',
    role: 'platform_owner',
    module: 'platform',
    order: 80,
  },
  {
    to: '/platform/users',
    labelKey: 'nav:users',
    icon: UserRoundSearch,
    permission: 'platform:manage',
    module: 'platform',
    order: 75,
  },
  {
    to: '/platform/plans',
    labelKey: 'nav:plans',
    icon: Package,
    permission: 'platform:manage',
    module: 'platform',
    order: 77,
  },
];
