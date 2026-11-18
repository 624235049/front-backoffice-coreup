import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { type InboxStatus, WORK_STATUSES, type WorkStatus } from '../api';

export const statusTone: Record<InboxStatus, string> = {
  new: 'bg-primary/10 text-primary',
  needs_staff: 'bg-destructive/10 font-semibold text-destructive',
  in_progress: 'bg-warning/15 text-warning',
  waiting_customer: 'bg-muted text-muted-foreground',
  done: 'bg-success/15 text-success',
};

/** The work status of a chat as a coloured chip (the AI hand-over is the red "ต้องใช้เจ้าหน้าที่" one). */
export function StatusChip({ status, assignee }: { status: InboxStatus; assignee?: string | null }) {
  const { t } = useTranslation('pageInbox');
  return (
    <span
      className={cn('shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-medium', statusTone[status])}
      data-testid={status === 'needs_staff' ? 'needs-staff-chip' : 'status-chip'}
      data-status={status}
    >
      {t(`status.${status}`)}
      {status === 'in_progress' && assignee ? ` · ${assignee}` : ''}
    </span>
  );
}

/** The dropdown of the thread header: the four statuses the team sets; the AI hand-over is shown (not pickable) while it lasts. */
export function StatusSelect({
  status,
  disabled,
  onChange,
}: {
  status: InboxStatus;
  disabled?: boolean;
  onChange: (s: WorkStatus) => void;
}) {
  const { t } = useTranslation('pageInbox');
  return (
    <select
      className="h-8 rounded-md border bg-background px-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={t('status.label')}
      data-testid="status-select"
      value={status}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as WorkStatus)}
    >
      {status === 'needs_staff' ? (
        <option value="needs_staff" disabled>
          {t('status.needs_staff')}
        </option>
      ) : null}
      {WORK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(`status.${s}`)}
        </option>
      ))}
    </select>
  );
}
