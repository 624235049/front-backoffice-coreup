import type * as React from 'react';
import { cn } from '@/lib/utils';

// Chrome ignores autocomplete="off": it still offers saved names, emails, phones and addresses in any field it
// recognises. "one-time-code" is a valid token every browser respects: Chrome then treats the field as a code
// (chrome://autofill-internals: ONE_TIME_CODE, no profile data), Safari and Firefox offer at most an SMS code.
const NO_AUTOFILL = 'one-time-code';

/** Opt-outs for 1Password and LastPass; spread on any field that is not the person's own login. */
export const NO_PASSWORD_MANAGER = { 'data-1p-ignore': true, 'data-lpignore': 'true' } as const;

/** `autoComplete` for a field: none or "off" = never fill it; any other token (username, email, tel-national...) is kept as given. */
export function autofillProps(autoComplete?: string, type?: string) {
  if (autoComplete && autoComplete !== 'off') return { autoComplete };
  return { autoComplete: type === 'password' ? 'new-password' : NO_AUTOFILL, ...NO_PASSWORD_MANAGER };
}

function Input({ className, type, autoComplete, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      {...autofillProps(autoComplete, type)}
      className={cn(
        'flex h-11 w-full min-w-0 rounded-lg border border-input bg-white px-3 py-2 text-base shadow-xs transition-colors outline-none placeholder:text-muted-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/30 md:text-sm',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
