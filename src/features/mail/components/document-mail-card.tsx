import { Link } from '@tanstack/react-router';
import { Mail } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMembership } from '@/lib/membership';
import { useOutbox } from '../api';
import { MailComposer } from './mail-composer';
import { MailHistoryLine, MailStatusBadge } from './mail-status';

const SHOWN = 5;

/**
 * "ส่งอีเมลให้ลูกค้า" on an issued quotation / invoice: opens the composer and lists what was already sent
 * ("ส่งเมลแล้ว 16 พ.ย. 12:30 → … · ถึงแล้ว"). A quotation is for the owner and sales; the API refuses anyone else.
 */
export function DocumentMailCard({ doc }: { doc: { id: string; type: 'quotation' | 'invoice' } }) {
  const { t } = useTranslation('mail');
  const roles = useMembership().roles;
  const [open, setOpen] = useState(false);
  const history = useOutbox({ documentId: doc.id });
  const mails = history.data?.pages.flatMap((p) => p.data) ?? [];
  const canSend =
    doc.type === 'invoice' || roles.includes('platform_owner') || roles.includes('platform_sales');

  return (
    <Card className="mb-4" data-testid="document-mail-card">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="size-4" aria-hidden /> {t('card.title')}
        </CardTitle>
        {canSend ? (
          <Button type="button" onClick={() => setOpen(true)} data-testid="mail-open">
            <Mail /> {t('card.send')}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {history.isPending ? <Skeleton className="h-5 w-2/3" /> : null}
        {history.isError ? <p className="text-destructive">{t('card.loadFailed')}</p> : null}
        {!history.isPending && !history.isError && mails.length === 0 ? (
          <p className="text-muted-foreground">{t('card.empty')}</p>
        ) : null}
        <ul className="grid gap-1.5" data-testid="document-mail-history">
          {mails.slice(0, SHOWN).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2">
              <MailHistoryLine mail={m} />
              <MailStatusBadge mail={m} />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{t('replyNote')}</span>
          {mails.length > 0 ? (
            <Link to={'/mail' as never} className="text-mint-700 hover:underline">
              {t('card.all')}
            </Link>
          ) : null}
        </div>
      </CardContent>
      {open ? <MailComposer kind={doc.type} documentId={doc.id} onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}
