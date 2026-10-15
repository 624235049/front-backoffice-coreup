import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useInvalidate } from '@/lib/query';
import { useLeadSummary } from './api';

/**
 * Red badge on the "Lead" nav item: how many website leads nobody has contacted yet. Polled (api.ts), and a toast
 * appears when the count goes up while the console is open. Mounted only for members who may open the Leads page.
 */
export function useNewLeadBadge(): number {
  const { t } = useTranslation('platform');
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const summary = useLeadSummary();
  const count = summary.data?.newCount ?? 0;
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!summary.data) return;
    // first load only sets the baseline; later increases are new leads
    if (last.current !== null && count > last.current) {
      invalidate('platform', 'leads');
      toast(t('leads.newToast', { count: count - last.current }), {
        id: 'new-lead',
        action: { label: t('leads.newToastOpen'), onClick: () => navigate({ to: '/platform/leads' }) },
      });
    }
    last.current = count;
  }, [summary.data, count, navigate, invalidate, t]);

  return count;
}
