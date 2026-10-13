import type { MeMembership } from '@/lib/types';

export function membership(over: Partial<MeMembership> = {}): MeMembership {
  return {
    tenant: {
      id: 't1',
      name: 'Shop',
      slug: 'shop',
      industry: 'generic',
      timezone: 'Asia/Bangkok',
      currency: 'THB',
      locale: 'th',
      logoUrl: null,
      uiMode: 'full',
    },
    memberId: 'm1',
    roles: [],
    permissions: [],
    branchIds: [],
    modules: [],
    terminology: {},
    ...over,
  } as MeMembership;
}
