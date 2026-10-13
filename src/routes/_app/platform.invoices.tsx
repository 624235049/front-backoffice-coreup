import { createFileRoute } from '@tanstack/react-router';
import { InvoicesPage } from '@/features/platform/pages/invoices-page';

export const Route = createFileRoute('/_app/platform/invoices')({ component: InvoicesPage });
