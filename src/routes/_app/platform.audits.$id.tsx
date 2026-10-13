import { createFileRoute } from '@tanstack/react-router';
import { AuditDetailPage } from '@/features/platform/pages/audit-detail-page';

export const Route = createFileRoute('/_app/platform/audits/$id')({ component: AuditDetailPage });
