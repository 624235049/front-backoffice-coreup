import { createFileRoute } from '@tanstack/react-router';
import { A4Page } from '@/features/accounting/pages/a4-page';

export const Route = createFileRoute('/_app/accounting/a4/$id')({ component: DocumentA4 });

function DocumentA4() {
  const { id } = Route.useParams();
  return <A4Page source={{ kind: 'document', id }} />;
}
