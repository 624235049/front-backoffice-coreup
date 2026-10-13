import type { ApiData } from '@/lib/api';

/** GET /v1/me */
export type MeResponse = ApiData<'/v1/me'>;
export type MeUser = MeResponse['user'];
export type MeMembership = MeResponse['memberships'][number];
export type MeTenant = MeMembership['tenant'];
