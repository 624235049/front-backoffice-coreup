import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { Copy, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** `+66812345678` → `+66 81 234 5678` (international, any country); anything that does not parse is shown as stored. */
export function formatMobile(phone: string): string {
  return parsePhoneNumberFromString(phone)?.formatInternational() ?? phone;
}

/**
 * The owner's mobile (E.164) shown international as a `tel:` link with a copy button (copies E.164), so a salesperson can call a trial shop straight away.
 * Shops that never gave one show "—".
 */
export function OwnerPhone({ phone, className }: { phone: string | null; className?: string }) {
  const { t } = useTranslation('platform');
  if (!phone) return <span className="text-muted-foreground">—</span>;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      toast.success(t('ownerPhone.copied'));
    } catch {
      toast.error(t('ownerPhone.copyFailed', { phone }));
    }
  };
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <a
        href={`tel:${phone}`}
        // clicks must not open the shop row behind
        onClick={(e) => e.stopPropagation()}
        className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary hover:underline"
        data-testid="owner-phone-link"
      >
        <Phone className="size-3.5" aria-hidden />
        {formatMobile(phone)}
      </a>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={(e) => {
          e.stopPropagation();
          void copy();
        }}
        aria-label={t('ownerPhone.copy')}
        data-testid="owner-phone-copy"
      >
        <Copy className="size-3.5" aria-hidden />
      </Button>
    </span>
  );
}
