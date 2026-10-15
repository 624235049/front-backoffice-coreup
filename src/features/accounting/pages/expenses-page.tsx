import { useNavigate } from '@tanstack/react-router';
import { Download, Paperclip, Plus, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { PageHeader } from '@/components/page-header';
import { ListSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, useIntlLocale } from '@/features/platform/format';
import { type ExpenseRow, useExpenseCategories, useExpenses } from '../api';
import { DataTable, DtCell, DtHead, DtRow, DtTh, DtTotalCell, DtTotals } from '../components/data-table';
import { DateRangeFilter, FilterBar, SearchBox, StatusFilter } from '../components/filter-bar';
import { formatAmount } from '../lib/format';
import { type ListSearch, useUrlFilters } from '../lib/url-search';
import { downloadXlsx } from '../lib/xlsx';

export function PaidBadge({ status }: { status: ExpenseRow['paymentStatus'] }) {
  const { t } = useTranslation('accounting');
  return <Badge variant={status === 'paid' ? 'success' : 'warning'}>{t(`expense.status.${status}`)}</Badge>;
}

export function ExpensesPage() {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const navigate = useNavigate();
  const [search, patch] = useUrlFilters<ListSearch>();
  const categories = useExpenseCategories();
  const paymentStatus = search.status === 'paid' || search.status === 'unpaid' ? search.status : undefined;
  const query = useExpenses({
    q: search.q,
    categoryId: search.category,
    paymentStatus,
    from: search.from,
    to: search.to,
  });

  const { rows, totals } = useMemo(() => {
    const pages = query.data?.pages ?? [];
    return { rows: pages.flatMap((p) => p.data), totals: pages[0]?.totals ?? null };
  }, [query.data]);
  const hasFilters = Boolean(search.q || search.status || search.category || search.from || search.to);
  const add = () => void navigate({ to: '/accounting/expenses/new' as never });
  const open = (r: ExpenseRow) => void navigate({ to: `/accounting/expenses/${r.id}` as never });

  const exportXlsx = () =>
    void downloadXlsx(t('expense.title'), [
      {
        name: t('expense.title'),
        totalsLabel: t('totalRow'),
        columns: [
          { header: t('expense.date'), kind: 'date' as const, value: (r: ExpenseRow) => r.expenseDate },
          { header: t('expense.vendor'), value: (r: ExpenseRow) => r.vendorName },
          { header: t('expense.vendorTaxId'), value: (r: ExpenseRow) => r.vendorTaxId ?? '' },
          { header: t('expense.category'), value: (r: ExpenseRow) => r.categoryName },
          { header: t('expense.reference'), value: (r: ExpenseRow) => r.reference ?? '' },
          { header: t('expense.descriptionLabel'), value: (r: ExpenseRow) => r.description ?? '' },
          {
            header: t('col.base'),
            kind: 'money' as const,
            total: true,
            value: (r: ExpenseRow) => r.taxableMinor + r.exemptMinor,
          },
          { header: t('col.vat'), kind: 'money' as const, total: true, value: (r: ExpenseRow) => r.vatMinor },
          {
            header: t('col.total'),
            kind: 'money' as const,
            total: true,
            value: (r: ExpenseRow) => r.totalMinor,
          },
          {
            header: t('expense.whtDeducted'),
            kind: 'money' as const,
            total: true,
            value: (r: ExpenseRow) => r.whtMinor,
          },
          {
            header: t('expense.netPaid'),
            kind: 'money' as const,
            total: true,
            value: (r: ExpenseRow) => r.netMinor,
          },
          { header: t('col.status'), value: (r: ExpenseRow) => t(`expense.status.${r.paymentStatus}`) },
        ],
        rows,
      },
    ] as never).then(
      () => toast.success(t('fileSaved')),
      () => toast.error(t('exportFailed')),
    );

  return (
    <>
      <PageHeader
        title={t('expense.title')}
        description={t('expense.description')}
        actions={
          <>
            <Button
              variant="outline"
              onClick={exportXlsx}
              blockedReason={rows.length === 0 && t('nothingToExport')}
            >
              <Download /> {t('exportExcel')}
            </Button>
            <Button onClick={add}>
              <Plus /> {t('expense.add')}
            </Button>
          </>
        }
      />
      <FilterBar
        active={hasFilters}
        onClear={() =>
          patch({ q: undefined, status: undefined, category: undefined, from: undefined, to: undefined })
        }
      >
        <SearchBox value={search.q ?? ''} onCommit={(q) => patch({ q })} placeholder={t('expense.search')} />
        <StatusFilter
          value={search.category}
          onChange={(v) => patch({ category: v })}
          options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          allLabel={t('expense.allCategories')}
          label={t('expense.category')}
        />
        <StatusFilter
          value={paymentStatus}
          onChange={(v) => patch({ status: v })}
          options={[
            { value: 'unpaid', label: t('expense.status.unpaid') },
            { value: 'paid', label: t('expense.status.paid') },
          ]}
          allLabel={t('filter.allStatuses')}
          label={t('col.status')}
        />
        <DateRangeFilter
          from={search.from}
          to={search.to}
          onChange={(r) => patch({ from: r.from, to: r.to })}
        />
      </FilterBar>

      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={hasFilters ? t('emptyFiltered') : t('expense.empty')}
          description={hasFilters ? undefined : t('expense.emptyHint')}
          action={
            hasFilters ? undefined : (
              <Button onClick={add}>
                <Plus /> {t('expense.add')}
              </Button>
            )
          }
        />
      ) : (
        <>
          <ul className="grid gap-2 md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => open(r)}
                  className="flex w-full flex-col gap-1.5 rounded-xl border bg-white p-3 text-left shadow-xs active:bg-mint-50"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-medium">{r.vendorName}</span>
                    <PaidBadge status={r.paymentStatus} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r.categoryName} · {formatDate(r.expenseDate, locale)}
                  </span>
                  <span className="text-right text-base font-semibold text-navy-900 tabular-nums">
                    {formatAmount(r.totalMinor, locale)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <DataTable>
              <DtHead>
                <DtTh>{t('expense.date')}</DtTh>
                <DtTh>{t('expense.vendor')}</DtTh>
                <DtTh>{t('expense.category')}</DtTh>
                <DtTh>{t('expense.reference')}</DtTh>
                <DtTh num>{t('col.base')}</DtTh>
                <DtTh num>{t('col.vat')}</DtTh>
                <DtTh num>{t('col.total')}</DtTh>
                <DtTh num>{t('expense.whtDeducted')}</DtTh>
                <DtTh num>{t('expense.netPaid')}</DtTh>
                <DtTh>{t('col.status')}</DtTh>
              </DtHead>
              <tbody>
                {rows.map((r) => (
                  <DtRow key={r.id} onClick={() => open(r)}>
                    <DtCell className="whitespace-nowrap">{formatDate(r.expenseDate, locale)}</DtCell>
                    <DtCell className="max-w-64">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{r.vendorName}</span>
                        {r.receiptFileId ? (
                          <Paperclip
                            className="size-3.5 shrink-0 text-mint-700"
                            aria-label={t('expense.hasReceipt')}
                          />
                        ) : null}
                      </div>
                      {r.description ? (
                        <div className="truncate text-xs text-muted-foreground">{r.description}</div>
                      ) : null}
                    </DtCell>
                    <DtCell>{r.categoryName}</DtCell>
                    <DtCell className="font-mono text-xs">{r.reference ?? '–'}</DtCell>
                    <DtCell num>{formatAmount(r.taxableMinor + r.exemptMinor, locale)}</DtCell>
                    <DtCell num>{formatAmount(r.vatMinor, locale)}</DtCell>
                    <DtCell num className="font-medium">
                      {formatAmount(r.totalMinor, locale)}
                    </DtCell>
                    <DtCell num>{r.whtMinor ? formatAmount(r.whtMinor, locale) : '–'}</DtCell>
                    <DtCell num>{formatAmount(r.netMinor, locale)}</DtCell>
                    <DtCell>
                      <PaidBadge status={r.paymentStatus} />
                    </DtCell>
                  </DtRow>
                ))}
              </tbody>
              {totals ? (
                <DtTotals label={`${t('totalRow')} (${totals.count})`} span={4}>
                  <DtTotalCell>{formatAmount(totals.totalMinor - totals.vatMinor, locale)}</DtTotalCell>
                  <DtTotalCell>{formatAmount(totals.vatMinor, locale)}</DtTotalCell>
                  <DtTotalCell>{formatAmount(totals.totalMinor, locale)}</DtTotalCell>
                  <DtTotalCell>{formatAmount(totals.whtMinor, locale)}</DtTotalCell>
                  <DtTotalCell>{formatAmount(totals.netMinor, locale)}</DtTotalCell>
                  <DtTotalCell />
                </DtTotals>
              ) : null}
            </DataTable>
          </div>
          {totals ? (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-navy-50 px-4 py-3 text-sm font-semibold text-navy-900 md:hidden">
              <span>
                {t('totalRow')} ({totals.count})
              </span>
              <span className="tabular-nums">{formatAmount(totals.totalMinor, locale)}</span>
            </div>
          ) : null}
          {query.hasNextPage ? (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={() => void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {t('loadMore')}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
