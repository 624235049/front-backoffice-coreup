import { KeyRound, Link2, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { type UserDetail, useUser } from '../api';
import { formatDateTime, useIntlLocale } from '../format';
import { describeUserAgent } from '../user-helpers';
import { CopyButton } from './user-actions';
import { UserBadges, UserMemberships } from './user-parts';

export type UserActionKind = 'reset' | 'link' | 'revoke';

/** Account detail: memberships, recent sign-ins (IP masked by the API) and recent account actions. */
export function UserDetailSheet({
  userId,
  onClose,
  canChange,
  selfId,
  onAction,
}: {
  userId: string | null;
  onClose: () => void;
  canChange: boolean;
  selfId: string | undefined;
  onAction: (kind: UserActionKind, user: UserDetail) => void;
}) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const locale = useIntlLocale();
  const detail = useUser(userId);

  return (
    <Sheet open={userId !== null} onOpenChange={(o) => (o ? undefined : onClose())}>
      <SheetContent closeLabel={tc('close')} className="overflow-y-auto p-4 sm:max-w-lg">
        <SheetHeader className="p-0">
          <SheetTitle>{detail.data?.name ?? t('detail.title')}</SheetTitle>
          <SheetDescription>{t('detail.description')}</SheetDescription>
        </SheetHeader>
        <QueryState query={detail}>
          {(u: UserDetail) => {
            const self = u.id === selfId;
            return (
              <div className="grid gap-5">
                <section className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-all text-sm">{u.email ?? '–'}</span>
                    {u.email ? (
                      <CopyButton
                        value={u.email}
                        label={t('copyEmail')}
                        copiedLabel={t('copied')}
                        size="icon-sm"
                        variant="ghost"
                      />
                    ) : null}
                  </div>
                  <UserBadges u={u} />
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">{t('detail.createdAt')}</dt>
                      <dd>{formatDateTime(u.createdAt, locale)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{t('col.lastSignIn')}</dt>
                      <dd>{u.lastSignInAt ? formatDateTime(u.lastSignInAt, locale) : t('never')}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{t('detail.sessions')}</dt>
                      <dd>{t('sessions', { count: u.activeSessions })}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{t('detail.emailVerified')}</dt>
                      <dd>{u.emailVerified ? t('yes') : t('no')}</dd>
                    </div>
                  </dl>
                </section>

                {canChange ? (
                  <section className="grid gap-2">
                    {self ? <p className="text-xs text-muted-foreground">{t('detail.selfHint')}</p> : null}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={self} onClick={() => onAction('reset', u)}>
                        <KeyRound /> {t('action.reset')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onAction('link', u)}>
                        <Link2 /> {t('action.link')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={self}
                        onClick={() => onAction('revoke', u)}
                      >
                        <LogOut /> {t('action.revoke')}
                      </Button>
                    </div>
                  </section>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('detail.ownerOnly')}</p>
                )}

                <section className="grid gap-2">
                  <h3 className="text-sm font-semibold">{t('detail.memberships')}</h3>
                  <UserMemberships u={u} />
                </section>

                <section className="grid gap-2">
                  <h3 className="text-sm font-semibold">{t('detail.recentSignIns')}</h3>
                  {u.recentSignIns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('detail.noSignIns')}</p>
                  ) : (
                    <ul className="grid gap-2">
                      {u.recentSignIns.map((s) => (
                        <li key={`${s.at}-${s.ipMasked ?? ''}`} className="rounded-md border p-2 text-sm">
                          <div className="font-medium">{formatDateTime(s.at, locale)}</div>
                          <div className="text-xs text-muted-foreground">
                            {[s.ipMasked, describeUserAgent(s.userAgent)].filter(Boolean).join(' · ') || '–'}
                          </div>
                          {new Date(s.expiresAt) < new Date() ? (
                            <Badge variant="secondary" className="mt-1">
                              {t('detail.expired')}
                            </Badge>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="grid gap-2">
                  <h3 className="text-sm font-semibold">{t('detail.recentActions')}</h3>
                  {u.recentActions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('detail.noActions')}</p>
                  ) : (
                    <ul className="grid gap-2">
                      {u.recentActions.map((a) => (
                        <li key={`${a.at}-${a.action}`} className="rounded-md border p-2 text-sm">
                          <div className="font-medium">{t(`detail.actionName.${a.action}`)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(a.at, locale)} · {a.actorName ?? '–'}
                          </div>
                          {a.reason ? <div className="mt-1 text-xs">{a.reason}</div> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            );
          }}
        </QueryState>
      </SheetContent>
    </Sheet>
  );
}
