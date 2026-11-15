import { createFileRoute } from '@tanstack/react-router';
import { ChatCasesPage } from '@/features/platform/pages/chat-cases-page';

export const Route = createFileRoute('/_app/platform/chat-cases')({
  // the owner's emergency push opens `?case=<id>`
  validateSearch: (s: Record<string, unknown>): { case?: string } => ({
    case: typeof s.case === 'string' && s.case ? s.case : undefined,
  }),
  component: ChatCasesPage,
});
