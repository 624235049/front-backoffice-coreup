import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/ui/skeleton';

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="grid gap-2" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/**
 * One place for the loading / error / empty / data states every page needs:
 *
 *   <QueryState query={branches} isEmpty={(d) => d.data.length === 0} empty={<EmptyState .../>}>
 *     {(d) => <BranchTable rows={d.data} />}
 *   </QueryState>
 */
export function QueryState<T>({
  query,
  isEmpty,
  empty,
  skeleton = <ListSkeleton />,
  children,
}: {
  query: UseQueryResult<T, unknown>;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{skeleton}</>;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (isEmpty?.(query.data) && empty) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
