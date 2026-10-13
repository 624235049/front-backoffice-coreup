import { createFileRoute } from '@tanstack/react-router';
import { EngagementDetailPage } from '@/features/platform/pages/engagement-detail-page';

export const Route = createFileRoute('/_app/platform/engagements/$id')({ component: EngagementDetailPage });
