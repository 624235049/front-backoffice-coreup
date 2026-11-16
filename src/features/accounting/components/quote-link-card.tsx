import { Copy, ExternalLink, Link2, LinkIcon, MessageCircle, RefreshCw, Unlink } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDate, useIntlLocale } from '@/features/platform/format';
import { type AccDocument, useCreateQuoteLink, useRevokeQuoteLink } from '../api';
import { formatAmount } from '../lib/format';

/**
 * The customer link of an issued quotation (`coreup.biz/q/<token>`): issue / copy / open / share on LINE, replace the
 * link (the old one dies) or turn it off, and what the customer did with it (opened, accepted by whom and when).
 */
export function QuoteLinkCard({ doc }: { doc: AccDocument }) {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const create = useCreateQuoteLink();
  const revoke = useRevokeQuoteLink();
  const [confirm, setConfirm] = useState<'rotate' | 'revoke' | null>(null);
  const url = doc.shareUrl;
  const stamp = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

  const lineText = [
    t('quoteLink.shareText', {
      number: doc.number,
      project: doc.project ?? '',
      total: formatAmount(doc.totalMinor, locale),
      until: doc.dueDate ? formatDate(doc.dueDate, locale) : '',
    }).replace(/\s+/g, ' '),
    url,
  ].join(' ');

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('quoteLink.copied'));
    } catch {
      toast.error(t('quoteLink.copyFailed'));
    }
  };

  return (
    <Card className="mb-4" data-testid="quote-link-card">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="size-4" aria-hidden /> {t('quoteLink.title')}
        </CardTitle>
        <div className="flex flex-wrap gap-2" data-testid="quote-link-chips">
          {doc.viewedAt ? (
            <Badge variant="secondary">
              {t('quoteLink.viewed')} · {stamp(doc.viewedAt)}
            </Badge>
          ) : null}
          {doc.acceptedAt ? (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              {t('quoteLink.accepted')} · {doc.acceptedName} · {stamp(doc.acceptedAt)}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {url ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Input
                readOnly
                value={url}
                aria-label={t('quoteLink.url')}
                className="min-w-0 flex-1 font-mono text-sm"
              />
              <Button type="button" variant="outline" onClick={() => void copy()}>
                <Copy /> {t('quoteLink.copy')}
              </Button>
              <Button asChild variant="outline">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> {t('quoteLink.open')}
                </a>
              </Button>
              <Button asChild variant="outline">
                <a
                  href={`https://line.me/R/share?text=${encodeURIComponent(lineText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle /> {t('quoteLink.line')}
                </a>
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm('rotate')}>
                <RefreshCw /> {t('quoteLink.rotate')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm('revoke')}>
                <Unlink /> {t('quoteLink.revoke')}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => create.mutate(doc.id)} disabled={create.isPending}>
              <LinkIcon /> {t('quoteLink.issue')}
            </Button>
            <p className="text-sm text-muted-foreground">{t('quoteLink.issueHint')}</p>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t(confirm === 'revoke' ? 'quoteLink.revokeTitle' : 'quoteLink.rotateTitle')}
        description={t(confirm === 'revoke' ? 'quoteLink.revokeBody' : 'quoteLink.rotateBody')}
        confirmLabel={t(confirm === 'revoke' ? 'quoteLink.revoke' : 'quoteLink.rotate')}
        destructive
        pending={create.isPending || revoke.isPending}
        onConfirm={() => {
          const done = () => setConfirm(null);
          if (confirm === 'revoke') revoke.mutate(doc.id, { onSuccess: done });
          else create.mutate(doc.id, { onSuccess: done });
        }}
      />
    </Card>
  );
}
