import { createFileRoute } from '@tanstack/react-router';
import { A4Page } from '@/features/accounting/pages/a4-page';

export const Route = createFileRoute('/_app/platform/a4/$id')({ component: PlatformInvoiceA4 });

function PlatformInvoiceA4() {
  const { id } = Route.useParams();
  return <A4Page source={{ kind: 'shop-platform', id }} />;
}
