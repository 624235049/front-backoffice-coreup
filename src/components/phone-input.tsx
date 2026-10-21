import {
  AsYouType,
  type CountryCode,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js/mobile';
import { Check, ChevronDown } from 'lucide-react';
import { type ClipboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { normalizeMobileE164, parseMobile } from '@/lib/phone';
import { cn } from '@/lib/utils';

/** Countries CoreUp's customers are most likely to dial from, pinned in this order above the rest. */
export const PINNED_COUNTRIES: readonly CountryCode[] = ['TH', 'LA', 'MM', 'KH', 'MY', 'VN', 'SG', 'CN'];

const flagOf = (c: string) => String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0)));

type CountryOption = { code: CountryCode; dial: string; th: string; en: string; flag: string };

let cached: CountryOption[] | undefined;
function countryOptions(): CountryOption[] {
  if (cached) return cached;
  const th = new Intl.DisplayNames(['th'], { type: 'region' });
  const en = new Intl.DisplayNames(['en'], { type: 'region' });
  const all = getCountries().map((code) => ({
    code,
    dial: `+${getCountryCallingCode(code)}`,
    th: th.of(code) ?? code,
    en: en.of(code) ?? code,
    flag: flagOf(code),
  }));
  const pinned = PINNED_COUNTRIES.flatMap((c) => all.find((x) => x.code === c) ?? []);
  const rest = all
    .filter((x) => !PINNED_COUNTRIES.includes(x.code))
    .sort((a, b) => a.th.localeCompare(b.th, 'th'));
  cached = [...pinned, ...rest];
  return cached;
}

const isMobile = (p: ReturnType<typeof parseMobile>) =>
  p?.isValid() === true &&
  (p.getType() === undefined || p.getType() === 'MOBILE' || p.getType() === 'FIXED_LINE_OR_MOBILE');

const digitsOf = (s: string) => s.replace(/\D/g, '');

/** What a typed / pasted text means: the country it points at (when it carries a `+<code>`) and the number text. */
function interpret(text: string, country: CountryCode): { country: CountryCode; national: string } {
  const t = text.trim();
  if (t.startsWith('+') || t.startsWith('00')) {
    const p = parseMobile(t);
    const detected = p?.country;
    if (p && detected) return { country: detected, national: p.nationalNumber };
    // not fully typed yet: let AsYouType work out the country from the calling code so far
    const typing = new AsYouType();
    typing.input(t.startsWith('00') ? `+${t.slice(2)}` : t);
    const guess = typing.getCountry();
    if (guess) return { country: guess, national: typing.getNumber()?.nationalNumber ?? '' };
  }
  return { country, national: text };
}

function e164Of(country: CountryCode, text: string): string {
  const typing = new AsYouType(country);
  typing.input(text);
  return typing.getNumberValue() ?? '';
}

/**
 * Standard international mobile input: a searchable country-code select (default 🇹🇭 +66) in front of the number.
 * `value` / `onChange` are E.164 (`+66812345678`, '' when empty); a half-typed number is emitted as typed so the
 * form can tell it is not valid yet. Pasting `+66 81 234 5678` or `0812345678` picks Thailand and fills correctly.
 */
