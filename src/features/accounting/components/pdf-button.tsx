import { ChevronDown, FileDown, Loader2 } from 'lucide-react';
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
import { type PdfMode, renderDocumentPdf } from '../api';

/**
 * "PDF" with the original / copy / both choice. A blank tab is opened synchronously inside the click (so popup
 * blockers allow it) and pointed at the file once the worker has rendered it.
 */
export function PdfButton({ documentId }: { documentId: string }) {
  const { t } = useTranslation('accounting');
  const [busy, setBusy] = useState(false);

  const run = async (mode: PdfMode) => {
    const tab = window.open('', '_blank');
    setBusy(true);
    try {
      const { url } = await renderDocumentPdf(documentId, mode);
      if (tab) tab.location.href = url;
      else
        toast.success(t('pdf.ready'), {
          action: { label: t('pdf.open'), onClick: () => window.open(url, '_blank') },
        });
    } catch (e) {
      tab?.close();
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
          {busy ? t('pdf.rendering') : t('pdf.button')}
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(['both', 'original', 'copy'] as const).map((m) => (
          <DropdownMenuItem key={m} className="min-h-10" onSelect={() => void run(m)}>
            {t(`pdf.mode.${m}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
