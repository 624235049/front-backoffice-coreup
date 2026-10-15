import { Download } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { PageHeader } from '@/components/page-header';
import { ListSkeleton, QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Stat } from '@/features/platform/components/common';
import { formatDate, todayBangkok, useIntlLocale } from '@/features/platform/format';
import {
  useExpensesByCategory,
  useProfitLoss,
  usePurchaseTax,
  useReceivables,
  useSalesTax,
  useWithholding,
} from '../api';
import { DataTable, DtCell, DtHead, DtRow, DtTh, DtTotalCell, DtTotals } from '../components/data-table';
import { DateRangeFilter } from '../components/filter-bar';
import { SeriesTable } from '../components/series-table';
import { formatAmount, formatAmountOrDash, formatBp, formatInt } from '../lib/format';
import { buildCategoryRows, buildProfitLossRows, formatPeriod, seriesColumns } from '../lib/reports';
import { type ReportSearch, useUrlFilters } from '../lib/url-search';
import { downloadXlsx, type XlsxSheet } from '../lib/xlsx';

type TabKey = NonNullable<ReportSearch['tab']>;
const TABS: readonly TabKey[] = ['pnl', 'receivables', 'vat', 'wht', 'expenses'];
const CHART_COLORS = ['#0B2D4F', '#38B2AA', '#E0A93B', '#4F78A3', '#82D8D2', '#7F9FC2', '#1D746F', '#AEC3DC'];

type Range = { from: string; to: string; granularity: 'month' | 'year' };

function useRange(search: ReportSearch): Range {
  const today = todayBangkok();
  return {
    from: search.from ?? `${today.slice(0, 4)}-01-01`,
    to: search.to ?? today,
    granularity: search.group ?? 'month',
  };
}

function GroupToggle({
  value,
  onChange,
}: {
  value: 'month' | 'year';
  onChange: (v: 'month' | 'year') => void;
}) {
  const { t } = useTranslation('accounting');
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as 'month' | 'year')}>
      <TabsList className="h-10">
        <TabsTrigger value="month">{t('report.monthly')}</TabsTrigger>
        <TabsTrigger value="year">{t('report.yearly')}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function ExportButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation('accounting');
  return (
    <Button variant="outline" onClick={onClick}>
      <Download /> {t('exportExcel')}
    </Button>
  );
}

/* ---------------------------------------------------------------- P&L */
function PnlTab({ range, onExport }: { range: Range; onExport: (fn: (() => Promise<void>) | null) => void }) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const pnl = useProfitLoss(range);
  return (
    <QueryState query={pnl}>
      {(data) => {
        const rows = buildProfitLossRows(
          data,
          {
            revenue: t('report.pnl.revenue'),
            expenses: t('report.pnl.expenses'),
            totalRevenue: t('report.pnl.totalRevenue'),
            totalExpenses: t('report.pnl.totalExpenses'),
            profit: t('report.pnl.profit'),
          },
          (key, fallback) => t(`report.pnl.rev.${key}`, { defaultValue: fallback }),
        );
        const sheet: XlsxSheet<never> = {
          name: t('report.tabs.pnl'),
          title: [t('report.tabs.pnl'), `${formatDate(data.from, locale)} – ${formatDate(data.to, locale)}`],
          columns: seriesColumns(data.periods, t('report.item'), t('report.total'), locale) as never,
          rows: rows as never,
        };
        return (
          <>
            <ExportRegistrar sheet={sheet} filename={t('report.tabs.pnl')} onExport={onExport} />
            <SeriesTable periods={data.periods} rows={rows} firstHeader={t('report.item')} />
          </>
        );
      }}
    </QueryState>
  );
}

/** Hands the parent an export callback for the tab that is currently rendered. */
function ExportRegistrar({
  sheet,
  filename,
  onExport,
}: {
  sheet: XlsxSheet<never> | XlsxSheet<never>[];
  filename: string;
  onExport: (fn: (() => Promise<void>) | null) => void;
}) {
  const sheets = Array.isArray(sheet) ? sheet : [sheet];
  // re-register whenever the sheet changes (it closes over the latest data); unregister on unmount
  useEffect(() => {
    onExport(() => downloadXlsx(filename, sheets));
    return () => onExport(null);
  }, [filename, sheets, onExport]);
  return null;
}

