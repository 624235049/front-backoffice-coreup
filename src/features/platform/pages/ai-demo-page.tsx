import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/page-header';
import { useTenantId } from '@/lib/membership';
import { AiChatCard } from '../components/ai-chat-card';

/** CoreUp's own LINE OA as a public demo bot: which sample shops it plays, who may talk to it (testers → everyone), cost. */
export function AiDemoPage() {
  const { t } = useTranslation('platform');
  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <PageHeader title={t('aiChat.demo.pageTitle')} description={t('aiChat.demo.pageHint')} />
      <AiChatCard id={useTenantId()} demo />
    </div>
  );
}
