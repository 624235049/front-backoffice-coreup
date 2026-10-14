import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/features/accounting/lib/url-search';
import { ProductsPage } from '@/features/accounting/pages/products-page';

export const Route = createFileRoute('/_app/accounting/products')({
  validateSearch: (s) => listSearchSchema.parse(s),
  component: ProductsPage,
});