/* ------------------------------------------------------- receivables */
function ReceivablesTab({
  range,
  onExport,
}: {
  range: Range;
  onExport: (fn: (() => Promise<void>) | null) => void;
}) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const report = useReceivables(range.to);
  return (
    <QueryState
      query={report}
      isEmpty={(d) => d.count === 0}
      empty={
        <EmptyState title={t('report.receivables.empty')} description={t('report.receivables.emptyHint')} />
      }
    >
      {(d) => {
        const byContactSheet: XlsxSheet<never> = {
          name: t('report.receivables.byContact'),
          title: [t('report.tabs.receivables'), `${t('report.asOf')} ${formatDate(d.asOf, locale)}`],
          totalsLabel: t('report.total'),
          columns: [
            {
              header: t('col.customer'),
              width: 34,
              value: (r: (typeof d.byContact)[number]) => r.contactName,
            },
            {
              header: t('report.receivables.count'),
              kind: 'int' as const,
              total: true,
              value: (r: (typeof d.byContact)[number]) => r.count,
            },
            {
              header: t('report.receivables.b0_30'),
              kind: 'money' as const,
              total: true,
              value: (r: (typeof d.byContact)[number]) => r.b0_30,
            },
            {
              header: t('report.receivables.b31_60'),
              kind: 'money' as const,
              total: true,
              value: (r: (typeof d.byContact)[number]) => r.b31_60,
            },
            {
              header: t('report.receivables.b61_90'),
              kind: 'money' as const,
              total: true,
              value: (r: (typeof d.byContact)[number]) => r.b61_90,
            },
            {
              header: t('report.receivables.b90p'),
              kind: 'money' as const,
              total: true,
              value: (r: (typeof d.byContact)[number]) => r.b90p,
            },
            {
              header: t('report.total'),
              kind: 'money' as const,
              total: true,
              value: (r: (typeof d.byContact)[number]) => r.balanceMinor,
            },
          ] as never,
          rows: d.byContact as never,
        };
        const detailSheet: XlsxSheet<never> = {
          name: t('report.receivables.detail'),
          totalsLabel: t('report.total'),
          columns: [
            { header: t('col.number'), value: (r: (typeof d.rows)[number]) => r.number ?? '' },
            { header: t('col.customer'), width: 34, value: (r: (typeof d.rows)[number]) => r.contactName },
            {
              header: t('col.date'),
              kind: 'date' as const,
              value: (r: (typeof d.rows)[number]) => r.docDate,
            },
            { header: t('col.due'), kind: 'date' as const, value: (r: (typeof d.rows)[number]) => r.dueDate },
            {
              header: t('report.receivables.daysPastDue'),
              kind: 'int' as const,
              value: (r: (typeof d.rows)[number]) => r.daysPastDue,
            },
            {
              header: t('col.total'),
              kind: 'money' as const,
              total: true,
              value: (r: (typeof d.rows)[number]) => r.totalMinor,
            },
            {
              header: t('col.balance'),
              kind: 'money' as const,
              total: true,
              value: (r: (typeof d.rows)[number]) => r.balanceMinor,
            },
            {
              header: t('report.receivables.bucket'),
              value: (r: (typeof d.rows)[number]) => t(`report.receivables.${r.bucket}`),
            },
          ] as never,
          rows: d.rows as never,
        };
        const sum = (pick: (r: (typeof d.byContact)[number]) => number) =>
          d.byContact.reduce((a, r) => a + pick(r), 0);
        return (
          <div className="grid gap-5">
            <ExportRegistrar
              sheet={[byContactSheet, detailSheet]}
              filename={t('report.tabs.receivables')}
              onExport={onExport}
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat
                label={t('report.receivables.total')}
                value={formatAmount(d.totalMinor, locale)}
                hint={t('report.receivables.invoiceCount', { count: d.count })}
              />
              {d.buckets.map((b) => (
                <Stat
                  key={b.key}
                  label={t(`report.receivables.${b.key}`)}
                  value={formatAmount(b.balanceMinor, locale)}
                  hint={t('report.receivables.invoiceCount', { count: b.count })}
                  tone={
                    b.key === 'b61_90' || b.key === 'b90p'
                      ? b.balanceMinor > 0
                        ? 'destructive'
                        : 'default'
                      : 'default'
                  }
                />
              ))}
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('report.receivables.byContact')}</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <DataTable maxHeight="max-h-96">
                  <DtHead>
                    <DtTh>{t('col.customer')}</DtTh>
                    <DtTh num>{t('report.receivables.count')}</DtTh>
                    <DtTh num>{t('report.receivables.b0_30')}</DtTh>
                    <DtTh num>{t('report.receivables.b31_60')}</DtTh>
                    <DtTh num>{t('report.receivables.b61_90')}</DtTh>
                    <DtTh num>{t('report.receivables.b90p')}</DtTh>
                    <DtTh num>{t('report.total')}</DtTh>
                  </DtHead>
                  <tbody>
                    {d.byContact.map((r) => (
                      <DtRow key={r.contactId ?? r.contactName}>
                        <DtCell className="max-w-64 truncate font-medium">{r.contactName}</DtCell>
                        <DtCell num>{formatInt(r.count, locale)}</DtCell>
                        <DtCell num>{formatAmountOrDash(r.b0_30, locale)}</DtCell>
                        <DtCell num>{formatAmountOrDash(r.b31_60, locale)}</DtCell>
                        <DtCell num>{formatAmountOrDash(r.b61_90, locale)}</DtCell>
                        <DtCell num className={r.b90p > 0 ? 'text-destructive' : undefined}>
                          {formatAmountOrDash(r.b90p, locale)}
                        </DtCell>
                        <DtCell num className="font-medium">
                          {formatAmount(r.balanceMinor, locale)}
                        </DtCell>
                      </DtRow>
                    ))}
                  </tbody>
                  <DtTotals label={t('report.total')} span={1}>
                    <DtTotalCell>
                      {formatInt(
                        sum((r) => r.count),
                        locale,
                      )}
                    </DtTotalCell>
                    <DtTotalCell>
                      {formatAmount(
                        sum((r) => r.b0_30),
                        locale,
                      )}
                    </DtTotalCell>
                    <DtTotalCell>
                      {formatAmount(
                        sum((r) => r.b31_60),
                        locale,
                      )}
                    </DtTotalCell>
                    <DtTotalCell>
                      {formatAmount(
                        sum((r) => r.b61_90),
                        locale,
                      )}
                    </DtTotalCell>
                    <DtTotalCell>
                      {formatAmount(
                        sum((r) => r.b90p),
                        locale,
                      )}
                    </DtTotalCell>
                    <DtTotalCell>{formatAmount(d.totalMinor, locale)}</DtTotalCell>
                  </DtTotals>
                </DataTable>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('report.receivables.detail')}</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <DataTable maxHeight="max-h-96">
                  <DtHead>
                    <DtTh>{t('col.number')}</DtTh>
                    <DtTh>{t('col.customer')}</DtTh>
                    <DtTh>{t('col.due')}</DtTh>
                    <DtTh num>{t('report.receivables.daysPastDue')}</DtTh>
                    <DtTh num>{t('col.total')}</DtTh>
                    <DtTh num>{t('col.balance')}</DtTh>
                  </DtHead>
                  <tbody>
                    {d.rows.map((r) => (
                      <DtRow key={`${r.source}:${r.id}`}>
                        <DtCell className="font-mono text-xs whitespace-nowrap">{r.number ?? '–'}</DtCell>
                        <DtCell className="max-w-64 truncate">{r.contactName}</DtCell>
                        <DtCell className="whitespace-nowrap">{formatDate(r.dueDate, locale)}</DtCell>
                        <DtCell num className={r.daysPastDue > 30 ? 'text-destructive' : undefined}>
                          {r.daysPastDue > 0 ? r.daysPastDue : t('report.receivables.notDue')}
                        </DtCell>
                        <DtCell num>{formatAmount(r.totalMinor, locale)}</DtCell>
                        <DtCell num className="font-medium">
                          {formatAmount(r.balanceMinor, locale)}
                        </DtCell>
                      </DtRow>
                    ))}
                  </tbody>
                </DataTable>
              </CardContent>
            </Card>
          </div>
        );
      }}
    </QueryState>
  );
}

