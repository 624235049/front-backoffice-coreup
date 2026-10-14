import { ExternalLink, Loader2, Paperclip, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { type AccountingFilePurpose, fileDownloadUrl, uploadAccountingFile } from '../api';

/** Open an uploaded file in a new tab through a short-lived presigned URL. */
export async function openFile(fileId: string): Promise<void> {
  const url = await fileDownloadUrl(fileId);
  window.open(url, '_blank', 'noopener');
}

/**
 * Attach one file (receipt, WHT certificate, logo): presign → PUT → keeps only the file id.
 * `accept` limits the picker; the API re-checks type and size per purpose.
 */
export function FileField({
  fileId,
  onChange,
  purpose,
  accept,
  label,
  disabled,
  maxMb = 10,
}: {
  fileId: string | null;
  onChange: (fileId: string | null) => void;
  purpose: AccountingFilePurpose;
  accept: string;
  label: string;
  disabled?: boolean;
  maxMb?: number;
}) {
  const { t } = useTranslation('accounting');
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(t('file.tooLarge', { mb: maxMb }));
      return;
    }
    setBusy(true);
    try {
      onChange(await uploadAccountingFile(file, purpose));
      setName(file.name);
    } catch {
      toast.error(t('file.uploadFailed'));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-label={label}
        data-testid={`file-${purpose}`}
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      {fileId ? (
        <>
          <span className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg bg-mint-50 px-3 text-sm text-navy-800">
            <Paperclip className="size-4 shrink-0 text-mint-700" aria-hidden />
            <span className="truncate">{name ?? t('file.attached')}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void openFile(fileId).catch(() => toast.error(t('file.openFailed')))}
          >
            <ExternalLink /> {t('file.open')}
          </Button>
          {!disabled ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(null);
                setName(null);
              }}
            >
              <X /> {t('file.remove')}
            </Button>
          ) : null}
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Paperclip />} {label}
        </Button>
      )}
    </div>
  );
}
