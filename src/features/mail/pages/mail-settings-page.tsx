import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorState } from '@/components/error-state';
import { PageHeader } from '@/components/page-header';
import { ListSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMembership } from '@/lib/membership';
import { type MailSettings, useMailSettings, useSaveMailSettings } from '../api';

const TEMPLATES = ['quotation', 'invoice', 'free'] as const;
const VARIABLES =
  '{{customerName}} {{number}} {{project}} {{total}} {{balance}} {{validUntil}} {{dueDate}} {{link}} {{signature}}';

/** Owner only: sender display name, signature block, the record-copy address and the three templates. */
export function MailSettingsPage() {
  const { t } = useTranslation('mail');
  const isOwner = useMembership().roles.includes('platform_owner');
  const settings = useMailSettings(isOwner);

  return (
    <>
      <PageHeader
        title={t('settings.title')}
        description={
          <Link to={'/mail' as never} className="hover:underline">
            ← {t('page.title')}
          </Link>
        }
      />
      {!isOwner ? <p className="text-sm text-muted-foreground">{t('settings.ownerOnly')}</p> : null}
      {isOwner && settings.isPending ? <ListSkeleton rows={4} /> : null}
      {isOwner && settings.isError ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : null}
      {settings.data ? <SettingsForm initial={settings.data} /> : null}
    </>
  );
}

function SettingsForm({ initial }: { initial: MailSettings }) {
  const { t } = useTranslation('mail');
  const save = useSaveMailSettings();
  const [form, setForm] = useState<MailSettings>(initial);
  const set = (patch: Partial<MailSettings>) => setForm((f) => ({ ...f, ...patch }));
  const setTemplate = (k: (typeof TEMPLATES)[number], patch: Partial<MailSettings['templates'][typeof k]>) =>
    setForm((f) => ({ ...f, templates: { ...f.templates, [k]: { ...f.templates[k], ...patch } } }));
  const bccBad = form.bccRecord.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.bccRecord.trim());

  return (
    <form
      className="grid max-w-3xl gap-5"
      data-testid="mail-settings"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(
          { ...form, bccRecord: form.bccRecord.trim() },
          { onSuccess: () => toast.success(t('settings.saved')) },
        );
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.sender')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ms-name">{t('settings.senderName')}</Label>
            <Input
              id="ms-name"
              value={form.senderName}
              maxLength={80}
              onChange={(e) => set({ senderName: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {t('settings.senderHint', { name: form.senderName })}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ms-bcc">{t('settings.bcc')}</Label>
            <Input
              id="ms-bcc"
              type="email"
              value={form.bccRecord}
              aria-invalid={bccBad}
              onChange={(e) => set({ bccRecord: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">{t('settings.bccHint')}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ms-sig">{t('settings.signature')}</Label>
            <Textarea
              id="ms-sig"
              rows={6}
              value={form.signature}
              maxLength={1000}
              onChange={(e) => set({ signature: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {TEMPLATES.map((k) => (
        <Card key={k}>
          <CardHeader>
            <CardTitle className="text-base">{t(`settings.template.${k}`)}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`ms-${k}-subject`}>{t('field.subject')}</Label>
              <Input
                id={`ms-${k}-subject`}
                value={form.templates[k].subject}
                maxLength={300}
                onChange={(e) => setTemplate(k, { subject: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`ms-${k}-body`}>{t('field.body')}</Label>
              <Textarea
                id={`ms-${k}-body`}
                rows={14}
                className="leading-relaxed"
                value={form.templates[k].body}
                maxLength={8000}
                onChange={(e) => setTemplate(k, { body: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>
      ))}
      <p className="text-xs text-muted-foreground">
        {t('settings.variables')} <code className="break-all">{VARIABLES}</code>
      </p>
      <div>
        <Button type="submit" disabled={save.isPending} blockedReason={bccBad ? t('settings.bccBad') : false}>
          {t('settings.save')}
        </Button>
      </div>
    </form>
  );
}
