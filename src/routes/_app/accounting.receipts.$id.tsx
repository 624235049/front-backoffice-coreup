import { createFileRoute } from '@tanstack/react-router';
import { DocumentPage } from '@/features/accounting/pages/document-page';

export const Route = createFileRoute('/_app/accounting/receipts/$id')({
  component: DetailRoute,
});

function DetailRoute() {
  const { id } = Route.useParams();
  return <DocumentPage kind="receipt" id={id} />;
}
