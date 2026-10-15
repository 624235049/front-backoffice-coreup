import type { FieldErrors, FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

function countErrors(errors: FieldErrors): number {
  let n = 0;
  for (const v of Object.values(errors)) {
    if (!v || typeof v !== 'object') continue;
    if ('message' in v || 'type' in v) n += 1;
    else n += countErrors(v as FieldErrors);
  }
  return n;
}

/**
 * Second argument for `form.handleSubmit(onValid, onInvalid)`: a blocked submit always says why. The field
 * messages stay inline (and react-hook-form focuses the first one); the toast covers fields scrolled out of view.
 */
export function useInvalidToast<T extends FieldValues>() {
  const { t } = useTranslation('common');
  return (errors: FieldErrors<T>) => {
    toast.error(t('form.invalid', { count: Math.max(1, countErrors(errors)) }), { id: 'form-invalid' });
  };
}