/* ----------------------------------------------------------- VAT tab */
type TaxRow = {
  key: string;
  date: string;
  number: string | null;
  name: string;
  taxId: string | null;
  branchCode: string | null;
  baseMinor: number;
  vatMinor: number;
  totalMinor: number;
};

function TaxTable({
  rows,
  totals,
  locale,
}: {
  rows: TaxRow[];
  totals: { count: number; baseMinor: number; vatMinor: number; totalMinor: number };
  locale: string;
}) {
  const { t } = useTranslation('accounting');
  return (
    <DataTable>
      <DtHead>
        <DtTh>{t('col.date')}</DtTh>
        <DtTh>{t('col.number')}</DtTh>
        <DtTh>{t('report.vat.party')}</DtTh>
        <DtTh>{t('contacts.taxId')}</DtTh>
        <DtTh>{t('contacts.branchShort')}</DtTh>
        <DtTh num>{t('col.base')}</DtTh>
        <DtTh num>{t('col.vat')}</DtTh>
        <DtTh num>{t('col.total')}</DtTh>
      </DtHead>
      <tbody>
        {rows.map((r) => (
          <DtRow key={r.key}>
            <DtCell className="whitespace-nowrap">{formatDate(r.date, locale)}</DtCell>
            <DtCell className="font-mono text-xs whitespace-nowrap">{r.number ?? '–'}</DtCell>
            <DtCell className="max-w-64 truncate">{r.name}</DtCell>
            <DtCell className="font-mono text-xs">{r.taxId ?? '–'}</DtCell>
            <DtCell className="font-mono text-xs">{r.branchCode ?? '–'}</DtCell>
            <DtCell num className={r.baseMinor < 0 ? 'text-destructive' : undefined}>
              {formatAmount(r.baseMinor, locale)}
            </DtCell>
            <DtCell num className={r.vatMinor < 0 ? 'text-destructive' : undefined}>
              {formatAmount(r.vatMinor, locale)}
            </DtCell>
            <DtCell num className="font-medium">
              {formatAmount(r.totalMinor, locale)}
            </DtCell>
          </DtRow>
        ))}
      </tbody>
      <DtTotals label={`${t('report.total')} (${totals.count})`} span={5}>
        <DtTotalCell>{formatAmount(totals.baseMinor, locale)}</DtTotalCell>
        <DtTotalCell>{formatAmount(totals.vatMinor, locale)}</DtTotalCell>
        <DtTotalCell>{formatAmount(totals.totalMinor, locale)}</DtTotalCell>
      </DtTotals>
    </DataTable>
  );
}

