import { createFileRoute } from '@tanstack/react-router';
import { reportSearchSchema } from '@/features/accounting/lib/url-search';
import { OverviewPage } from '@/features/accounting/pages/overview-page';

export const Route = createFileRoute('/_app/accounting/')({
  validateSearch: (s) => reportSearchSchema.parse(s),
  component: OverviewPage,
});
