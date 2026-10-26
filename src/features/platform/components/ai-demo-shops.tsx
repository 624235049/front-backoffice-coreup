import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type AiChatAdmin, usePatchAiChatAdmin } from '../ai-chat-api';
import { useTenants } from '../api';

type Shops = AiChatAdmin['demoShops'];
const toBody = (list: Shops) => list.map((s) => ({ tenantId: s.tenantId, label: s.label }));

/**
 * The CoreUp LINE OA plays these demo shops to prospects: one quick-reply button per shop (the label, ≤ 20 characters).
 * Changes save at once. Only the CoreUp tenant's own card has this.
 */
export function AiDemoShops({ id, shops }: { id: string; shops: Shops }) {
  const { t } = useTranslation('platform');
  const patch = usePatchAiChatAdmin(id);
  const [q, setQ] = useState('');
  const found = useTenants({ q: q.trim() });
  // the newest list we sent: two label edits in a row (blur, blur) must both be kept, so the 2nd builds on the 1st, not on the stale prop
  const latest = useRef(shops);
  useEffect(() => {
    if (!patch.isPending) latest.current = shops;
  }, [shops, patch.isPending]);
  const save = (list: Shops, done?: string) => {
    latest.current = list;
    patch.mutate({ demoShops: toBody(list) }, { onSuccess: () => done && toast.success(done) });
  };

  return (
    <section className="grid gap-3 rounded-lg border p-3" data-testid="ai-demo-shops">
      <div>
        <h3 className="text-sm font-semibold">{t('aiChat.demo.title')}</h3>
        <p className="text-xs text-muted-foreground">{t('aiChat.demo.hint')}</p>
      </div>
      {shops.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('aiChat.demo.none')}</p>
      ) : (
        <ul className="grid gap-2">
          {shops.map((s) => (
            <li key={s.tenantId} className="flex flex-wrap items-center gap-2">
              <Input
                defaultValue={s.label}
                maxLength={20}
                className="w-48"
                aria-label={t('aiChat.demo.label')}
                onBlur={(e) => {
                  const label = e.target.value.trim();
                  if (label && label !== s.label)
                    save(
                      latest.current.map((x) => (x.tenantId === s.tenantId ? { ...x, label } : x)),
                      t('aiChat.saved'),
                    );
                }}
              />
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {s.name ?? s.tenantId}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('aiChat.demo.remove')}
                disabled={patch.isPending}
                onClick={() => save(latest.current.filter((x) => x.tenantId !== s.tenantId))}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('aiChat.demo.search')}
        aria-label={t('aiChat.demo.search')}
        className="max-w-sm"
      />
      {q.trim() ? (
        <ul className="grid gap-1">
          {(found.data ?? [])
            .filter((r) => !shops.some((s) => s.tenantId === r.id))
            .slice(0, 8)
            .map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {r.name} <span className="text-xs text-muted-foreground">{r.slug}</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={patch.isPending || shops.length >= 8}
                  onClick={() => {
                    save(
                      [...latest.current, { tenantId: r.id, label: r.name.slice(0, 20), name: r.name }],
                      t('aiChat.demo.added'),
                    );
                    setQ('');
                  }}
                >
                  <Plus aria-hidden /> {t('aiChat.demo.add')}
                </Button>
              </li>
            ))}
        </ul>
      ) : null}
    </section>
  );
}
