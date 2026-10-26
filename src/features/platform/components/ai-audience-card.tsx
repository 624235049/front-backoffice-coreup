import { Search, UserMinus, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { QueryState } from '@/components/query-state';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { type AiChatAdmin, useAiFollowersAdmin, usePatchAiChatAdmin } from '../ai-chat-api';

const MAX_TESTERS = 10;
const MODES = ['off', 'testers', 'everyone'] as const;

/** Who the AI answers: nobody (default), only the chosen testers, or every customer. Never off → everyone in one step. */
export function AiAudienceCard({ id, settings }: { id: string; settings: AiChatAdmin }) {
  const { t } = useTranslation('platform');
  const patch = usePatchAiChatAdmin(id);
  const [confirmAll, setConfirmAll] = useState(false);
  const names = settings.testers.map((x) => x.label).join(', ');

  return (
    <Card data-testid="ai-audience">
      <CardHeader>
        <CardTitle className="text-base">{t('aiChat.audience.title')}</CardTitle>
        <CardDescription>{t('aiChat.audience.hint')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p
          className={cn(
            'rounded-lg border p-3 text-sm font-medium',
            settings.mode === 'everyone' && 'border-success/40 bg-success/10',
            settings.mode === 'testers' && 'border-warning/40 bg-warning/10',
          )}
          data-testid="ai-audience-now"
        >
          {settings.mode === 'off'
            ? t('aiChat.audience.nowOff')
            : settings.mode === 'everyone'
              ? t('aiChat.audience.nowEveryone')
              : names
                ? t('aiChat.audience.nowTesters', { names })
                : t('aiChat.audience.nowNobody')}
        </p>

        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('aiChat.audience.title')}>
          {MODES.map((m) => {
            const blocked = m === 'everyone' && settings.mode === 'off';
            return (
              <Button
                key={m}
                type="button"
                role="radio"
                aria-checked={settings.mode === m}
                variant={settings.mode === m ? 'default' : 'outline'}
                className="h-auto min-h-11 flex-col items-start gap-0.5 whitespace-normal py-2 text-left"
                disabled={patch.isPending || blocked}
                onClick={() => {
                  if (m === settings.mode) return;
                  if (m === 'everyone') return setConfirmAll(true);
                  patch.mutate(
                    { mode: m },
                    { onSuccess: () => toast.success(t(`aiChat.audience.set.${m}`)) },
                  );
                }}
              >
                <span className="font-semibold">{t(`aiChat.audience.modes.${m}.name`)}</span>
                <span className="text-xs font-normal opacity-80">{t(`aiChat.audience.modes.${m}.hint`)}</span>
              </Button>
            );
          })}
        </div>
        {settings.mode === 'off' ? (
          <p className="text-xs text-muted-foreground">{t('aiChat.audience.testFirst')}</p>
        ) : null}

        {settings.mode !== 'everyone' ? <Testers id={id} settings={settings} /> : null}
      </CardContent>

      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title={t('aiChat.audience.confirmTitle')}
        description={t('aiChat.audience.confirmBody')}
        confirmLabel={t('aiChat.audience.confirmYes')}
        pending={patch.isPending}
        onConfirm={() =>
          patch.mutate(
            { mode: 'everyone' },
            {
              onSuccess: () => {
                toast.success(t('aiChat.audience.set.everyone'));
                setConfirmAll(false);
              },
            },
          )
        }
      />
    </Card>
  );
}

/** Testers: the people the AI answers in test mode, picked from the shop's LINE followers (name + picture, searchable). */
function Testers({ id, settings }: { id: string; settings: AiChatAdmin }) {
  const { t } = useTranslation('platform');
  const patch = usePatchAiChatAdmin(id);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  const followers = useAiFollowersAdmin(id, debounced);
  const chosen = new Set(settings.testers.map((x) => x.lineUserId));
  const save = (testers: AiChatAdmin['testers']) => patch.mutate({ testers });

  return (
    <div className="grid gap-3" data-testid="ai-testers">
      <div className="text-sm font-medium">
        {t('aiChat.audience.testersTitle', { n: settings.testers.length, max: MAX_TESTERS })}
      </div>
      {settings.testers.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {settings.testers.map((x) => (
            <li key={x.lineUserId}>
              <Badge variant="secondary" className="h-9 gap-1.5 pl-3 pr-1 text-sm">
                {x.label}
                <button
                  type="button"
                  className="grid size-7 place-items-center rounded-full hover:bg-background/60"
                  aria-label={t('aiChat.audience.remove', { name: x.label })}
                  disabled={patch.isPending}
                  onClick={() => save(settings.testers.filter((y) => y.lineUserId !== x.lineUserId))}
                >
                  <UserMinus className="size-4" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('aiChat.audience.search')}
          aria-label={t('aiChat.audience.search')}
          className="h-11 pl-9"
        />
      </div>
      <QueryState
        query={followers}
        isEmpty={(d) => d.length === 0}
        skeleton={<Skeleton className="h-16 w-full" />}
        empty={
          <p className="text-sm text-muted-foreground">
            {t(debounced ? 'aiChat.audience.noMatch' : 'aiChat.audience.noFollowers')}
          </p>
        }
      >
        {(list) => (
          <ul className="grid gap-1.5" data-testid="ai-followers">
            {list.map((f) => {
              const on = chosen.has(f.lineUserId);
              const name = f.name ?? t('aiChat.audience.unnamed');
              return (
                <li key={f.lineUserId} className="flex items-center gap-3 rounded-lg border p-2">
                  <Avatar className="size-9">
                    {f.pictureUrl ? <AvatarImage src={f.pictureUrl} alt="" /> : null}
                    <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={on ? 'secondary' : 'outline'}
                    className="h-9 shrink-0"
                    disabled={patch.isPending || (!on && settings.testers.length >= MAX_TESTERS)}
                    onClick={() =>
                      save(
                        on
                          ? settings.testers.filter((y) => y.lineUserId !== f.lineUserId)
                          : [...settings.testers, { lineUserId: f.lineUserId, label: name.slice(0, 60) }],
                      )
                    }
                  >
                    {on ? (
                      t('aiChat.audience.picked')
                    ) : (
                      <>
                        <UserPlus aria-hidden /> {t('aiChat.audience.pick')}
                      </>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>
      <p className="text-xs text-muted-foreground">{t('aiChat.audience.followersHint')}</p>
    </div>
  );
}
