import { Search, UserMinus, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { type SalesConfig, type SalesConfigView, useSalesContacts, useSaveSalesConfig } from '../sales-api';

export type SalesMode = 'off' | 'testers' | 'everyone';
const MODES: { mode: SalesMode; name: string; hint: string }[] = [
  { mode: 'off', name: 'ปิด', hint: 'AI ไม่ตอบใครเลย' },
  { mode: 'testers', name: 'ทดสอบ', hint: 'ตอบเฉพาะคนที่เลือก' },
  { mode: 'everyone', name: 'ทุกคน', hint: 'ตอบทุกคนที่ทักมา' },
];
const PROVIDER: Record<string, string> = {
  line: 'LINE',
  messenger: 'Facebook Messenger',
  instagram: 'Instagram',
};
const MAX_TESTERS = 30;

/** The mode of one account in the saved config (not listed = off). */
export const modeOf = (c: SalesConfig, accountId: string): SalesMode =>
  c.channels.find((x) => x.channelAccountId === accountId)?.mode ?? 'off';

/** The config with one account switched; every other account keeps its mode. */
export function withMode(
  c: SalesConfig,
  accountIds: string[],
  accountId: string,
  mode: SalesMode,
): SalesConfig {
  const ids = [...new Set([...accountIds, ...c.channels.map((x) => x.channelAccountId)])];
  return {
    ...c,
    channels: ids.map((id) => ({ channelAccountId: id, mode: id === accountId ? mode : modeOf(c, id) })),
  };
}

/** "หยุด AI ทั้งหมด": every account off, testers kept for later. */
export const allOff = (c: SalesConfig, accountIds: string[]): SalesConfig => ({
  ...c,
  channels: [...new Set([...accountIds, ...c.channels.map((x) => x.channelAccountId)])].map((id) => ({
    channelAccountId: id,
    mode: 'off' as const,
  })),
});

/**
 * Always-visible switch of the AI per connected account of CoreUp (same pattern as the shop's ai-audience-card): ปิด / ทดสอบ /
 * ทุกคน, saved the moment it is pressed, a confirm before ทุกคน, and one big stop-all. LINE stays human by the owner's policy.
 */
export function SalesControlBar({ view }: { view: SalesConfigView }) {
  const save = useSaveSalesConfig();
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);
  const ids = view.accounts.map((a) => a.id);
  const c = view.config;
  const anyOn = view.accounts.some((a) => modeOf(c, a.id) !== 'off');
  const set = (next: SalesConfig, done: string) =>
    save.mutate(next, { onSuccess: () => toast.success(done) });

  return (
    <Card data-testid="sales-control-bar">
      <CardContent className="grid gap-3 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold">เปิด/ปิด AI ตามช่องทาง (บันทึกทันที)</div>
          <Button
            variant="destructive"
            disabled={!anyOn || save.isPending}
            onClick={() => set(allOff(c, ids), 'หยุด AI ทั้งหมดแล้ว')}
            data-testid="sales-stop-all"
          >
            หยุด AI ทั้งหมด
          </Button>
        </div>
        {view.accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            ยังไม่มีช่องทางของ CoreUp ที่เชื่อมไว้ (เพจ Facebook / Instagram / LINE)
          </p>
        ) : null}
        {view.accounts.map((a) => {
          const mode = modeOf(c, a.id);
          const isLine = a.provider === 'line';
          return (
            <div
              key={a.id}
              className="grid gap-2 rounded-lg border p-3"
              data-testid={`sales-channel-${a.id}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{a.name}</span>
                <Badge variant="secondary">{PROVIDER[a.provider] ?? a.provider}</Badge>
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-xs font-medium',
                    mode === 'everyone' && 'bg-success/10 text-success',
                    mode === 'testers' && 'bg-warning/10 text-warning',
                  )}
                >
                  {mode === 'off' ? 'ปิดอยู่' : mode === 'testers' ? 'ทดสอบ' : 'เปิดให้ทุกคน'}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={a.name}>
                {MODES.map((m) => {
                  // owner policy: CoreUp's LINE stays with people
                  const blocked = isLine && m.mode !== 'off';
                  return (
                    <Button
                      key={m.mode}
                      type="button"
                      role="radio"
                      aria-checked={mode === m.mode}
                      variant={mode === m.mode ? 'default' : 'outline'}
                      className="h-auto min-h-11 flex-col items-start gap-0.5 whitespace-normal py-2 text-left"
                      disabled={save.isPending || blocked}
                      onClick={() => {
                        if (m.mode === mode) return;
                        if (m.mode === 'everyone') return setConfirm({ id: a.id, name: a.name });
                        set(withMode(c, ids, a.id, m.mode), `${a.name}: ${m.name}`);
                      }}
                    >
                      <span className="font-semibold">{m.name}</span>
                      <span className="text-xs font-normal opacity-80">
                        {blocked ? 'LINE ให้คนตอบเอง' : m.hint}
                      </span>
                    </Button>
                  );
                })}
              </div>
              {mode === 'testers' ? (
                <Testers
                  accountId={a.id}
                  config={c}
                  onSave={(next) => save.mutate(next)}
                  busy={save.isPending}
                />
              ) : null}
            </div>
          );
        })}
      </CardContent>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="เปิด AI ให้ตอบทุกคน?"
        description={`${confirm?.name ?? ''}: AI จะตอบทุกคนที่ทักมาทันที ควรลองกับผู้ทดสอบก่อน กดหยุด AI ทั้งหมดได้ทุกเมื่อ`}
        confirmLabel="เปิดให้ทุกคน"
        pending={save.isPending}
        onConfirm={() => {
          if (!confirm) return;
          set(withMode(c, ids, confirm.id, 'everyone'), `${confirm.name}: เปิดให้ทุกคน`);
          setConfirm(null);
        }}
      />
    </Card>
  );
}

/** The people the AI answers in test mode, picked from those who wrote to that account (name, searchable). */
function Testers({
  accountId,
  config,
  onSave,
  busy,
}: {
  accountId: string;
  config: SalesConfig;
  onSave: (c: SalesConfig) => void;
  busy: boolean;
}) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const contacts = useSalesContacts(accountId, debounced);
  const mine = config.testers.filter((t) => t.channelAccountId === accountId);
  const chosen = new Set(mine.map((t) => t.externalUserId));
  const setTesters = (list: SalesConfig['testers']) =>
    onSave({
      ...config,
      testers: [...config.testers.filter((t) => t.channelAccountId !== accountId), ...list],
    });

  return (
    <div className="grid gap-2" data-testid="sales-testers">
      <div className="text-sm font-medium">
        ผู้ทดสอบ {mine.length}/{MAX_TESTERS}
      </div>
      <ul className="flex flex-wrap gap-2">
        {mine.map((t) => (
          <li key={t.externalUserId}>
            <Badge variant="secondary" className="h-8 gap-1.5 pl-3 pr-1">
              {t.label}
              <button
                type="button"
                aria-label={`เอา ${t.label} ออก`}
                disabled={busy}
                onClick={() => setTesters(mine.filter((x) => x.externalUserId !== t.externalUserId))}
              >
                <UserMinus className="size-4" aria-hidden />
              </button>
            </Badge>
          </li>
        ))}
        {mine.length === 0 ? (
          <li className="text-xs text-muted-foreground">ยังไม่มีผู้ทดสอบ: AI จะไม่ตอบใคร</li>
        ) : null}
      </ul>
      <div className="relative">
        <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" aria-hidden />
        <Input
          className="pl-8"
          placeholder="ค้นชื่อคนที่เคยทักมา"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <ul className="grid max-h-48 gap-1 overflow-y-auto">
        {(contacts.data ?? []).map((p) => (
          <li
            key={p.externalUserId}
            className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-sm"
          >
            <span>{p.label}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || chosen.has(p.externalUserId) || mine.length >= MAX_TESTERS}
              onClick={() =>
                setTesters([
                  ...mine,
                  { channelAccountId: accountId, externalUserId: p.externalUserId, label: p.label },
                ])
              }
            >
              <UserPlus className="size-4" aria-hidden /> {chosen.has(p.externalUserId) ? 'เลือกแล้ว' : 'เพิ่ม'}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
