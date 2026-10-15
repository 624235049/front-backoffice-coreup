import { Link, useNavigate } from '@tanstack/react-router';
import { ClipboardCheck, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type Audit, useAudits, useCreateAudit, useTenants } from '../api';
import { formatDate, useIntlLocale } from '../format';

export function AuditStatusBadge({ status }: { status: Audit['status'] }) {
  const { t } = useTranslation('platform');
  const tone = { open: 'secondary', scoring: 'warning', reported: 'success', closed: 'outline' } as const;
  return <Badge variant={tone[status]}>{t(`auditStatus.${status}`)}</Badge>;
}

export function AuditsPage() {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const audits = useAudits();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader
        title={t('audits.title')}
        description={t('audits.description')}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> {t('audits.add')}
          </Button>
        }
      />
      <QueryState
        query={audits}
        isEmpty={(rows) => rows.length === 0}
        empty={
          <EmptyState
            icon={ClipboardCheck}
            title={t('audits.empty')}
            description={t('audits.emptyHint')}
            action={<Button onClick={() => setCreating(true)}>{t('audits.add')}</Button>}
          />
        }
      >
        {(rows) => (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('audits.col.shop')}</TableHead>
                  <TableHead>{t('audits.col.status')}</TableHead>
                  <TableHead>{t('audits.col.started')}</TableHead>
                  <TableHead>{t('audits.col.consultant')}</TableHead>
                  <TableHead className="text-right">{t('audits.col.scored')}</TableHead>
                  <TableHead className="text-right">{t('audits.col.findings')}</TableHead>
                  <TableHead className="text-right">{t('audits.col.overall')}</TableHead>
                  <TableHead>{t('audits.col.report')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link
                        to="/platform/audits/$id"
                        params={{ id: a.id }}
                        className="font-medium hover:underline"
                      >
                        {a.tenantName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <AuditStatusBadge status={a.status} />
                    </TableCell>
                    <TableCell>{formatDate(a.startedOn, locale)}</TableCell>
                    <TableCell>{a.consultantName ?? '–'}</TableCell>
                    <TableCell className="text-right">{a.scored}</TableCell>
                    <TableCell className="text-right">{a.findings}</TableCell>
                    <TableCell className="text-right">
                      {a.overall === null ? '–' : a.overall.toFixed(0)}
                    </TableCell>
                    <TableCell>{a.reportFileId ? t('audits.reportReady') : '–'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>
      <CreateAuditDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function CreateAuditDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation('platform');
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const tenants = useTenants({});
  const create = useCreateAudit();
  const [tenantId, setTenantId] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle>{t('audits.add')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label>{t('audits.col.shop')}</Label>
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger aria-label={t('audits.col.shop')}>
              <SelectValue placeholder={t('engagements.pickShop')} />
            </SelectTrigger>
            <SelectContent>
              {(tenants.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button
            disabled={create.isPending}
            blockedReason={!tenantId && t('audits.pickShopFirst')}
            onClick={async () => {
              const res = await create.mutateAsync({ tenantId });
              onOpenChange(false);
              setTenantId('');
              void navigate({ to: '/platform/audits/$id', params: { id: res.data.id } });
            }}
          >
            {t('audits.start')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
