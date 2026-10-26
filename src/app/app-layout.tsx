import { Spinner } from "@heroui/react";
import { Navigate, Outlet, useLocation } from "react-router";
import { ErrorBoundary, ErrorState } from "@/components/common";
import { DashboardLayout } from "@/components/layouts";
import { useUser } from "@/components/providers/user-provider";
import { LOGIN_PATH } from "@/lib/constants";
import RouteGuard from "./route-guard";

// Signed-in pages render only once GET /auth/me (UserProvider) has returned a
// user; signed out, they go to /login/, which comes back here after sign-in.
// This decides only what renders; the API checks the session on every call.
//
// The error boundary sits inside the layout, so a page that throws keeps the
// sidebar and header usable, and clears when another page is opened.
export default function AppLayout() {
  const { pathname, search } = useLocation();
  const { user, loadError, retry } = useUser();

  if (user === undefined) {
    // A failed /auth/me is not "signed out": the server may simply be
    // unreachable, so offer a retry rather than the login page.
    if (loadError) {
      return (
        <div className="h-dvh">
          <ErrorState
            message="We couldn't check your sign-in. Check your connection and try again."
            onAction={retry}
          />
        </div>
      );
    }
    return (
      <div className="h-dvh flex items-center justify-center">
        <Spinner label="Loading" />
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate to={LOGIN_PATH} replace state={{ from: pathname + search }} />
    );
  }

  return (
    <DashboardLayout>
      <ErrorBoundary resetKey={pathname}>
        <RouteGuard>
          <Outlet />
        </RouteGuard>
      </ErrorBoundary>
    </DashboardLayout>
  );
}