function MonthSummary({
  rows,
  locale,
}: {
  rows: { month: string; count: number; baseMinor: number; vatMinor: number; totalMinor: number }[];
  locale: string;
}) {
  const { t } = useTranslation('accounting');
  if (rows.length === 0) return null;
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((m) => (
        <div key={m.month} className="rounded-xl border bg-white p-3 shadow-xs">
          <div className="text-xs font-medium text-navy-700">{formatPeriod(m.month, locale)}</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{formatAmount(m.vatMinor, locale)}</div>
          <div className="text-xs text-muted-foreground">
            {t('col.base')} {formatAmount(m.baseMinor, locale)} · {t('report.vat.docs', { count: m.count })}
          </div>
        </div>
      ))}
    </div>
  );
}

type MonthRow = { month: string; count: number; baseMinor: number; vatMinor: number; totalMinor: number };
type TaxData = {
  from: string;
  to: string;
  vatRegistered: boolean;
  rows: TaxRow[];
  byMonth: MonthRow[];
  totals: { count: number; baseMinor: number; vatMinor: number; totalMinor: number };
};

function VatTab({
  range,
  view,
  onView,
  onExport,
}: {
  range: Range;
  view: 'sales' | 'purchase';
  onView: (v: 'sales' | 'purchase') => void;
  onExport: (fn: (() => Promise<void>) | null) => void;
}) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const sales = useSalesTax(range, view === 'sales');
  const purchase = usePurchaseTax(range, view === 'purchase');
  const active = view === 'sales' ? sales : purchase;

  const data = useMemo<TaxData | null>(() => {
    if (view === 'sales' && sales.data) {
      const d = sales.data;
      return {
        from: d.from,
        to: d.to,
        vatRegistered: d.vatRegistered,
        byMonth: d.byMonth,
        totals: d.totals,
        rows: d.rows.map((r) => ({
          key: `${r.source}:${r.id}`,
          date: r.docDate,
          number: r.number,
          name: r.contactName,
          taxId: r.taxId,
          branchCode: r.branchCode,
          baseMinor: r.baseMinor,
          vatMinor: r.vatMinor,
          totalMinor: r.totalMinor,
        })),
      };
    }
    if (view === 'purchase' && purchase.data) {
      const d = purchase.data;
      return {
        from: d.from,
        to: d.to,
        vatRegistered: true,
        byMonth: d.byMonth,
        totals: d.totals,
        rows: d.rows.map((r) => ({
          key: r.id,
          date: r.expenseDate,
          number: r.reference,
          name: r.vendorName,
          taxId: r.taxId,
          branchCode: r.branchCode,
          baseMinor: r.baseMinor,
          vatMinor: r.vatMinor,
          totalMinor: r.totalMinor,
        })),
      };
    }
    return null;
  }, [view, sales.data, purchase.data]);

  const name = view === 'sales' ? t('report.vat.sales') : t('report.vat.purchase');

  let body: ReactNode;
  if (active.isPending) body = <ListSkeleton />;
  else if (active.isError) body = <ErrorState error={active.error} onRetry={() => void active.refetch()} />;
  else if (!data || data.rows.length === 0) {
    body = <EmptyState title={t('report.vat.empty')} description={t('report.vat.emptyHint')} />;
  } else {
    const sheets: XlsxSheet<never>[] = [
      {
        name,
        title: [name, `${formatDate(data.from, locale)} – ${formatDate(data.to, locale)}`],
        totalsLabel: t('report.total'),
        columns: [
          { header: t('col.date'), kind: 'date' as const, value: (r: TaxRow) => r.date },
          { header: t('col.number'), value: (r: TaxRow) => r.number ?? '' },
          { header: t('report.vat.party'), width: 34, value: (r: TaxRow) => r.name },
          { header: t('contacts.taxId'), value: (r: TaxRow) => r.taxId ?? '' },
          { header: t('contacts.branchShort'), value: (r: TaxRow) => r.branchCode ?? '' },
          { header: t('col.base'), kind: 'money' as const, total: true, value: (r: TaxRow) => r.baseMinor },
          { header: t('col.vat'), kind: 'money' as const, total: true, value: (r: TaxRow) => r.vatMinor },
          { header: t('col.total'), kind: 'money' as const, total: true, value: (r: TaxRow) => r.totalMinor },
        ] as never,
        rows: data.rows as never,
      },
      {
        name: t('report.vat.byMonth'),
        totalsLabel: t('report.total'),
        columns: [
          { header: t('report.month'), value: (r: MonthRow) => formatPeriod(r.month, locale) },
          {
            header: t('report.vat.docsHeader'),
            kind: 'int' as const,
            total: true,
            value: (r: MonthRow) => r.count,
          },
          { header: t('col.base'), kind: 'money' as const, total: true, value: (r: MonthRow) => r.baseMinor },
          { header: t('col.vat'), kind: 'money' as const, total: true, value: (r: MonthRow) => r.vatMinor },
          {
            header: t('col.total'),
            kind: 'money' as const,
            total: true,
            value: (r: MonthRow) => r.totalMinor,
          },
        ] as never,
        rows: data.byMonth as never,
      },
    ];
    body = (
      <>
        <ExportRegistrar sheet={sheets} filename={name} onExport={onExport} />
        {view === 'sales' && !data.vatRegistered ? (
          <p
            className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning"
            role="status"
          >
            {t('report.vat.notRegistered')}
          </p>
        ) : null}
        <MonthSummary rows={data.byMonth} locale={locale} />
        <TaxTable rows={data.rows} totals={data.totals} locale={locale} />
      </>
    );
  }

  return (
    <div className="grid gap-4">
      <Tabs value={view} onValueChange={(v) => onView(v as 'sales' | 'purchase')}>
        <TabsList className="h-10 w-fit">
          <TabsTrigger value="sales">{t('report.vat.sales')}</TabsTrigger>
          <TabsTrigger value="purchase">{t('report.vat.purchase')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {body}
    </div>
  );
}

