import { createFileRoute } from '@tanstack/react-router';
import { OutboxPage } from '@/features/mail/pages/outbox-page';

export const Route = createFileRoute('/_app/mail/')({ component: OutboxPage });
