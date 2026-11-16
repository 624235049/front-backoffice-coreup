import { Mail } from 'lucide-react';
import type { NavItem } from '@/lib/navigation';

/** Customer emails from sales@coreup.pro: the owner and sales (the same people who issue quotations and bills). */
export const navItems: NavItem[] = [
  {
    to: '/mail',
    labelKey: 'nav:mail',
    icon: Mail,
    anyPermission: ['platform:accounting', 'platform:billing_issue'],
    module: 'platform',
    order: 62,
  },
];