/* ----------------------------------------------------------- WHT tab */
function WhtTab({ range, onExport }: { range: Range; onExport: (fn: (() => Promise<void>) | null) => void }) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const report = useWithholding(range);
  return (
    <QueryState query={report}>
      {(d) => {
        const empty = d.withheldFromUs.rows.length === 0 && d.withheldByUs.rows.length === 0;
        type From = (typeof d.withheldFromUs.rows)[number];
        type By = (typeof d.withheldByUs.rows)[number];
        const sheets: XlsxSheet<never>[] = [
          {
            name: t('report.wht.fromUs'),
            title: [t('report.wht.fromUs'), `${formatDate(d.from, locale)} – ${formatDate(d.to, locale)}`],
            totalsLabel: t('report.total'),
            columns: [
              { header: t('payment.paidOn'), kind: 'date' as const, value: (r: From) => r.paidOn },
              { header: t('col.number'), value: (r: From) => r.documentNumber ?? '' },
              { header: t('col.customer'), width: 34, value: (r: From) => r.contactName },
              { header: t('contacts.taxId'), value: (r: From) => r.taxId ?? '' },
              {
                header: t('report.wht.paid'),
                kind: 'money' as const,
                total: true,
                value: (r: From) => r.paidMinor,
              },
              {
                header: t('report.wht.withheld'),
                kind: 'money' as const,
                total: true,
                value: (r: From) => r.whtMinor,
              },
              {
                header: t('report.wht.certificate'),
                value: (r: From) => (r.certificateFileId ? t('report.wht.hasCertificate') : ''),
              },
            ] as never,
            rows: d.withheldFromUs.rows as never,
          },
          {
            name: t('report.wht.byUs'),
            title: [t('report.wht.byUs'), `${formatDate(d.from, locale)} – ${formatDate(d.to, locale)}`],
            totalsLabel: t('report.total'),
            columns: [
              { header: t('expense.date'), kind: 'date' as const, value: (r: By) => r.expenseDate },
              { header: t('expense.reference'), value: (r: By) => r.reference ?? '' },
              { header: t('expense.vendor'), width: 34, value: (r: By) => r.vendorName },
              { header: t('contacts.taxId'), value: (r: By) => r.taxId ?? '' },
              { header: t('report.wht.rate'), kind: 'percent' as const, value: (r: By) => r.whtBp },
              { header: t('col.base'), kind: 'money' as const, total: true, value: (r: By) => r.baseMinor },
              {
                header: t('report.wht.withheld'),
                kind: 'money' as const,
                total: true,
                value: (r: By) => r.whtMinor,
              },
            ] as never,
            rows: d.withheldByUs.rows as never,
          },
        ];
        return (
          <div className="grid gap-5">
            <ExportRegistrar sheet={sheets} filename={t('report.tabs.wht')} onExport={onExport} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat
                label={t('report.wht.fromUs')}
                value={formatAmount(d.withheldFromUs.totalMinor, locale)}
                hint={t('report.wht.fromUsHint')}
              />
              <Stat
                label={t('report.wht.byUs')}
                value={formatAmount(d.withheldByUs.totalMinor, locale)}
                hint={t('report.wht.byUsHint')}
              />
            </div>
            {empty ? (
              <EmptyState title={t('report.wht.empty')} description={t('report.wht.emptyHint')} />
            ) : null}
            {d.withheldFromUs.rows.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('report.wht.fromUs')}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  <DataTable maxHeight="max-h-96">
                    <DtHead>
                      <DtTh>{t('payment.paidOn')}</DtTh>
                      <DtTh>{t('col.number')}</DtTh>
                      <DtTh>{t('col.customer')}</DtTh>
                      <DtTh>{t('contacts.taxId')}</DtTh>
                      <DtTh num>{t('report.wht.paid')}</DtTh>
                      <DtTh num>{t('report.wht.withheld')}</DtTh>
                    </DtHead>
                    <tbody>
                      {d.withheldFromUs.rows.map((r) => (
                        <DtRow key={r.paymentId}>
                          <DtCell className="whitespace-nowrap">{formatDate(r.paidOn, locale)}</DtCell>
                          <DtCell className="font-mono text-xs">{r.documentNumber ?? '–'}</DtCell>
                          <DtCell className="max-w-64 truncate">{r.contactName}</DtCell>
                          <DtCell className="font-mono text-xs">{r.taxId ?? '–'}</DtCell>
                          <DtCell num>{formatAmount(r.paidMinor, locale)}</DtCell>
                          <DtCell num className="font-medium">
                            {formatAmount(r.whtMinor, locale)}
                          </DtCell>
                        </DtRow>
                      ))}
                    </tbody>
                    <DtTotals label={t('report.total')} span={5}>
                      <DtTotalCell>{formatAmount(d.withheldFromUs.totalMinor, locale)}</DtTotalCell>
                    </DtTotals>
                  </DataTable>
                </CardContent>
              </Card>
            ) : null}
            {d.withheldByUs.rows.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('report.wht.byUs')}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  <DataTable maxHeight="max-h-96">
                    <DtHead>
                      <DtTh>{t('expense.date')}</DtTh>
                      <DtTh>{t('expense.reference')}</DtTh>
                      <DtTh>{t('expense.vendor')}</DtTh>
                      <DtTh>{t('contacts.taxId')}</DtTh>
                      <DtTh num>{t('report.wht.rate')}</DtTh>
                      <DtTh num>{t('col.base')}</DtTh>
                      <DtTh num>{t('report.wht.withheld')}</DtTh>
                    </DtHead>
                    <tbody>
                      {d.withheldByUs.rows.map((r) => (
                        <DtRow key={r.expenseId}>
                          <DtCell className="whitespace-nowrap">{formatDate(r.expenseDate, locale)}</DtCell>
                          <DtCell className="font-mono text-xs">{r.reference ?? '–'}</DtCell>
                          <DtCell className="max-w-64 truncate">{r.vendorName}</DtCell>
                          <DtCell className="font-mono text-xs">{r.taxId ?? '–'}</DtCell>
                          <DtCell num>{formatBp(r.whtBp)}</DtCell>
                          <DtCell num>{formatAmount(r.baseMinor, locale)}</DtCell>
                          <DtCell num className="font-medium">
                            {formatAmount(r.whtMinor, locale)}
                          </DtCell>
                        </DtRow>
                      ))}
                    </tbody>
                    <DtTotals label={t('report.total')} span={5}>
                      <DtTotalCell>
                        {formatAmount(
                          d.withheldByUs.rows.reduce((a, r) => a + r.baseMinor, 0),
                          locale,
                        )}
                      </DtTotalCell>
                      <DtTotalCell>{formatAmount(d.withheldByUs.totalMinor, locale)}</DtTotalCell>
                    </DtTotals>
                  </DataTable>
                </CardContent>
              </Card>
            ) : null}
          </div>
        );
      }}
    </QueryState>
  );
}

