import { Eye, EyeOff } from 'lucide-react';
import { type ComponentProps, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, NO_PASSWORD_MANAGER } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Password field with an eye button to show what was typed (props, incl. FormControl's id/aria, go to the input).
 * No `autoComplete` = a secret that is not the person's own login (LINE token, staff password, PIN check): Chrome and
 * password managers stay out. Login and reset pages pass `current-password` / `new-password` themselves.
 */
export function PasswordInput({ className, autoComplete, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const { t } = useTranslation('common');
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input
        type={shown ? 'text' : 'password'}
        autoComplete={autoComplete ?? 'new-password'}
        {...(autoComplete ? {} : NO_PASSWORD_MANAGER)}
        className={cn('pr-11', className)}
        {...props}
      />
      <button
        type="button"
        className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
        aria-label={shown ? t('hidePassword') : t('showPassword')}
        aria-pressed={shown}
        onClick={() => setShown((v) => !v)}
      >
        {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}
