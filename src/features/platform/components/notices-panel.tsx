import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/lib/permissions';
import { useSendNotice, useTenantNotices } from '../api';
import { formatDateTime, useIntlLocale } from '../format';

/**
 * ส่งแจ้งเตือนถึงร้าน: an in-app (bell) notice to every owner of the shop, with an optional link button into the shop app
 * and an optional email copy. Below it, the notices already sent.
 */
export function NoticesPanel({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const canWrite = useCan('platform:write');
  const notices = useTenantNotices(tenantId);
  const send = useSendNotice(tenantId);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkPath, setLinkPath] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [email, setEmail] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const pathOk = linkPath === '' || /^\/(?!\/)\S*$/.test(linkPath.trim());
  const blocked =
    title.trim() === ''
      ? t('notices.needTitle')
      : body.trim() === ''
        ? t('notices.needBody')
        : !pathOk
          ? t('notices.badPath')
          : linkLabel.trim() !== '' && linkPath.trim() === ''
            ? t('notices.labelNeedsPath')
            : false;

  return (
    <div className="grid gap-4">
      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('notices.title')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">{t('notices.hint')}</p>
            <div className="grid gap-1.5">
              <Label htmlFor="notice-title">{t('notices.fieldTitle')}</Label>
              <Input
                id="notice-title"
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="notice-body">{t('notices.fieldBody')}</Label>
              <Textarea
                id="notice-body"
                rows={6}
                value={body}
                maxLength={1000}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="notice-path">{t('notices.fieldPath')}</Label>
                <Input
                  id="notice-path"
                  value={linkPath}
                  maxLength={200}
                  placeholder="/settings/services"
                  onChange={(e) => setLinkPath(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="notice-label">{t('notices.fieldLabel')}</Label>
                <Input
                  id="notice-label"
                  value={linkLabel}
                  maxLength={40}
                  placeholder={t('notices.labelPlaceholder')}
                  onChange={(e) => setLinkLabel(e.target.value)}
                />
              </div>
            </div>
            <label htmlFor="notice-email" className="flex min-h-9 items-center gap-2 text-sm">
              <Checkbox id="notice-email" checked={email} onCheckedChange={(c) => setEmail(c === true)} />
              {t('notices.email')}
            </label>
            <Button
              className="justify-self-start"
              disabled={send.isPending}
              blockedReason={blocked}
              onClick={() => setConfirm(true)}
            >
              {t('notices.send')}
            </Button>
            <ConfirmDialog
              open={confirm}
              onOpenChange={setConfirm}
              title={t('notices.confirm')}
              description={t('notices.confirmHint')}
              pending={send.isPending}
              onConfirm={() =>
                send.mutate(
                  {
                    title: title.trim(),
                    body: body.trim(),
                    linkPath: linkPath.trim() || undefined,
                    linkLabel: linkLabel.trim() || undefined,
                    email,
                  },
                  {
                    onSuccess: (r) => {
                      setConfirm(false);
                      setTitle('');
                      setBody('');
                      setLinkPath('');
                      setLinkLabel('');
                      setEmail(false);
                      toast.success(t('notices.sent', { count: r.data.recipients }));
                    },
                  },
                )
              }
            />
          </CardContent>
        </Card>
      ) : null}
      <QueryState
        query={notices}
        isEmpty={(rows) => rows.length === 0}
        empty={<p className="text-sm text-muted-foreground">{t('notices.empty')}</p>}
      >
        {(rows) => (
          <ul className="divide-y rounded-lg border" data-testid="notice-list">
            {rows.map((n) => (
              <li key={n.id} className="grid gap-1 px-4 py-3 text-sm">
                <div className="font-medium">{n.title}</div>
                <p className="whitespace-pre-line text-muted-foreground">{n.body}</p>
                {n.linkPath ? (
                  <div className="text-xs">
                    {t('notices.link')}: {n.linkLabel ?? t('notices.defaultLabel')} → {n.linkPath}
                  </div>
                ) : null}
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(n.createdAt, locale)} · {n.sentByName ?? '–'} ·{' '}
                  {t('notices.recipients', { count: n.recipients })}
                  {n.email ? ` · ${t('notices.emailed', { count: n.emailed })}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}
