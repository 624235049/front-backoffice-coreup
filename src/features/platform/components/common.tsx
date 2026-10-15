import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** One headline number on a dashboard / tab. */
export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: 'default' | 'warning' | 'destructive';
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div
            className={cn(
              'mt-1 text-2xl font-semibold tracking-tight',
              tone === 'warning' && 'text-warning',
              tone === 'destructive' && 'text-destructive',
            )}
          >
            {value}
          </div>
          {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
        </div>
        {Icon ? <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden /> : null}
      </CardContent>
    </Card>
  );
}

const STATUS_TONE = {
  active: 'success',
  trial: 'secondary',
  paused: 'warning',
  closed: 'destructive',
} as const;

/** Status text + colour (never colour alone — docs/04 §6). */
export function TenantStatusBadge({ status }: { status: keyof typeof STATUS_TONE }) {
  const { t } = useTranslation('platform');
  return <Badge variant={STATUS_TONE[status]}>{t(`tenantStatus.${status}`)}</Badge>;
}

const HEALTH_TONE = { good: 'success', declining: 'warning', at_risk: 'destructive' } as const;

export function UsageHealthBadge({ health }: { health: keyof typeof HEALTH_TONE }) {
  const { t } = useTranslation('platform');
  return <Badge variant={HEALTH_TONE[health]}>{t(`usageHealth.${health}`)}</Badge>;
}

/** Small labelled value used in detail headers. */
export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

export const INDUSTRY_KEYS = ['generic', 'clinic', 'dental', 'spa', 'salon'] as const;
