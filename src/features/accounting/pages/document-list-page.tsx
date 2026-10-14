import { Link, useNavigate } from '@tanstack/react-router';
import { Download, ExternalLink, FileText, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { PageHeader } from '@/components/page-header';
import { ListSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { formatDate, useIntlLocale } from '@/features/platform/format';
import {
  type DocStatus,
  type DocType,
  type DocumentItem,
  type SalesListFilter,
  type SalesRow,
  useCompany,
  useDocuments,
  useSales,
} from '../api';
import { DocStatusBadge, SourceBadge } from '../components/badges';
import { DataTable, DtCell, DtHead, DtRow, DtTh, DtTotalCell, DtTotals } from '../components/data-table';
import { DateRangeFilter, FilterBar, SearchBox, StatusFilter } from '../components/filter-bar';
import { type DocKind, detailPath, KIND_STATUSES, newPath, SHOP_INVOICES_PATH } from '../lib/doc-meta';
import { formatAmount } from '../lib/format';
import { type ListSearch, useUrlFilters } from '../lib/url-search';
import { downloadXlsx } from '../lib/xlsx';

/** One normalised row for every list (our documents and read-only shop invoices). */
type Row = {
  key: string;
  id: string;
  source: SalesRow['source'];
  type: DocType;
  number: string | null;
  status: DocStatus;
  overdue: boolean;
  docDate: string;
  dueDate: string | null;
  contactName: string;
  baseMinor: number;
  vatMinor: number;
  totalMinor: number;
  balanceMinor: number;
  readOnly: boolean;
};

const fromDocument = (d: DocumentItem): Row => ({
  key: d.id,
  id: d.id,
  source: 'accounting',
  type: d.type,
  number: d.number,
  status: d.status,
  overdue: d.overdue,
  docDate: d.docDate,
  dueDate: d.dueDate,
  contactName: d.contact.name,
  baseMinor: d.totalMinor - d.vatMinor,
  vatMinor: d.vatMinor,
  totalMinor: d.totalMinor,
  balanceMinor: d.balanceMinor,
  readOnly: false,
});

const fromSales = (s: SalesRow): Row => ({
  key: `${s.source}:${s.id}`,
  id: s.id,
  source: s.source,
  type: s.type,
  number: s.number,
  status: s.status,
  overdue: s.overdue,
  docDate: s.docDate,
  dueDate: s.dueDate,
  contactName: s.contactName,
  baseMinor: s.baseMinor,
  vatMinor: s.vatMinor,
  totalMinor: s.totalMinor,
  balanceMinor: s.balanceMinor,
  readOnly: s.readOnly,
});

type Totals = { count: number; totalMinor: number; vatMinor: number; balanceMinor: number };

/** Shared list screen for quotations, invoices, receipts / tax invoices and credit notes. */
export function DocumentListPage({ kind }: { kind: DocKind }) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const navigate = useNavigate();
  const [search, patch] = useUrlFilters<ListSearch>();
  const company = useCompany();

  // Receipts screen: one type at a time (RE vs TX), default follows the company's VAT registration.
  const receiptType: 'receipt' | 'tax_invoice' =
    search.type === 'receipt' || search.type === 'tax_invoice'
      ? search.type
      : company.data?.vatRegistered
        ? 'tax_invoice'
        : 'receipt';

  const status = search.status as (DocStatus | 'overdue') | undefined;
  const base = { q: search.q, from: search.from, to: search.to };
  const quotations = useDocuments({ ...base, type: 'quotation', status: status as DocStatus | undefined });
  const salesFilter: SalesListFilter = {
    ...base,
    type: kind === 'receipt' ? receiptType : kind === 'credit_note' ? 'credit_note' : 'invoice',
    status,
    source: kind === 'invoice' ? (search.source as SalesListFilter['source']) : undefined,
  };
  const sales = useSales(salesFilter);
  const query = kind === 'quotation' ? quotations : sales;

  const { rows, totals } = useMemo(() => {
    const pages = query.data?.pages ?? [];
    const all: Row[] = pages.flatMap((p) =>
      (p.data as (DocumentItem | SalesRow)[]).map((r) => ('contact' in r ? fromDocument(r) : fromSales(r))),
    );
    return { rows: all, totals: (pages[0]?.totals ?? null) as Totals | null };
  }, [query.data]);

  const hasFilters = Boolean(search.q || search.status || search.from || search.to || search.source);
  const showBalance = kind === 'invoice';
  const showDue = kind === 'invoice' || kind === 'quotation';
  const open = (r: Row) => {
    if (r.readOnly) return;
    void navigate({ to: detailPath(r.type, r.id) as never });
  };

  const exportXlsx = () => {
    void downloadXlsx(`${t(`list.${kind}.title`)}`, [
      {
        name: t(`list.${kind}.title`),
        totalsLabel: t('totalRow'),
        columns: [
          { header: t('col.number'), value: (r: Row) => r.number ?? '' },
          { header: t('col.date'), kind: 'date' as const, value: (r: Row) => r.docDate },
          ...(showDue
            ? [
                {
                  header: showBalance ? t('col.due') : t('col.validUntil'),
                  kind: 'date' as const,
                  value: (r: Row) => r.dueDate,
                },
              ]
            : []),
          { header: t('col.customer'), value: (r: Row) => r.contactName },
          { header: t('col.status'), value: (r: Row) => t(`status.${r.status}`) },
          { header: t('col.base'), kind: 'money' as const, total: true, value: (r: Row) => r.baseMinor },
          { header: t('col.vat'), kind: 'money' as const, total: true, value: (r: Row) => r.vatMinor },
          { header: t('col.total'), kind: 'money' as const, total: true, value: (r: Row) => r.totalMinor },
          ...(showBalance
            ? [
                {
                  header: t('col.balance'),
                  kind: 'money' as const,
                  total: true,
                  value: (r: Row) => r.balanceMinor,
                },
              ]
            : []),
        ],
        rows,
      },
    ] as never).catch(() => toast.error(t('exportFailed')));
  };

  const statusOptions = KIND_STATUSES[kind].map((s) => ({ value: s, label: t(`status.${s}`) }));

  return (
    <>
      <PageHeader
        title={t(`list.${kind}.title`)}
        description={t(`list.${kind}.description`)}
        actions={
          <>
            <Button variant="outline" onClick={exportXlsx} disabled={rows.length === 0}>
              <Download /> {t('exportExcel')}
            </Button>
            <Button onClick={() => void navigate({ to: newPath(kind) as never })}>
              <Plus /> {t(`list.${kind}.add`)}
            </Button>
          </>
        }
      />

      <FilterBar
        active={hasFilters}
        onClear={() =>
          patch({ q: undefined, status: undefined, from: undefined, to: undefined, source: undefined })
        }
      >
        <SearchBox
          value={search.q ?? ''}
          onCommit={(q) => patch({ q })}
          placeholder={t('filter.searchDocs')}
        />
        {kind === 'receipt' ? (
          <StatusFilter
            value={receiptType}
            onChange={(v) => patch({ type: v })}
            options={[
              { value: 'receipt', label: t('type.receipt') },
              { value: 'tax_invoice', label: t('type.tax_invoice') },
            ]}
            allLabel={t(`type.${receiptType}`)}
            label={t('col.type')}
          />
        ) : null}
        <StatusFilter
          value={search.status}
          onChange={(v) => patch({ status: v })}
          options={statusOptions}
          allLabel={t('filter.allStatuses')}
          label={t('col.status')}
        />
        {kind === 'invoice' ? (
          <StatusFilter
            value={search.source}
            onChange={(v) => patch({ source: v })}
            options={[
              { value: 'accounting', label: t('source.accounting') },
              { value: 'shop_package', label: t('source.shop_package') },
              { value: 'shop_engagement', label: t('source.shop_engagement') },
            ]}
            allLabel={t('filter.allSources')}
            label={t('col.source')}
          />
        ) : null}
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
          icon={FileText}
          title={hasFilters ? t('emptyFiltered') : t(`list.${kind}.empty`)}
          description={hasFilters ? undefined : t(`list.${kind}.emptyHint`)}
          action={
            hasFilters ? undefined : (
              <Button onClick={() => void navigate({ to: newPath(kind) as never })}>
                <Plus /> {t(`list.${kind}.add`)}
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* phone: cards */}
          <ul className="grid gap-2 md:hidden">
            {rows.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  disabled={r.readOnly}
                  onClick={() => open(r)}
                  className="flex w-full flex-col gap-1.5 rounded-xl border bg-white p-3 text-left shadow-xs active:bg-mint-50 disabled:cursor-default"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs text-navy-700">{r.number ?? t('draftNumber')}</span>
                    <DocStatusBadge status={r.status} overdue={r.overdue} />
                  </span>
                  <span className="font-medium">{r.contactName}</span>
                  <span className="flex items-end justify-between gap-2 text-sm text-muted-foreground">
                    <span>
                      {formatDate(r.docDate, locale)}
                      {showDue && r.dueDate ? ` → ${formatDate(r.dueDate, locale)}` : ''}
                    </span>
                    <span className="text-base font-semibold text-navy-900 tabular-nums">
                      {formatAmount(r.totalMinor, locale)}
                    </span>
                  </span>
                  <SourceBadge source={r.source} />
                </button>
              </li>
            ))}
          </ul>

          {/* desktop: sticky-header table with totals */}
          <div className="hidden md:block">
            <DataTable>
              <DtHead>
                <DtTh>{t('col.number')}</DtTh>
                <DtTh>{t('col.date')}</DtTh>
                {showDue ? <DtTh>{showBalance ? t('col.due') : t('col.validUntil')}</DtTh> : null}
                <DtTh>{t('col.customer')}</DtTh>
                <DtTh num>{t('col.base')}</DtTh>
                <DtTh num>{t('col.vat')}</DtTh>
                <DtTh num>{t('col.total')}</DtTh>
                {showBalance ? <DtTh num>{t('col.balance')}</DtTh> : null}
                <DtTh>{t('col.status')}</DtTh>
              </DtHead>
              <tbody>
                {rows.map((r) => (
                  <DtRow key={r.key} onClick={r.readOnly ? undefined : () => open(r)}>
                    <DtCell className="font-mono text-xs whitespace-nowrap">
                      {r.number ?? <span className="text-muted-foreground">{t('draftNumber')}</span>}
                    </DtCell>
                    <DtCell className="whitespace-nowrap">{formatDate(r.docDate, locale)}</DtCell>
                    {showDue ? (
                      <DtCell className="whitespace-nowrap">{formatDate(r.dueDate, locale)}</DtCell>
                    ) : null}
                    <DtCell className="max-w-72">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate">{r.contactName}</span>
                        <SourceBadge source={r.source} />
                        {r.readOnly ? (
                          <Link
                            to={SHOP_INVOICES_PATH as never}
                            className="inline-flex items-center gap-1 text-xs text-mint-700 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="size-3" /> {t('openInBilling')}
                          </Link>
                        ) : null}
                      </div>
                    </DtCell>
                    <DtCell num>{formatAmount(r.baseMinor, locale)}</DtCell>
                    <DtCell num>{formatAmount(r.vatMinor, locale)}</DtCell>
                    <DtCell num className="font-medium">
                      {formatAmount(r.totalMinor, locale)}
                    </DtCell>
                    {showBalance ? (
                      <DtCell num className={r.balanceMinor > 0 ? 'text-warning' : 'text-muted-foreground'}>
                        {formatAmount(r.balanceMinor, locale)}
                      </DtCell>
                    ) : null}
                    <DtCell>
                      <DocStatusBadge status={r.status} overdue={r.overdue} />
                    </DtCell>
                  </DtRow>
                ))}
              </tbody>
              {totals ? (
                <DtTotals label={`${t('totalRow')} (${totals.count})`} span={showDue ? 4 : 3}>
                  <DtTotalCell>{formatAmount(totals.totalMinor - totals.vatMinor, locale)}</DtTotalCell>
                  <DtTotalCell>{formatAmount(totals.vatMinor, locale)}</DtTotalCell>
                  <DtTotalCell>{formatAmount(totals.totalMinor, locale)}</DtTotalCell>
                  {showBalance ? (
                    <DtTotalCell>{formatAmount(totals.balanceMinor, locale)}</DtTotalCell>
                  ) : null}
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
