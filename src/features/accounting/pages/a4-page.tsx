import { Link } from '@tanstack/react-router';
import { Printer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type A4Source, type PdfMode, useA4Preview, useDocument } from '../api';
import { ExcelButton, PdfDownloadButton } from '../components/a4-actions';
import { detailPath, listPath } from '../lib/doc-meta';

/** 210 mm at 96 dpi. */
const A4_PX = 794;

/**
 * The document as white A4 sheets: the exact HTML the PDF is made from, in a script-less sandboxed iframe (so its
 * print CSS applies and "Print" prints only the sheets, one A4 per page). Narrow screens scale the sheets down.
 */
function Sheets({ html, frame }: { html: string; frame: React.RefObject<HTMLIFrameElement | null> }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(1123);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const resize = () => setScale(Math.min(1, el.clientWidth / A4_PX));
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const measure = () => {
    const h = frame.current?.contentDocument?.documentElement.scrollHeight;
    if (h) setHeight(h);
  };

  return (
    <div ref={box} className="rounded-xl bg-[#d7dce3] p-0 sm:p-2">
      <div className="mx-auto" style={{ width: A4_PX * scale, height: height * scale }}>
        <iframe
          ref={frame}
          title="A4"
          srcDoc={html}
          sandbox="allow-same-origin allow-modals"
          onLoad={measure}
          className="block border-0 bg-transparent"
          style={{ width: A4_PX, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        />
      </div>
    </div>
  );
}

/** In-app A4 view of an accounting document or a shop invoice, with print / PDF / Excel. */
export function A4Page({ source }: { source: A4Source }) {
  const { t } = useTranslation('accounting');
  const [mode, setMode] = useState<PdfMode>('both');
  const frame = useRef<HTMLIFrameElement>(null);
  const preview = useA4Preview(source, mode);
  const doc = useDocument(source.kind === 'document' ? source.id : undefined);
  const backTo =
    source.kind === 'shop-platform'
      ? '/platform/invoices'
      : doc.data
        ? detailPath(doc.data.type, doc.data.id)
        : listPath('invoice');

  const print = () => {
    const win = frame.current?.contentWindow;
    if (!win) {
      toast.error(t('a4.printFailed'));
      return;
    }
    win.focus();
    win.print();
  };

  return (
    <>
      <PageHeader
        title={preview.data?.title ?? t('a4.title')}
        description={
          <Link to={backTo as never} className="hover:underline">
            ← {t('a4.back')}
          </Link>
        }
        actions={
          <>
            <Select value={mode} onValueChange={(v) => setMode(v as PdfMode)}>
              <SelectTrigger className="w-44" aria-label={t('a4.showing')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['both', 'original', 'copy'] as const).map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(`pdf.mode.${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={print}
              blockedReason={!preview.data && t('a4.previewNotReady')}
              title={t('a4.printHint')}
            >
              <Printer /> {t('a4.print')}
            </Button>
            <PdfDownloadButton source={source} />
            <ExcelButton source={source} />
          </>
        }
      />
      <QueryState query={preview}>{(p) => <Sheets html={p.html} frame={frame} />}</QueryState>
    </>
  );
}
