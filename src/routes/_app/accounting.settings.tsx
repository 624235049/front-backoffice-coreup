import { createFileRoute } from '@tanstack/react-router';
import { SettingsPage } from '@/features/accounting/pages/settings-page';

export const Route = createFileRoute('/_app/accounting/settings')({ component: SettingsPage });
