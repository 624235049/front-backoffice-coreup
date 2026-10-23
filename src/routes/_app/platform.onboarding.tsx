import { createFileRoute } from '@tanstack/react-router';
import { OnboardingPage } from '@/features/platform/pages/onboarding-page';

export const Route = createFileRoute('/_app/platform/onboarding')({ component: OnboardingPage });
