import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { formatDate, useIntlLocale } from '../format';

const DAY_MS = 86_400_000;
/** The API refuses an end date further than a year ahead. */
const MAX_DAYS = 365;

export type AiGrant = { active: true; enabledUntil: string; free?: true; note?: string };

/** A Bangkok calendar day (YYYY-MM-DD) `days` from now. */
const bangkokDay = (days: number, from = Date.now()) =>
  new Date(from + days * DAY_MS).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

/**
 * The add-on's end: a custom last day, billed unless "ให้ใช้ฟรี" is ticked on purpose (a free grant is never on an invoice).
 * There is no one-click free month any more: every shop already gets its first 100 AI messages free.
 * `enabledUntil` from the API is the first instant after the last day.
 */
export function AiFreeGrant({
  enabledUntil,
  free,
  disabled,
  onGrant,
}: {
  enabledUntil: string | null;
  free: boolean;
  disabled: boolean;
  onGrant: (grant: AiGrant) => void;
}) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const [day, setDay] = useState('');
  const [customFree, setCustomFree] = useState(false);
  const [note, setNote] = useState('');
  const lastDay = enabledUntil ? bangkokDay(0, Date.parse(enabledUntil) - 1) : null;
  const noteOf = note.trim() ? { note: note.trim() } : {};

  return (
    <section className="grid gap-2 rounded-lg border p-3" data-testid="ai-free-grant">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t('aiChat.grant.title')}</span>
        {lastDay ? (
          <Badge variant={free ? 'success' : 'outline'} data-testid="ai-grant-badge">
            {t(free ? 'aiChat.grant.freeUntil' : 'aiChat.grant.until', { date: formatDate(lastDay, locale) })}
          </Badge>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{t('aiChat.grant.hint')}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor="ai-grant-day" className="grid gap-1 text-sm">
          <span>{t('aiChat.grant.day')}</span>
          <Input
            id="ai-grant-day"
            type="date"
            className="w-44"
            min={bangkokDay(0)}
            max={bangkokDay(MAX_DAYS)}
            value={day}
            disabled={disabled}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        <label htmlFor="ai-grant-free" className="flex min-h-11 items-center gap-2 text-sm">
          <Checkbox
            id="ai-grant-free"
            checked={customFree}
            disabled={disabled}
            onCheckedChange={(on) => setCustomFree(on === true)}
          />
          {t('aiChat.grant.free')}
        </label>
        <Button
          variant="outline"
          data-testid="ai-grant-custom"
          disabled={disabled || day === ''}
          onClick={() =>
            onGrant({ active: true, enabledUntil: day, ...(customFree ? { free: true } : {}), ...noteOf })
          }
        >
          {t('aiChat.grant.apply')}
        </Button>
      </div>
      <label htmlFor="ai-grant-note" className="grid gap-1 text-sm">
        <span className="text-xs text-muted-foreground">{t('aiChat.grant.note')}</span>
        <Input
          id="ai-grant-note"
          maxLength={200}
          value={note}
          disabled={disabled}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
    </section>
  );
}
