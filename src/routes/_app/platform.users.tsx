import { createFileRoute } from '@tanstack/react-router';
import { UsersPage } from '@/features/platform/pages/users-page';

export const Route = createFileRoute('/_app/platform/users')({ component: UsersPage });
