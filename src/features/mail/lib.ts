import type { OutboundStatus } from './api';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** "a@x.com, b@y.com; c@z.com" → the addresses typed, lower-cased, without duplicates. */
export function parseEmails(text: string): { valid: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const e = raw.trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    (EMAIL.test(e) ? valid : invalid).push(e);
  }
  return { valid, invalid };
}

/** The badge colour of each delivery status. */
export const STATUS_VARIANT: Record<OutboundStatus, 'secondary' | 'success' | 'warning' | 'destructive'> = {
  queued: 'secondary',
  sent: 'secondary',
  delivered: 'success',
  opened: 'success',
  bounced: 'destructive',
  complained: 'destructive',
  failed: 'destructive',
};
