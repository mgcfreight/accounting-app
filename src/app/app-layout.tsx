import { Spinner } from "@heroui/react";
import { Suspense, useState } from "react";
import {
  Navigate,
  Outlet,
  useLocation,
  useNavigationType,
} from "react-router";
import { ErrorBoundary, ErrorState } from "@/components/common";
import { DashboardLayout } from "@/components/layouts";
import { useUser } from "@/components/providers/user-provider";
import { LOGIN_PATH } from "@/lib/constants";
import TmsOverdueBar from "@/containers/payments/tms-overdue-bar";
import RouteGuard from "./route-guard";

// Signed-in pages render only once GET /auth/me (UserProvider) has returned a
// user; signed out, they go to /login/, which comes back here after sign-in.
// This decides only what renders; the API checks the session on every call.
//
// The error boundary sits inside the layout, so a page that throws keeps the
// sidebar and header usable, and clears when another page is opened.
//
// Pages are lazy (routes.tsx): the first one opened shows a spinner in the
// content area while its chunk loads. Router navigations are transitions, so
// moving between pages keeps the current one on screen until the next is
// ready.
//
// The overdue bar runs on lib/mock, so it is development only (`npm run dev`),
// like the invoice pages' demo fallback: a build must never show demo figures
// on every page as if they were real. It comes back here once it reads the API.
const SHOW_TMS_OVERDUE_BAR = import.meta.env.DEV;

export default function AppLayout() {
  const { pathname, search, key } = useLocation();
  const navigationType = useNavigationType();
  const { user, loadError, retry } = useUser();

  // A list reads its filters from the URL once, when it mounts. A link to
  // the same list with no query (its sidebar entry, clicked to start again)
  // would otherwise leave the filters on screen and write them straight back
  // into the URL, so that page mounts afresh instead. Filter changes replace
  // the URL rather than push, and don't count.
  const [shown, setShown] = useState({ key, pathname, search, fresh: 0 });
  if (shown.key !== key) {
    const restart =
      navigationType === "PUSH" &&
      pathname === shown.pathname &&
      !search &&
      !!shown.search;
    setShown({ key, pathname, search, fresh: shown.fresh + (restart ? 1 : 0) });
  }

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
    <DashboardLayout topBar={SHOW_TMS_OVERDUE_BAR ? <TmsOverdueBar /> : undefined}>
      <ErrorBoundary resetKey={pathname}>
        <RouteGuard key={shown.fresh}>
          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <Spinner label="Loading" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </RouteGuard>
      </ErrorBoundary>
    </DashboardLayout>
  );
}
