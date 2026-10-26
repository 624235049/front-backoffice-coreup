import { createFileRoute } from '@tanstack/react-router';
import { AiDemoPage } from '@/features/platform/pages/ai-demo-page';

export const Route = createFileRoute('/_app/platform/ai-demo')({ component: AiDemoPage });
