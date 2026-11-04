import { createFileRoute } from '@tanstack/react-router';
import { AdsPage } from '@/features/platform/pages/ads-page';

export const Route = createFileRoute('/_app/platform/ads')({ component: AdsPage });
