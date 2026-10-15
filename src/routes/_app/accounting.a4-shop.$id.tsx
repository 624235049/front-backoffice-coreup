import { createFileRoute } from '@tanstack/react-router';
import { A4Page } from '@/features/accounting/pages/a4-page';

export const Route = createFileRoute('/_app/accounting/a4-shop/$id')({ component: ShopInvoiceA4 });

function ShopInvoiceA4() {
  const { id } = Route.useParams();
  return <A4Page source={{ kind: 'shop-accounting', id }} />;
}
