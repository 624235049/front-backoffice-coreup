import { Ellipsis, KeyRound, Link2, LogOut, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { UserRow } from '../api';
import { formatDateTime, useIntlLocale } from '../format';
import { OwnerPhone } from './owner-phone';
import { CopyButton, ResetLinkDialog, ResetPasswordDialog, RevokeSessionsDialog } from './user-actions';
import { type UserActionKind, UserDetailSheet } from './user-detail-sheet';
import { UserBadges, UserMemberships } from './user-parts';

type ActionUser = Pick<UserRow, 'id' | 'name' | 'email' | 'isTeam' | 'activeSessions'>;

/**
 * User list (table on desktop, cards on phones) + detail sheet + the three account actions. Shared by `/platform/users`
 * and the shop's "ผู้ใช้" tab. Only `platform_owner` (`canChange`) sees the actions; admins read.
 */
export function UsersPanel({
  rows,
  canChange,
  selfId,
}: {
  rows: UserRow[];
  canChange: boolean;
  selfId: string | undefined;
}) {
  const { t } = useTranslation('users');
  const locale = useIntlLocale();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [action, setAction] = useState<{ kind: UserActionKind; user: ActionUser } | null>(null);
  const start = (kind: UserActionKind, user: ActionUser) => setAction({ kind, user });
  const lastSignIn = (u: UserRow) => (u.lastSignInAt ? formatDateTime(u.lastSignInAt, locale) : t('never'));

  const menu = (u: UserRow) => {
    const self = u.id === selfId;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label={t('actionsFor', { name: u.name })}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDetailId(u.id)}>
            <UserRound /> {t('action.open')}
          </DropdownMenuItem>
          {canChange ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={self ? 'opacity-50' : undefined}
                onSelect={() => (self ? toast.warning(t('error.self')) : start('reset', u))}
              >
                <KeyRound /> {t('action.reset')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => start('link', u)}>
                <Link2 /> {t('action.link')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={self ? 'opacity-50' : undefined}
                onSelect={() => (self ? toast.warning(t('error.self')) : start('revoke', u))}
              >
                <LogOut /> {t('action.revoke')}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const identity = (u: UserRow) => (
    <>
      <button
        type="button"
        className="text-left font-medium text-navy-900 underline-offset-2 hover:underline"
        onClick={() => setDetailId(u.id)}
      >
        {u.name}
      </button>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="break-all">{u.email ?? '–'}</span>
        {u.email ? (
          <CopyButton
            value={u.email}
            label={t('copyEmail')}
            copiedLabel={t('copied')}
            size="icon-sm"
            variant="ghost"
            className="size-6"
          />
        ) : null}
      </div>
      <OwnerPhone phone={u.phone} />
    </>
  );

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('col.user')}</TableHead>
              <TableHead>{t('col.shops')}</TableHead>
              <TableHead>{t('col.lastSignIn')}</TableHead>
              <TableHead>{t('col.status')}</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">{t('col.actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="min-w-56">{identity(u)}</TableCell>
                <TableCell className="min-w-56">
                  <UserMemberships u={u} />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div>{lastSignIn(u)}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('sessions', { count: u.activeSessions })}
                  </div>
                </TableCell>
                <TableCell>
                  <UserBadges u={u} />
                </TableCell>
                <TableCell className="text-right">{menu(u)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {rows.map((u) => (
          <li key={u.id} className="grid gap-2 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">{identity(u)}</div>
              {menu(u)}
            </div>
            <UserMemberships u={u} />
            <UserBadges u={u} />
            <div className="text-xs text-muted-foreground">
              {t('col.lastSignIn')}: {lastSignIn(u)} · {t('sessions', { count: u.activeSessions })}
            </div>
          </li>
        ))}
      </ul>

      <UserDetailSheet
        userId={detailId}
        onClose={() => setDetailId(null)}
        canChange={canChange}
        selfId={selfId}
        onAction={start}
      />
      {action?.kind === 'reset' ? (
        <ResetPasswordDialog
          user={action.user}
          open
          onOpenChange={(o) => (o ? undefined : setAction(null))}
        />
      ) : null}
      {action?.kind === 'link' ? (
        <ResetLinkDialog user={action.user} open onOpenChange={(o) => (o ? undefined : setAction(null))} />
      ) : null}
      {action?.kind === 'revoke' ? (
        <RevokeSessionsDialog
          user={action.user}
          open
          onOpenChange={(o) => (o ? undefined : setAction(null))}
        />
      ) : null}
    </>
  );
}
