import { Link } from '@tanstack/react-router';
import { ChevronDown, FileDown, FileSearch, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { i18n } from '@/i18n';
import { type A4Source, fetchA4Document, type PdfMode, renderA4Pdf, useCompany } from '../api';
import { buildDocumentSheet, type DocSheetLabels, downloadDocumentXlsx } from '../lib/doc-xlsx';

/** Download a ready file without leaving the page (the presigned URL carries `Content-Disposition: attachment`). */
export function downloadUrl(url: string, filename: string | null): void {
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  toast.success(i18n.t('accounting:fileSaved'));
}

const MODES: readonly PdfMode[] = ['both', 'original', 'copy'];

/** "Download PDF" with the original / copy / both choice: the worker renders it, the file downloads when ready. */
export function PdfDownloadButton({ source }: { source: A4Source }) {
  const { t } = useTranslation('accounting');
  const [busy, setBusy] = useState(false);

  const run = async (mode: PdfMode) => {
    setBusy(true);
    try {
      const { url, filename } = await renderA4Pdf(source, mode);
      downloadUrl(url, filename);
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'PDF_TIMEOUT' ? t('pdf.timeout') : t('pdf.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <FileDown />}
          {busy ? t('pdf.rendering') : t('a4.download')}
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {MODES.map((m) => (
          <DropdownMenuItem key={m} className="min-h-10" onSelect={() => void run(m)}>
            {t(`pdf.mode.${m}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "Export Excel": the document as a sheet (company header, facts, lines, totals). */
export function ExcelButton({ source }: { source: A4Source }) {
  const { t } = useTranslation('accounting');
  const company = useCompany();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!company.data) return;
    setBusy(true);
    try {
      const doc = await fetchA4Document(source);
      const labels: DocSheetLabels = {
        title: t(`docType.${doc.type}`),
        status: t(`status.${doc.status}`),
        number: t('a4.xlsx.number'),
        date: t('a4.xlsx.date'),
        due: t(doc.type === 'quotation' ? 'a4.xlsx.validUntil' : 'a4.xlsx.due'),
        reference: t('a4.xlsx.reference'),
        customer: t('a4.xlsx.customer'),
        taxId: t('a4.xlsx.taxId'),
        branch: t('a4.xlsx.branch'),
        address: t('a4.xlsx.address'),
        phone: t('a4.xlsx.phone'),
        email: t('a4.xlsx.email'),
        draftNumber: t('a4.xlsx.draftNumber'),
        headOffice: t('a4.xlsx.headOffice'),
        col: {
          no: t('a4.xlsx.col.no'),
          description: t('a4.xlsx.col.description'),
          qty: t('a4.xlsx.col.qty'),
          unit: t('a4.xlsx.col.unit'),
          unitPrice: t('a4.xlsx.col.unitPrice'),
          discount: t('a4.xlsx.col.discount'),
          amount: t('a4.xlsx.col.amount'),
        },
        totals: {
          lines: t('a4.xlsx.totals.lines'),
          discount: t('a4.xlsx.totals.discount'),
          beforeVat: t('a4.xlsx.totals.beforeVat'),
          vat: t('a4.xlsx.totals.vat'),
          total: t('a4.xlsx.totals.total'),
          wht: t('a4.xlsx.totals.wht'),
          net: t('a4.xlsx.totals.net'),
        },
      };
      const sheet = buildDocumentSheet(doc, company.data, labels);
      await downloadDocumentXlsx(doc.number ?? `${doc.type}-${doc.id.slice(0, 8)}`, sheet);
      toast.success(t('fileSaved'));
    } catch {
      toast.error(t('a4.exportFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={() => void run()}
      disabled={busy}
      blockedReason={!company.data && t('a4.companyNotReady')}
    >
      {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
      {t('a4.excel')}
    </Button>
  );
}

const A4_PATH: Record<A4Source['kind'], string> = {
  document: '/accounting/a4',
  'shop-accounting': '/accounting/a4-shop',
  'shop-platform': '/platform/a4',
};

/** "View A4 document": opens the in-app A4 page (print / PDF / Excel live there). */
export function A4Link({ source, size }: { source: A4Source; size?: 'sm' }) {
  const { t } = useTranslation('accounting');
  return (
    <Button asChild variant="outline" size={size}>
      <Link to={`${A4_PATH[source.kind]}/${source.id}` as never}>
        <FileSearch /> {t('a4.view')}
      </Link>
    </Button>
  );
}
