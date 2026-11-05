import { Spinner } from "@heroui/react";
import { Suspense, useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { CarouselLayout } from "@/components/layouts";
import { useUser } from "@/components/providers/user-provider";
import { HOME_PATH, isSignOutState, LOGIN_PATH } from "@/lib/constants";

// Sign-in, forgot-password and reset-password. Someone already signed in who
// opens /login/ goes straight to the dashboard — unless they came here to
// sign out (SIGN_OUT_STATE): the session ends here, after the page they left
// had its chance to ask about unsaved edits.
export default function PublicLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useUser();
  const signingOut = isSignOutState(location.state);
  const started = useRef(false);

  useEffect(() => {
    if (!signingOut || started.current) return;
    started.current = true;
    void signOut().then(() => {
      started.current = false;
      // Drops the state, so Back or a reload doesn't sign out again.
      navigate(LOGIN_PATH, { replace: true, state: null });
    });
  }, [signingOut, signOut, navigate]);

  if (signingOut && user) {
    return (
      <div className="h-dvh flex items-center justify-center">
        <Spinner label="Signing out…" />
      </div>
    );
  }

  if (user && location.pathname === LOGIN_PATH) {
    return <Navigate to={HOME_PATH} replace />;
  }

  return (
    <div className="p-4 sm:p-8 h-dvh">
      <CarouselLayout>
        {/* The forms are lazy (routes.tsx); the carousel shows while they load. */}
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <Spinner label="Loading" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </CarouselLayout>
    </div>
  );
}