/* ------------------------------------------------- expenses by category */
function ExpensesTab({
  range,
  onExport,
}: {
  range: Range;
  onExport: (fn: (() => Promise<void>) | null) => void;
}) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const report = useExpensesByCategory(range);
  return (
    <QueryState
      query={report}
      isEmpty={(d) => d.expenses.rows.length === 0 || d.expenses.totalMinor === 0}
      empty={<EmptyState title={t('report.expenses.empty')} description={t('report.expenses.emptyHint')} />}
    >
      {(d) => {
        const rows = buildCategoryRows(d, t('report.total'));
        const chart = d.expenses.rows
          .filter((r) => r.totalMinor > 0)
          .sort((a, b) => b.totalMinor - a.totalMinor)
          .map((r) => ({ name: r.label, baht: r.totalMinor / 100 }));
        const sheet: XlsxSheet<never> = {
          name: t('report.tabs.expenses'),
          title: [t('report.tabs.expenses'), `${formatDate(d.from, locale)} – ${formatDate(d.to, locale)}`],
          columns: seriesColumns(d.periods, t('expense.category'), t('report.total'), locale) as never,
          rows: rows as never,
        };
        return (
          <div className="grid gap-5">
            <ExportRegistrar sheet={sheet} filename={t('report.tabs.expenses')} onExport={onExport} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('report.expenses.chartTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full" role="img" aria-label={t('report.expenses.chartTitle')}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} layout="vertical" margin={{ left: 8, right: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={(v: number) => formatInt(v, locale)}
                        fontSize={12}
                      />
                      <YAxis type="category" dataKey="name" width={170} fontSize={12} />
                      <Tooltip formatter={(v) => formatAmount(Math.round(Number(v) * 100), locale)} />
                      <Bar dataKey="baht" radius={[0, 6, 6, 0]} maxBarSize={36}>
                        {chart.map((c, i) => (
                          <Cell key={c.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <SeriesTable periods={d.periods} rows={rows} firstHeader={t('expense.category')} />
          </div>
        );
      }}
    </QueryState>
  );
}

/* ------------------------------------------------------------- page */
export function ReportsPage() {
  const { t } = useTranslation('accounting');
  const [search, patch] = useUrlFilters<ReportSearch>();
  const range = useRange(search);
  const tab: TabKey = search.tab ?? 'pnl';
  const view = search.view ?? 'sales';

  // The active tab hands us its export callback (see ExportRegistrar).
  const exporter = useRef<(() => Promise<void>) | null>(null);
  const register = useCallback((fn: (() => Promise<void>) | null) => {
    exporter.current = fn;
  }, []);
  const runExport = () => {
    const run = exporter.current;
    // no registered export = the active tab has no data to export (still loading, empty, or failed)
    if (!run) return void toast.warning(t('report.nothingToExport'));
    void run().then(
      () => toast.success(t('fileSaved')),
      () => toast.error(t('exportFailed')),
    );
  };

  const showGroup = tab === 'pnl' || tab === 'expenses';
  const presets = ['thisMonth', 'lastMonth', 'thisYear', 'last12'] as const;

  return (
    <>
      <PageHeader
        title={t('report.title')}
        description={t('report.description')}
        actions={<ExportButton onClick={runExport} />}
      />
      <Tabs value={tab} onValueChange={(v) => patch({ tab: v as TabKey })} className="mb-4">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-11">
            {TABS.map((k) => (
              <TabsTrigger key={k} value={k}>
                {t(`report.tabs.${k}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <DateRangeFilter
          from={range.from}
          to={range.to}
          presets={presets}
          onChange={(r) => patch({ from: r.from, to: r.to })}
        />
        {showGroup ? <GroupToggle value={range.granularity} onChange={(v) => patch({ group: v })} /> : null}
      </div>
      {tab === 'pnl' ? <PnlTab range={range} onExport={register} /> : null}
      {tab === 'receivables' ? <ReceivablesTab range={range} onExport={register} /> : null}
      {tab === 'vat' ? (
        <VatTab range={range} view={view} onView={(v) => patch({ view: v })} onExport={register} />
      ) : null}
      {tab === 'wht' ? <WhtTab range={range} onExport={register} /> : null}
      {tab === 'expenses' ? <ExpensesTab range={range} onExport={register} /> : null}
    </>
  );
}
