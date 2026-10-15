import { describe, expect, it } from 'vitest';
import {
  buildPasswordMessage,
  buildResetLinkMessage,
  describeUserAgent,
  loginUrlFor,
  passwordProblem,
  reasonReady,
  userActionError,
} from '@/features/platform/user-helpers';
import { ApiError } from '@/lib/api';

describe('password rule (same as sign-up: 8–128)', () => {
  it('accepts the boundaries and rejects outside them', () => {
    expect(passwordProblem('1234567')).toBe('tooShort');
    expect(passwordProblem('12345678')).toBeNull();
    expect(passwordProblem('x'.repeat(128))).toBeNull();
    expect(passwordProblem('x'.repeat(129))).toBe('tooLong');
  });

  it('counts a Thai reason by trimmed length', () => {
    expect(reasonReady('   ลืมรหัส   ')).toBe(false);
    expect(reasonReady('ลืมรหัสผ่าน ขอรีเซ็ต')).toBe(true);
  });
});

describe('hand-over messages', () => {
  it('carries email, new password and login address for the LINE chat', () => {
    const msg = buildPasswordMessage({
      email: 'qa6@local.test',
      password: 'Kd7m-Qx3p-Tn8w',
      loginUrl: 'https://coreup.biz',
    });
    expect(msg).toContain('อีเมล: qa6@local.test');
    expect(msg).toContain('รหัสผ่านใหม่: Kd7m-Qx3p-Tn8w');
    expect(msg).toContain('เข้าได้ที่ https://coreup.biz');
  });

  it('the link message carries the link and its expiry', () => {
    const msg = buildResetLinkMessage({
      email: 'qa6@local.test',
      url: 'https://api.coreup.biz/v1/auth/reset-password/abc?callbackURL=x',
      expiresAtLabel: '15 ต.ค. 2569 15:40',
    });
    expect(msg).toContain('https://api.coreup.biz/v1/auth/reset-password/abc?callbackURL=x');
    expect(msg).toContain('หมดอายุ 15 ต.ค. 2569 15:40');
  });

  it('team accounts sign in at this back office, shop staff at the shop app', () => {
    expect(loginUrlFor({ isTeam: true }, 'https://admin.coreup.biz/')).toBe('https://admin.coreup.biz');
    expect(loginUrlFor({ isTeam: false }, 'https://admin.coreup.biz')).toBe('https://coreup.biz');
  });
});

describe('sign-in device label', () => {
  it('names browser and system, null when unknown', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      ),
    ).toBe('Chrome · macOS');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17 Safari/604',
      ),
    ).toBe('Safari · iOS');
    expect(describeUserAgent('curl/8.0')).toBeNull();
    expect(describeUserAgent(null)).toBeNull();
  });
});

describe('API refusal reasons', () => {
  const conflict = (reason: string) =>
    new ApiError({ status: 409, code: 'CONFLICT', message: 'x', details: { reason } });

  it('maps the specific 409s and leaves everything else generic', () => {
    expect(userActionError(conflict('self'))).toBe('self');
    expect(userActionError(conflict('no_email'))).toBe('noEmail');
    expect(userActionError(conflict('other'))).toBeNull();
    expect(userActionError(new ApiError({ status: 429, code: 'RATE_LIMITED', message: 'x' }))).toBeNull();
    expect(userActionError(new Error('boom'))).toBeNull();
  });
});
