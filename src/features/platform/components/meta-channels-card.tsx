import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { QueryState } from '@/components/query-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useCan } from '@/lib/permissions';
import { useMetaChannelsSwitch, usePatchMetaChannelsSwitch } from '../meta-channels-api';

/** Tenant detail › "เชื่อม Facebook/IG": the per-shop switch. Off = the shop sees the guide and "เร็ว ๆ นี้". */
export function MetaChannelsCard({ id }: { id: string }) {
  const { t } = useTranslation('platform');
  const canWrite = useCan('platform:write');
  const q = useMetaChannelsSwitch(id);
  const patch = usePatchMetaChannelsSwitch(id);
  return (
    <Card data-testid="meta-channels-card">
      <CardHeader>
        <CardTitle className="text-base">{t('metaChannels.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('metaChannels.hint')}</p>
      </CardHeader>
      <CardContent>
        <QueryState query={q}>
          {(d) => (
            <label htmlFor="meta-channels-active" className="flex min-h-11 items-start gap-2 text-sm">
              <Checkbox
                id="meta-channels-active"
                className="mt-0.5"
                checked={d.active}
                disabled={!canWrite || patch.isPending}
                onCheckedChange={(on) =>
                  patch.mutate(on === true, {
                    onSuccess: () =>
                      toast.success(
                        t(on === true ? 'metaChannels.enabledToast' : 'metaChannels.disabledToast'),
                      ),
                  })
                }
              />
              <span className="font-medium">{t('metaChannels.active')}</span>
            </label>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
