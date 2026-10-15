import { isApiError } from '@/lib/api';

/** Same bounds as the API (`reason` and sign-up password rules). */
export const MIN_REASON = 10;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;

/** Where shop staff sign in (overridable per environment). */
export const SHOP_LOGIN_URL = (import.meta.env.VITE_SHOP_URL ?? 'https://coreup.biz').replace(/\/$/, '');

/** Where a user signs in: CoreUp team accounts use this back office, everyone else the shop app. */
export function loginUrlFor(user: { isTeam: boolean }, adminOrigin: string): string {
  return user.isTeam ? adminOrigin.replace(/\/$/, '') : SHOP_LOGIN_URL;
}

export type PasswordProblem = 'tooShort' | 'tooLong';

/** Mirror of the sign-up rule (8–128 characters); null = acceptable. */
export function passwordProblem(password: string): PasswordProblem | null {
  if (password.length < MIN_PASSWORD) return 'tooShort';
  if (password.length > MAX_PASSWORD) return 'tooLong';
  return null;
}

export const reasonReady = (reason: string): boolean => reason.trim().length >= MIN_REASON;

/** Ready-to-paste LINE message after a password reset (always Thai: it goes to the shop's staff). */
export function buildPasswordMessage(v: { email: string; password: string; loginUrl: string }): string {
  return [
    'สวัสดีครับ/ค่ะ ทีม CoreUp ตั้งรหัสผ่านใหม่ให้แล้ว',
    `อีเมล: ${v.email}`,
    `รหัสผ่านใหม่: ${v.password}`,
    `เข้าได้ที่ ${v.loginUrl}`,
    'เมื่อเข้าระบบได้แล้ว แนะนำให้เปลี่ยนรหัสผ่านใหม่เป็นของตัวเองอีกครั้ง',
  ].join('\n');
}

/** Ready-to-paste LINE message with a one-time set-password link. */
export function buildResetLinkMessage(v: { email: string; url: string; expiresAtLabel: string }): string {
  return [
    'สวัสดีครับ/ค่ะ ทีม CoreUp ส่งลิงก์ตั้งรหัสผ่านใหม่ให้แล้ว',
    `อีเมล: ${v.email}`,
    `กดลิงก์เพื่อตั้งรหัสผ่านใหม่: ${v.url}`,
    `ลิงก์ใช้ได้ครั้งเดียว หมดอายุ ${v.expiresAtLabel}`,
  ].join('\n');
}

/** "Chrome · macOS" from a User-Agent string; null when it says nothing useful. */
export function describeUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\/|CriOS\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : null;
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/.test(ua)
        ? 'iOS'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  const parts = [browser, os].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export type UserActionError = 'self' | 'noEmail';

/** The API's specific 409 reasons for account actions (otherwise null → generic error toast). */
export function userActionError(e: unknown): UserActionError | null {
  if (!isApiError(e) || e.status !== 409) return null;
  const reason = (e.details as { reason?: string } | undefined)?.reason;
  if (reason === 'self') return 'self';
  if (reason === 'no_email') return 'noEmail';
  return null;
}
