import { createFileRoute } from '@tanstack/react-router';
import { SecurityPage } from '@/features/security/pages/security-page';

export const Route = createFileRoute('/_app/account/security')({ component: SecurityPage });
