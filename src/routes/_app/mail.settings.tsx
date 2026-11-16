import { createFileRoute } from '@tanstack/react-router';
import { MailSettingsPage } from '@/features/mail/pages/mail-settings-page';

export const Route = createFileRoute('/_app/mail/settings')({ component: MailSettingsPage });
