import { ImagePlus, Loader2, Send, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { type PageDetail, type PreparedImage, refusal, uploadLineImage, useSendLine } from '../api';
import { useNow } from '../lib/time';

const IMAGES_MAX = 4;
const nf = new Intl.NumberFormat('en-US');

type Attached = { key: string; preview: string; image: PreparedImage | null; failed: boolean };

/**
 * The reply box of a LINE chat: text + up to 4 pictures. A reply goes out free while the customer's newest message is under a minute
 * old (LINE's reply token), else as a push that spends the OA's monthly quota: the box says which one it will be, warns when less
 * than 10 % of the quota is left (and asks before sending), and refuses nothing the server would not.
 */
export function LineComposer({ detail }: { detail: PageDetail }) {
  const { t } = useTranslation('pageInbox');
  const c = detail.conversation;
  const line = detail.line;
  const now = useNow(5_000);
  const send = useSendLine();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attached[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // one id per draft: a double click or a retry of the same send is the same message (LINE's retry key too)
  const clientId = useRef(crypto.randomUUID());

  // the draft is not carried to another chat
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the chat changes
  useEffect(() => {
    setText('');
    setFiles([]);
    setProblem(null);
    setConfirm(false);
    clientId.current = crypto.randomUUID();
  }, [c.id]);

  const quota = line?.quota ?? null;
  const free = line?.freeReplyUntil ? Date.parse(line.freeReplyUntil) > now.getTime() : false;
  const ready = files.filter((f) => f.image !== null);
  const uploading = files.some((f) => f.image === null && !f.failed);
  const objects = (text.trim() ? 1 : 0) + ready.length;
  const exhausted = !free && quota?.exhausted === true;
  const blocked = !line?.canReply || exhausted;

  const attach = async (list: FileList | null) => {
    setProblem(null);
    for (const file of Array.from(list ?? []).slice(0, IMAGES_MAX - files.length)) {
      const key = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      setFiles((fs) => [...fs, { key, preview, image: null, failed: false }]);
      try {
        const image = await uploadLineImage(file);
        setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, image } : f)));
      } catch {
        setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, failed: true } : f)));
        setProblem(t('lineErrors.upload'));
      }
    }
    if (input.current) input.current.value = '';
  };
  const drop = (key: string) =>
    setFiles((fs) => {
      for (const f of fs) if (f.key === key) URL.revokeObjectURL(f.preview);
      return fs.filter((f) => f.key !== key);
    });

  const run = () => {
    setProblem(null);
    setConfirm(false);
    send.mutate(
      {
        id: c.id,
        text: text.trim(),
        images: ready.flatMap((f) => (f.image ? [f.image] : [])),
        clientId: clientId.current,
      },
      {
        onSuccess: () => {
          setText('');
          for (const f of files) URL.revokeObjectURL(f.preview);
          setFiles([]);
          clientId.current = crypto.randomUUID();
        },
        onError: (e) => {
          const r = refusal(e).reason;
          setProblem(t(`lineErrors.${r ?? 'generic'}`, { defaultValue: t('lineErrors.generic') }));
        },
      },
    );
  };
  // a push with little quota left asks first; a free reply never does
  const submit = () => (!free && quota?.low ? setConfirm(true) : run());

  const hint = !line?.canReply
    ? t(`lineBlock.${line?.replyBlock ?? 'no_account'}`)
    : exhausted
      ? t('composer.quotaExhausted')
      : free
        ? t('composer.freeHint')
        : t('composer.pushHint', { n: Math.max(objects, 1) });
  return (
    <div className="grid gap-2 border-t bg-[var(--card)] p-3" data-testid="line-composer">
      {c.blocked ? (
        <p
          className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
          data-testid="blocked-note"
        >
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden /> {t('composer.blockedNote')}
        </p>
      ) : null}
      {!free && quota?.low && !exhausted ? (
        <p
          className="flex items-center gap-1.5 rounded-lg border border-warning/50 bg-warning/10 p-2 text-xs text-warning"
          role="status"
          data-testid="quota-low-note"
        >
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
          {t('composer.quotaLow', {
            left: nf.format(Math.max(0, (quota.limit ?? 0) - quota.used)),
            limit: nf.format(quota.limit ?? 0),
          })}
        </p>
      ) : null}
      {problem ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
          data-testid="send-error"
        >
          {problem}
        </p>
      ) : null}
      <p
        className={cn('text-xs', free ? 'text-success' : 'text-muted-foreground')}
        data-testid={free ? 'line-free' : 'line-push'}
      >
        {hint}
      </p>
      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-2" data-testid="attached">
          {files.map((f) => (
            <li key={f.key} className="relative">
              <img
                src={f.preview}
                alt=""
                className={cn('size-16 rounded-md border object-cover', f.failed && 'opacity-40')}
              />
              {f.image === null && !f.failed ? (
                <Loader2
                  className="absolute inset-0 m-auto size-5 animate-spin text-foreground"
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                aria-label={t('composer.removePicture')}
                onClick={() => drop(f.key)}
                className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-foreground text-background"
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-end gap-2">
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          data-testid="line-file"
          onChange={(e) => void attach(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 shrink-0"
          aria-label={t('composer.attach')}
          disabled={blocked || files.length >= IMAGES_MAX}
          onClick={() => input.current?.click()}
        >
          <ImagePlus aria-hidden />
        </Button>
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // a send that failed may have reached the server after all: an edited message needs its own id, or the
            // server answers with the message that was stored (the shop reply box does the same)
            if (problem !== null) {
              setProblem(null);
              clientId.current = crypto.randomUUID();
            }
          }}
          placeholder={t('composer.placeholder')}
          aria-label={t('composer.placeholder')}
          disabled={blocked}
          rows={3}
          className="min-h-16 flex-1 resize-y"
          data-testid="composer-text"
        />
        <Button
          className="h-11 shrink-0"
          disabled={blocked || send.isPending || uploading || objects === 0}
          onClick={submit}
          data-testid="send-button"
        >
          <Send aria-hidden /> {send.isPending ? t('composer.sending') : t('composer.send')}
        </Button>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('composer.quotaConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('composer.quotaConfirmBody', {
                n: Math.max(objects, 1),
                left: nf.format(Math.max(0, (quota?.limit ?? 0) - (quota?.used ?? 0))),
                limit: nf.format(quota?.limit ?? 0),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              {t('composer.edit')}
            </Button>
            <Button onClick={run} disabled={send.isPending} data-testid="confirm-push">
              {t('composer.quotaConfirmSend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
