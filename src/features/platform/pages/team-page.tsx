import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMe } from '@/lib/me';
import { useMembership } from '@/lib/membership';
import { type TeamMember, useAddTeamMember, usePatchTeamMember, useTeam } from '../api';
import { formatDateTime, useIntlLocale } from '../format';

const ROLES = ['platform_owner', 'platform_admin', 'platform_consultant', 'platform_sales'] as const;

/** `/platform/team` — the CoreUp team and their roles (docs/09 §5). Only `platform_owner` changes it. */
export function TeamPage() {
  const { t } = useTranslation('platform');
  const locale = useIntlLocale();
  const isOwner = useMembership().roles.includes('platform_owner');
  const me = useMe();
  const team = useTeam();
  const patch = usePatchTeamMember();
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader
        title={t('team.title')}
        description={t('team.description')}
        actions={
          isOwner ? (
            <Button onClick={() => setAdding(true)}>
              <UserPlus /> {t('team.add')}
            </Button>
          ) : null
        }
      />
      <QueryState
        query={team}
        isEmpty={(rows) => rows.length === 0}
        empty={<EmptyState icon={UserPlus} title={t('team.empty')} />}
      >
        {(rows: TeamMember[]) => (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('team.col.name')}</TableHead>
                  <TableHead>{t('team.col.role')}</TableHead>
                  <TableHead>{t('team.col.status')}</TableHead>
                  <TableHead>{t('team.col.shops')}</TableHead>
                  <TableHead>{t('team.col.lastLogin')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => {
                  const self = m.userId === me.data?.user.id;
                  return (
                    <TableRow key={m.membershipId}>
                      <TableCell>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </TableCell>
                      <TableCell>
                        {isOwner ? (
                          <Select
                            value={m.role ?? undefined}
                            disabled={self}
                            onValueChange={(role) =>
                              patch.mutate({
                                id: m.membershipId,
                                body: { role: role as (typeof ROLES)[number] },
                              })
                            }
                          >
                            <SelectTrigger className="w-52" aria-label={t('team.col.role')}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {t(`platformRole.${r}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          (m.role && t(`platformRole.${m.role}`)) || '–'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.status === 'active' ? 'success' : 'secondary'}>
                          {t(`memberStatus.${m.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>{m.assignedTenants}</TableCell>
                      <TableCell>{formatDateTime(m.lastLoginAt, locale)}</TableCell>
                      <TableCell className="text-right">
                        {isOwner && !self ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              patch.mutate({
                                id: m.membershipId,
                                body: { status: m.status === 'active' ? 'inactive' : 'active' },
                              })
                            }
                          >
                            {m.status === 'active' ? t('team.deactivate') : t('team.activate')}
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>
      <AddMemberDialog open={adding} onOpenChange={setAdding} />
    </>
  );
}

function AddMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation('platform');
  const add = useAddTeamMember();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<(typeof ROLES)[number]>('platform_consultant');
  const valid = /^\S+@\S+\.\S+$/.test(email) && name.trim().length > 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('team.add')}</DialogTitle>
          <DialogDescription>{t('team.addHint')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="tm-name">{t('team.col.name')}</Label>
            <Input id="tm-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tm-email">{t('onboard.ownerEmail')}</Label>
            <Input id="tm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>{t('team.col.role')}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger aria-label={t('team.col.role')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`platformRole.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!valid || add.isPending}
            onClick={() =>
              add.mutate(
                { email, name: name.trim(), role },
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    setEmail('');
                    setName('');
                  },
                },
              )
            }
          >
            {t('team.addSubmit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
