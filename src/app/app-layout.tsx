import { Navigate, Outlet, useLocation } from "react-router";
import { ErrorBoundary } from "@/components/common";
import { DashboardLayout } from "@/components/layouts";
import { useUser } from "@/components/providers/user-provider";
import { LOGIN_PATH } from "@/lib/constants";
import RouteGuard from "./route-guard";

// Signed-in pages render only with a user in UserProvider; signed out, they
// go to /login/. Today the user is the mock user; when sign-in is wired to
// the Accounts API, load it here with getMe() (services/auth.ts) and redirect
// on a 401. This decides only what renders; the API checks the session.
//
// The error boundary sits inside the layout, so a page that throws keeps the
// sidebar and header usable, and clears when another page is opened.
export default function AppLayout() {
  const { pathname } = useLocation();
  const { user } = useUser();

  if (!user) return <Navigate to={LOGIN_PATH} replace />;

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