export function PhoneInput({
  id,
  value,
  onChange,
  disabled,
  invalid,
  errorText = true,
  describedBy,
  className,
  inputClassName,
  ...rest
}: {
  id?: string;
  value: string;
  onChange: (e164: string) => void;
  disabled?: boolean;
  /** force the error state (a form that failed submit validation) */
  invalid?: boolean;
  /** show the built-in error line (off when the surrounding form shows its own message) */
  errorText?: boolean;
  describedBy?: string;
  className?: string;
  inputClassName?: string;
  'data-testid'?: string;
}) {
  const { t, i18n } = useTranslation('common');
  const lang = i18n.language === 'en' ? 'en' : 'th';
  const autoId = useId();
  const inputId = id ?? autoId;
  const errId = `${inputId}-error`;
  const [country, setCountry] = useState<CountryCode>('TH');
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [blurred, setBlurred] = useState(false);
  const lastEmitted = useRef('');

  // the value came from outside (prefill, reset): show it; our own echoes are ignored
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    if (!value) {
      setText('');
      return;
    }
    const p = parseMobile(value);
    if (p?.country) {
      setCountry(p.country);
      setText(p.isValid() ? p.formatNational() : new AsYouType(p.country).input(p.nationalNumber));
    } else {
      setText(value);
    }
  }, [value]);

  const emit = (c: CountryCode, raw: string) => {
    const e164 = digitsOf(raw) === '' ? '' : e164Of(c, raw);
    // a complete number shows in its national format (081 234 5678), a half-typed one as AsYouType formats it
    const whole = e164 ? parsePhoneNumberFromString(e164) : undefined;
    setCountry(c);
    setText(whole?.isValid() && whole.country === c ? whole.formatNational() : new AsYouType(c).input(raw));
    lastEmitted.current = e164;
    onChange(e164);
  };

  const onType = (raw: string) => {
    // backspacing over a space / dash of the formatted number would re-add it forever: drop the digit before it
    const sameDigits = digitsOf(raw) === digitsOf(text) && raw.length < text.length;
    if (sameDigits) {
      const last = raw.search(/\d(?=\D*$)/);
      if (last >= 0) raw = raw.slice(0, last) + raw.slice(last + 1);
    }
    const next = interpret(raw, country);
    emit(next.country, next.national);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted.trim()) return;
    e.preventDefault();
    const s = pasted.trim();
    if (!s.startsWith('+') && !s.startsWith('00')) {
      // a bare number: valid where the picker is now stays there, else a Thai number (0812345678 / 66812345678)
      const here = parseMobile(s, country);
      if (country !== 'TH' ? isMobile(here) && here?.country === country : isMobile(here))
        return emit(country, here?.nationalNumber ?? s);
      const thai = parseMobile(s, 'TH');
      return isMobile(thai) ? emit('TH', thai?.nationalNumber ?? s) : emit(country, s);
    }
    const next = interpret(s, country);
    emit(next.country, next.national);
  };

  const complete = value !== '' && normalizeMobileE164(value) !== null;
  const showError = (invalid || (blurred && text.trim() !== '')) && !complete && !disabled;

  const options = useMemo(() => countryOptions(), []);
  const q = query.trim().toLowerCase();
  const shown = q
    ? options.filter((o) =>
        `${o.th} ${o.en} ${o.code} ${o.dial}`.toLowerCase().includes(q.replace(/^\+/, '+')),
      )
    : options;
  const current = options.find((o) => o.code === country);

  return (
    <div className={cn('grid gap-1', className)}>
      <div className="flex gap-2">
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setQuery('');
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label={t('phoneInput.country')}
              aria-haspopup="listbox"
              aria-expanded={open}
              data-testid="phone-country"
              className="flex h-11 min-w-[5.75rem] shrink-0 items-center gap-1.5 rounded-lg border border-input bg-white px-2.5 text-sm shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span aria-hidden className="text-lg leading-none">
                {current?.flag}
              </span>
              <span data-testid="phone-dial">{current?.dial}</span>
              <ChevronDown className="size-4 opacity-60" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="grid w-[min(22rem,calc(100vw-1.5rem))] gap-2 p-2">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('phoneInput.search')}
              aria-label={t('phoneInput.search')}
              data-testid="phone-country-search"
              autoComplete="off"
              autoFocus
            />
            <div role="listbox" aria-label={t('phoneInput.country')} className="max-h-64 overflow-y-auto">
              {shown.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">{t('phoneInput.noCountry')}</p>
              ) : (
                shown.map((o, i) => (
                  <div key={o.code}>
                    {i === PINNED_COUNTRIES.length && !q ? <hr className="my-1" /> : null}
                    <button
                      type="button"
                      role="option"
                      aria-selected={o.code === country}
                      data-testid={`phone-country-${o.code}`}
                      onClick={() => {
                        setOpen(false);
                        emit(o.code, text);
                      }}
                      className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    >
                      <span aria-hidden className="text-lg leading-none">
                        {o.flag}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {o[lang]}
                        <span className="text-muted-foreground"> · {lang === 'th' ? o.en : o.th}</span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">{o.dial}</span>
                      {o.code === country ? <Check className="size-4 shrink-0" aria-hidden /> : null}
                    </button>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Input
          id={inputId}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={text}
          disabled={disabled}
          maxLength={24}
          placeholder={new AsYouType(country).input(country === 'TH' ? '0812345678' : '')}
          aria-invalid={showError}
          aria-describedby={cn(showError && errorText && errId, describedBy) || undefined}
          onChange={(e) => onType(e.target.value)}
          onPaste={onPaste}
          onBlur={() => setBlurred(true)}
          className={cn('min-w-0 flex-1', inputClassName)}
          data-testid={rest['data-testid']}
        />
      </div>
      {showError && errorText ? (
        <p id={errId} role="alert" className="text-sm text-destructive" data-testid="phone-error">
          {t('phoneInput.invalid')}
        </p>
      ) : null}
    </div>
  );
}
