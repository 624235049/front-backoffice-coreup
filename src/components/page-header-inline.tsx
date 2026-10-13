import type { ReactNode } from 'react';

/** Section header inside a page that already has a PageHeader (e.g. a settings tab). */
export function PageHeaderInline({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
