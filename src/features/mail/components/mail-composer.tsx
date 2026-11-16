import { FlaskConical, Link2, Loader2, Paperclip, Send, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ErrorState } from '@/components/error-state';
import { ListSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useDebounced } from '@/features/accounting/lib/use-debounced';
import { IssuePinDialog } from '@/features/platform/components/issue-pin-dialog';
import { isApiError } from '@/lib/api';
import {
  type MailCompose,
  type MailContext,
  type MailKind,
  type MailPreview,
  uploadMailFile,
  useMailContext,
  useMailPdf,
  useMailPreview,
  useMakeQuoteLink,
  useSendMail,
} from '../api';
import { MAX_UPLOAD_BYTES, parseEmails } from '../lib';

type UploadedFile = { fileId: string; name: string; size: number };

/**
 * "ส่งอีเมลให้ลูกค้า" — one composer for a quotation, an invoice and a free-form email. The left side is the editable letter
 * (template filled with the document), the right side is the live preview the API renders: exactly what the customer
 * receives. A sample to oneself ("[ตัวอย่าง]", no record copy) goes any time; the real send unlocks once the preview of
 * the current text is on screen, and asks one confirm (an invoice: the team PIN).
 */
export function MailComposer({
  kind,
  documentId,
  onClose,
}: {
  kind: MailKind;
  documentId?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('mail');
  const ctx = useMailContext(kind, documentId);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        closeLabel={t('close')}
        className="max-h-[94dvh] max-w-[calc(100%-1rem)] p-4 sm:max-w-5xl sm:p-6"
        data-testid="mail-composer"
      >
        <DialogHeader>
          <DialogTitle>{t(`title.${kind}`)}</DialogTitle>
          <DialogDescription>
            {ctx.data?.document
              ? t('subtitle', { number: ctx.data.document.number, customer: ctx.data.document.customerName })
              : t('subtitleFree')}
          </DialogDescription>
        </DialogHeader>
        {ctx.isPending ? <ListSkeleton rows={4} /> : null}
        {ctx.isError ? <ErrorState error={ctx.error} onRetry={() => void ctx.refetch()} /> : null}
        {ctx.data ? <ComposerBody ctx={ctx.data} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ComposerBody({ ctx, onClose }: { ctx: MailContext; onClose: () => void }) {
  const { t } = useTranslation('mail');
  const doc = ctx.document;
  const [to, setTo] = useState(ctx.to);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(ctx.subject);
  const [body, setBody] = useState(ctx.body);
  const [attachPdf, setAttachPdf] = useState(doc !== null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [shareUrl, setShareUrl] = useState(ctx.shareUrl);
  const [confirm, setConfirm] = useState<'real' | 'test' | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  // one key per intent: the same text retried (after a 503 / network error) keeps it, an edited text is a new intent
  const realKey = useRef({ sig: '', key: crypto.randomUUID() });
  const fired = useRef(false); // a second click in the same frame must not send twice

  const pdf = useMailPdf(doc?.id, attachPdf && doc !== null);
  const send = useSendMail();
  const makeLink = useMakeQuoteLink();

  const toList = parseEmails(to);
  const ccList = parseEmails(cc);
  // a sample goes to the signed-in user's own email only (the API refuses any other address)
  const testList = parseEmails(ctx.me.email);
  const invalid = [...toList.invalid, ...ccList.invalid];
  const addressProblem =
    invalid.length > 0
      ? t('problem.badAddress', { list: invalid.join(', ') })
      : toList.valid.length === 0
        ? t('problem.noRecipient')
        : null;
  const hasText = subject.trim().length > 0 && body.trim().length > 0;

  const compose: MailCompose | null =
    !addressProblem && hasText
      ? {
          kind: ctx.kind,
          documentId: doc?.id,
          to: toList.valid,
          cc: ccList.valid,
          subject,
          body,
          attachPdf: attachPdf && doc !== null,
          pdfJobId: pdf.jobId ?? undefined,
          files: files.map(({ fileId, name }) => ({ fileId, name })),
          test: false,
        }
      : null;
  const key = compose ? JSON.stringify(compose) : null;
  const settled = useDebounced(key, 400);
  const preview = useMailPreview(settled ? (JSON.parse(settled) as MailCompose) : null);
  // the preview on screen is of the text as it stands now (not still typing, not the previous answer)
  const previewCurrent =
    key !== null &&
    settled === key &&
    preview.data !== undefined &&
    !preview.isFetching &&
    !preview.isPlaceholderData;

  const wantsPdf = attachPdf && doc !== null;
  const blocked =
    addressProblem ??
    (!hasText ? t('problem.empty') : null) ??
    (wantsPdf && pdf.status === 'rendering' ? t('problem.pdfRendering') : null) ??
    (wantsPdf && pdf.status === 'failed' ? t('problem.pdfFailed') : null) ??
    (uploading ? t('problem.uploading') : null) ??
    (!previewCurrent ? t('problem.previewFirst') : null);
  const testBlocked =
    (testList.valid.length !== 1 || testList.invalid.length > 0 ? t('problem.testAddress') : null) ??
    (!hasText ? t('problem.empty') : null) ??
    (wantsPdf && pdf.status !== 'ready' ? t('problem.pdfRendering') : null) ??
    (uploading ? t('problem.uploading') : null);

  const pick = async (list: FileList | null) => {
    const file = list?.[0];
    if (picker.current) picker.current.value = '';
    if (!file) return;
    if (files.reduce((n, f) => n + f.size, 0) + file.size > MAX_UPLOAD_BYTES) {
      toast.error(t('file.tooLarge'));
      return;
    }
    setUploading(true);
    try {
      const fileId = await uploadMailFile(file);
      setFiles((f) => [...f, { fileId, name: file.name, size: file.size }]);
    } catch {
      toast.error(t('file.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const addLink = async () => {
    if (!doc) return;
    const { url } = await makeLink.mutateAsync(doc.id);
    setShareUrl(url);
    // the new link goes in the letter where the template puts it; an edited letter just gets a line at the end
    if (body === ctx.body)
      setBody(ctx.body.replace(/\n\nหากมีข้อสงสัย/, `\n(${t('linkLine')} ${url})\n\nหากมีข้อสงสัย`));
    else setBody(`${body.trimEnd()}\n\n${t('linkLine')} ${url}`);
  };

  const keyFor = () => {
    const sig = JSON.stringify([
      toList.valid,
      ccList.valid,
      subject,
      body,
      wantsPdf,
      files.map((f) => f.fileId),
    ]);
    if (realKey.current.sig !== sig) realKey.current = { sig, key: crypto.randomUUID() };
    return realKey.current.key;
  };

  /** Resolves when sent; rejects (after toasting) when not, so the PIN dialog can show a PIN problem in place. */
  const submit = async (isTest: boolean, pin?: string) => {
    if (fired.current) return;
    fired.current = true;
    try {
      const res = await send.mutateAsync({
        kind: ctx.kind,
        documentId: doc?.id,
        to: isTest ? testList.valid : toList.valid,
        cc: isTest ? [] : ccList.valid,
        subject,
        body,
        attachPdf: wantsPdf,
        pdfJobId: pdf.jobId ?? undefined,
        files: files.map(({ fileId, name }) => ({ fileId, name })),
        test: isTest,
        idempotencyKey: isTest ? crypto.randomUUID() : keyFor(),
        pin,
      });
      setConfirm(null);
      if (isTest) toast.success(t('sentTest', { to: testList.valid[0] }));
      else {
        if (res.email.status === 'failed') {
          // the first attempt was refused by the mail provider: the same text would answer with that row again, so the next try is a new intent
          realKey.current = { sig: '', key: crypto.randomUUID() };
          toast.error(t('failedBefore', { reason: res.email.error ?? '' }));
          return;
        }
        toast.success(t(res.duplicate ? 'alreadySent' : 'sentOk', { to: toList.valid.join(', ') }));
        onClose();
      }
    } catch (e) {
      // the key stays: after a 503 / network error the server may already hold the mail, and the same key makes the retry
      // pick it up (or queue it once) instead of sending a second email. A new compose (a new dialog) gets a new key.
      throw e;
    } finally {
      fired.current = false;
    }
  };

  const confirmBody = (isTest: boolean) => (
    <dl className="grid gap-1 text-sm" data-testid="mail-confirm-summary">
      <div className="flex gap-2">
        <dt className="w-16 shrink-0 text-muted-foreground">{t('field.to')}</dt>
        <dd className="min-w-0 break-words font-medium">{(isTest ? testList : toList).valid.join(', ')}</dd>
      </div>
      {!isTest && ccList.valid.length > 0 ? (
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-muted-foreground">CC</dt>
          <dd className="min-w-0 break-words">{ccList.valid.join(', ')}</dd>
        </div>
      ) : null}
      {ctx.bcc ? (
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-muted-foreground">BCC</dt>
          <dd className="min-w-0 break-words">{ctx.bcc}</dd>
        </div>
      ) : null}
      <div className="flex gap-2">
        <dt className="w-16 shrink-0 text-muted-foreground">{t('field.from')}</dt>
        <dd className="min-w-0 break-words">{ctx.from}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="w-16 shrink-0 text-muted-foreground">{t('field.subject')}</dt>
        <dd className="min-w-0 break-words">
          {isTest ? t('testPrefix') : ''}
          {subject}
        </dd>
      </div>
    </dl>
  );

  return (
    <>
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <div className="grid min-w-0 content-start gap-3" data-testid="mail-form">
          <Field
            id="mail-to"
            label={t('field.to')}
            hint={doc && !ctx.to ? t('hint.noContactEmail') : undefined}
          >
            <Input
              id="mail-to"
              type="text"
              inputMode="email"
              autoComplete="off"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="name@company.com"
            />
          </Field>
          <Field id="mail-cc" label={t('field.cc')} hint={t('hint.cc')}>
            <Input
              id="mail-cc"
              type="text"
              inputMode="email"
              autoComplete="off"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
            />
          </Field>
          <Field id="mail-subject" label={t('field.subject')}>
            <Input
              id="mail-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={300}
            />
          </Field>
          <Field id="mail-body" label={t('field.body')} hint={t('hint.body')}>
            <Textarea
              id="mail-body"
              rows={14}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-60 leading-relaxed"
            />
          </Field>

          <div className="grid gap-2 rounded-lg border p-3" data-testid="mail-attachments">
            <div className="text-sm font-medium">{t('attach.title')}</div>
            {doc ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="mail-attach-pdf" className="flex min-w-0 items-center gap-2 font-normal">
                  <Switch id="mail-attach-pdf" checked={attachPdf} onCheckedChange={setAttachPdf} />
                  <span className="min-w-0 break-words">{t('attach.pdf', { number: doc.number })}</span>
                </Label>
                {attachPdf ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                    data-testid="mail-pdf-state"
                  >
                    {pdf.status === 'rendering' ? <Loader2 className="size-3 animate-spin" /> : null}
                    {t(`attach.pdfState.${pdf.status === 'off' ? 'rendering' : pdf.status}`)}
                    {pdf.status === 'failed' ? (
                      <Button type="button" variant="ghost" size="sm" onClick={pdf.retry}>
                        {t('attach.retry')}
                      </Button>
                    ) : null}
                  </span>
                ) : null}
              </div>
            ) : null}
            {files.map((f) => (
              <div key={f.fileId} className="flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {(f.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t('file.remove')}
                  onClick={() => setFiles((all) => all.filter((x) => x.fileId !== f.fileId))}
                >
                  <X />
                </Button>
              </div>
            ))}
            <input
              ref={picker}
              type="file"
              className="sr-only"
              tabIndex={-1}
              aria-label={t('file.add')}
              data-testid="mail-file"
              onChange={(e) => void pick(e.target.files)}
            />
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading || files.length >= 5}
                onClick={() => picker.current?.click()}
              >
                {uploading ? <Loader2 className="animate-spin" /> : <Paperclip />} {t('file.add')}
              </Button>
              <span className="ml-2 text-xs text-muted-foreground">{t('file.limit')}</span>
            </div>
            {ctx.canMakeLink ? (
              <div
                className="flex flex-wrap items-center gap-2 border-t pt-2 text-sm"
                data-testid="mail-link"
              >
                <Link2 className="size-4 text-muted-foreground" aria-hidden />
                {shareUrl ? (
                  <span className="min-w-0 break-all text-muted-foreground">{t('link.have')}</span>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 text-muted-foreground">{t('link.none')}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={makeLink.isPending}
                      onClick={() => void addLink()}
                    >
                      {t('link.make')}
                    </Button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <PreviewPane
          preview={preview.data}
          loading={key !== null && !previewCurrent && !preview.isError}
          error={preview.isError ? preview.error : null}
          idle={key === null}
          idleText={addressProblem ?? t('problem.empty')}
        />
      </div>

      <DialogFooter className="sticky bottom-0 z-10 -mx-4 -mb-4 items-stretch gap-3 border-t bg-background px-4 pt-4 pb-4 sm:-mx-6 sm:-mb-6 sm:items-end sm:justify-between sm:px-6 sm:pb-6">
        <div className="grid min-w-0 gap-1.5" data-testid="mail-test">
          <Label htmlFor="mail-test-to" className="text-xs text-muted-foreground">
            {t('test.label')}
          </Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="mail-test-to"
              type="text"
              inputMode="email"
              autoComplete="off"
              className="min-w-0 flex-1 sm:w-64 sm:flex-none"
              value={ctx.me.email}
              readOnly
            />
            <Button
              type="button"
              variant="outline"
              disabled={send.isPending}
              blockedReason={testBlocked}
              data-testid="mail-send-test"
              onClick={() => (ctx.needsPin ? setConfirm('test') : void submit(true).catch(() => undefined))}
            >
              <FlaskConical /> {t('test.button')}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            disabled={send.isPending}
            blockedReason={blocked}
            data-testid="mail-send"
            onClick={() => setConfirm('real')}
          >
            {send.isPending ? <Loader2 className="animate-spin" /> : <Send />} {t('send')}
          </Button>
        </div>
      </DialogFooter>

      {confirm && ctx.needsPin ? (
        <IssuePinDialog
          testId="mail-pin"
          title={t(confirm === 'test' ? 'confirm.testTitle' : 'confirm.title')}
          description={t(confirm === 'test' ? 'confirm.testBody' : 'confirm.pinBody')}
          confirmLabel={t(confirm === 'test' ? 'test.button' : 'send')}
          onClose={() => setConfirm(null)}
          onSubmit={(pin) => submit(confirm === 'test', pin)}
        >
          {confirmBody(confirm === 'test')}
        </IssuePinDialog>
      ) : null}
      <ConfirmDialog
        open={confirm === 'real' && !ctx.needsPin}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('confirm.title')}
        description={
          <span className="grid gap-3">
            <span>{t('confirm.body')}</span>
            {confirmBody(false)}
            {ctx.bcc ? <span className="text-xs">{t('confirm.bcc', { bcc: ctx.bcc })}</span> : null}
          </span>
        }
        confirmLabel={t('send')}
        pending={send.isPending}
        onConfirm={() => void submit(false).catch(() => setConfirm(null))}
      />
    </>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** The right side: the sender line, subject, attachments and the HTML the customer gets (a sandboxed frame, nothing runs). */
function PreviewPane({
  preview,
  loading,
  error,
  idle,
  idleText,
}: {
  preview: MailPreview | undefined;
  loading: boolean;
  error: unknown;
  idle: boolean;
  idleText: string;
}) {
  const { t } = useTranslation('mail');
  return (
    <section
      className="grid min-w-0 content-start gap-2 rounded-xl border bg-muted/30 p-3"
      aria-label={t('preview.title')}
      data-testid="mail-preview"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t('preview.title')}</h3>
        {loading ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> {t('preview.updating')}
          </span>
        ) : null}
      </div>
      {idle && !preview ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{idleText}</p>
      ) : null}
      {error ? <ErrorState error={error} /> : null}
      {preview ? (
        <>
          <dl className="grid gap-1 text-sm" data-testid="mail-preview-head">
            <Row label={t('field.from')}>{preview.from}</Row>
            <Row label={t('field.to')}>{preview.to.join(', ')}</Row>
            {preview.cc.length > 0 ? <Row label="CC">{preview.cc.join(', ')}</Row> : null}
            {preview.bcc.length > 0 ? (
              <Row label="BCC">
                {preview.bcc.join(', ')}{' '}
                <span className="text-xs text-muted-foreground">({t('preview.bccHidden')})</span>
              </Row>
            ) : null}
            <Row label={t('field.subject')}>
              <span className="font-medium">{preview.subject}</span>
              {preview.isTest ? (
                <Badge variant="outline" className="ml-2">
                  {t('testBadge')}
                </Badge>
              ) : null}
            </Row>
          </dl>
          {preview.attachments.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label={t('attach.title')}>
              {preview.attachments.map((a) => (
                <li
                  key={a.name}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
                >
                  <Paperclip className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{a.name}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <iframe
            title={t('preview.frame')}
            sandbox=""
            srcDoc={preview.html}
            className="h-80 w-full rounded-md border bg-white"
            data-testid="mail-preview-frame"
          />
        </>
      ) : null}
      <p className="text-xs text-muted-foreground">{t('replyNote')}</p>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
