import { ReactNode } from "react";
import { useLocation } from "react-router";
import { ErrorState } from "@/components/common";
import { useCurrentUser } from "@/components/providers/user-provider";
import { canAccessRoute } from "@/lib/routes.config";

// Every signed-in page passes through here (AppLayout), so a route's roles are
// set once, in lib/routes.config.ts, and never checked inside a container.
// This decides only what renders; the API enforces access on every endpoint.
export default function RouteGuard({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const user = useCurrentUser();

  if (!canAccessRoute(pathname, user.role)) {
    return (
      <ErrorState
        title="No access"
        message="Your role can't open this page. Ask an Admin if you need it."
      />
    );
  }

  return children;
}
