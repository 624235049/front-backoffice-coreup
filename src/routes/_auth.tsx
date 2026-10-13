import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Logo } from '@/components/logo';

/** Layout for pages that do not need a session: sign-in, invite, password reset. */
export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-ivory px-4 py-10">
      <h1>
        <Logo variant="full" />
      </h1>
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
