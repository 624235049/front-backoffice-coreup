import { createFileRoute } from '@tanstack/react-router';
import { PageInboxPage } from '@/features/page-inbox/pages/page-inbox-page';

export const Route = createFileRoute('/_app/platform/page-inbox')({
  validateSearch: (s: Record<string, unknown>): { c?: string } => ({
    c: typeof s.c === 'string' && s.c ? s.c : undefined,
  }),
  component: PageInboxPage,
});
