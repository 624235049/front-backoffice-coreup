import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { type Addons, useAddons, useSaveAddons } from '../api';
import { formatMoney, useIntlLocale } from '../format';
import { MoneyField } from './marketing-section';

type Settings = Addons['settings'];
type Text = Settings['aiChat']['th'];

/** Name + one line of copy in both languages (numbers are shown from the fields beside, never typed in the copy). */
function TextPair({
  id,
  value,
  onChange,
}: {
  id: string;
  value: { th: Text; en: Text };
  onChange: (next: { th: Text; en: Text }) => void;
}) {
  const { t } = useTranslation('platform');
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(['th', 'en'] as const).map((l) => (
        <div key={l} className="grid gap-2">
          <div>
            <Label htmlFor={`${id}-${l}-name`}>{t(`plans.addons.name.${l}`)}</Label>
            <Input
              id={`${id}-${l}-name`}
              value={value[l].name}
              maxLength={80}
              onChange={(e) => onChange({ ...value, [l]: { ...value[l], name: e.target.value } })}
            />
          </div>
          <div>
            <Label htmlFor={`${id}-${l}-text`}>{t(`plans.addons.text.${l}`)}</Label>
            <Input
              id={`${id}-${l}-text`}
              value={value[l].text}
              maxLength={300}
              onChange={(e) => onChange({ ...value, [l]: { ...value[l], text: e.target.value } })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Whole number typed by a person; committed once it is digits only. */
function CountField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        value={text}
        aria-invalid={!/^\d+$/.test(text) || Number(text) < 1}
        onChange={(e) => {
          setText(e.target.value);
          if (/^\d+$/.test(e.target.value) && Number(e.target.value) >= 1) onChange(Number(e.target.value));
        }}
      />
    </div>
  );
}

function AddonsDialog({ initial, onClose }: { initial: Settings; onClose: () => void }) {
  const { t } = useTranslation('platform');
  const save = useSaveAddons();
  const [s, setS] = useState<Settings>(structuredClone(initial));
  const blocked = (['aiChat', 'setupService', 'migration'] as const).some((k) =>
    (['th', 'en'] as const).some((l) => s[k][l].name.trim().length === 0),
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('plans.addons.editTitle')}</DialogTitle>
          <DialogDescription>{t('plans.addons.editHint')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6">
          <section className="grid gap-3" data-testid="addon-ai">
            <h3 className="text-sm font-semibold">{t('plans.addons.aiChat')}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyField
                id="ad-ai-month"
                label={t('plans.addons.field.monthly')}
                hint=""
                minor={s.aiChat.monthlyMinor}
                onChange={(m) => setS({ ...s, aiChat: { ...s.aiChat, monthlyMinor: m } })}
              />
              <CountField
                id="ad-ai-incl"
                label={t('plans.addons.field.included')}
                value={s.aiChat.includedMessages}
                onChange={(n) => setS({ ...s, aiChat: { ...s.aiChat, includedMessages: n } })}
              />
              <MoneyField
                id="ad-ai-topup"
                label={t('plans.addons.field.topup')}
                hint=""
                minor={s.aiChat.topupMinor}
                onChange={(m) => setS({ ...s, aiChat: { ...s.aiChat, topupMinor: m } })}
              />
              <CountField
                id="ad-ai-topup-n"
                label={t('plans.addons.field.topupMessages')}
                value={s.aiChat.topupMessages}
                onChange={(n) => setS({ ...s, aiChat: { ...s.aiChat, topupMessages: n } })}
              />
              <MoneyField
                id="ad-ai-setup"
                label={t('plans.addons.field.setup')}
                hint={t('plans.addons.hint.setupYearly')}
                minor={s.aiChat.setupMinor}
                onChange={(m) => setS({ ...s, aiChat: { ...s.aiChat, setupMinor: m } })}
              />
            </div>
            <TextPair
              id="ad-ai"
              value={s.aiChat}
              onChange={(v) => setS({ ...s, aiChat: { ...s.aiChat, ...v } })}
            />
          </section>
          <section className="grid gap-3">
            <h3 className="text-sm font-semibold">{t('plans.addons.setupService')}</h3>
            <MoneyField
              id="ad-setup"
              label={t('plans.addons.field.price')}
              hint=""
              minor={s.setupService.priceMinor}
              onChange={(m) => setS({ ...s, setupService: { ...s.setupService, priceMinor: m } })}
            />
            <TextPair
              id="ad-setup"
              value={s.setupService}
              onChange={(v) => setS({ ...s, setupService: { ...s.setupService, ...v } })}
            />
          </section>
          <section className="grid gap-3">
            <h3 className="text-sm font-semibold">{t('plans.addons.migration')}</h3>
            <MoneyField
              id="ad-mig"
              label={t('plans.addons.field.from')}
              hint=""
              minor={s.migration.fromMinor}
              onChange={(m) => setS({ ...s, migration: { ...s.migration, fromMinor: m } })}
            />
            <TextPair
              id="ad-mig"
              value={s.migration}
              onChange={(v) => setS({ ...s, migration: { ...s.migration, ...v } })}
            />
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={save.isPending}
            blockedReason={blocked ? t('plans.addons.err.name') : false}
            onClick={() =>
              save.mutate(s, {
                onSuccess: () => {
                  toast.success(t('plans.addons.saved'));
                  onClose();
                },
              })
            }
          >
            {t('plans.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Add-ons shown on the website under the plans ("บริการเสริม"): prices and copy edited here, AI prices are what invoices charge. */
export function AddonsCard() {
  const { t, i18n } = useTranslation('platform');
  const locale = useIntlLocale();
  const addons = useAddons();
  const [editing, setEditing] = useState(false);
  const lang = i18n.language === 'en' ? 'en' : 'th';
  return (
    <Card data-testid="addons-card">
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">{t('plans.addons.title')}</h2>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil /> {t('plans.edit')}
          </Button>
        </div>
        <QueryState query={addons}>
          {({ settings }) => (
            <>
              <ul className="grid gap-2 text-sm">
                <li>
                  <span className="font-medium">{settings.aiChat[lang].name}</span>{' '}
                  {t('plans.addons.aiLine', {
                    monthly: formatMoney(settings.aiChat.monthlyMinor, locale),
                    included: settings.aiChat.includedMessages.toLocaleString(locale),
                    topup: formatMoney(settings.aiChat.topupMinor, locale),
                    topupMessages: settings.aiChat.topupMessages.toLocaleString(locale),
                    setup: formatMoney(settings.aiChat.setupMinor, locale),
                  })}
                </li>
                <li>
                  <span className="font-medium">{settings.setupService[lang].name}</span>{' '}
                  {formatMoney(settings.setupService.priceMinor, locale)}
                </li>
                <li>
                  <span className="font-medium">{settings.migration[lang].name}</span>{' '}
                  {t('plans.addons.from', { price: formatMoney(settings.migration.fromMinor, locale) })}
                </li>
              </ul>
              {editing ? <AddonsDialog initial={settings} onClose={() => setEditing(false)} /> : null}
            </>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
