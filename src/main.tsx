import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from '@/components/ui/sonner';
import { initI18n } from '@/i18n';
import { signInSearch } from '@/lib/home';
import { createQueryClient } from '@/lib/query-client';
import { initSentry, Sentry } from '@/lib/sentry';
import { configureZod } from '@/lib/zod';
import { createAppRouter } from '@/router';
import { useSession } from '@/stores/session';
import './styles.css';

initSentry();
configureZod();

// The query client needs the router (401 -> sign-in) and the router needs the query client: tie the knot lazily.
let router: ReturnType<typeof createAppRouter>;
const queryClient = createQueryClient(() => {
  useSession.getState().reset();
  queryClient.clear();
  void router.navigate({
    to: '/sign-in',
    search: signInSearch(window.location.pathname + window.location.search),
  });
});
router = createAppRouter(queryClient);

async function main() {
  await initI18n();
  const root = document.getElementById('root');
  if (!root) throw new Error('#root not found');
  createRoot(root).render(
    <StrictMode>
      <Sentry.ErrorBoundary fallback={<p className="p-6">Something went wrong. Please reload.</p>}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <Toaster />
        </QueryClientProvider>
      </Sentry.ErrorBoundary>
    </StrictMode>,
  );
}

void main();
