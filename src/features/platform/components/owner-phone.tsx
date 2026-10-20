import { Copy, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** "081-234-5678" for a 10-digit mobile; anything else as stored. */
export function formatMobile(phone: string): string {
  return /^\d{10}$/.test(phone) ? `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}` : phone;
}

/**
 * The owner's mobile as a `tel:` link with a copy button, so a salesperson can call a trial shop straight away.
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
