import { Navigate, Outlet, useLocation } from "react-router";
import { CarouselLayout } from "@/components/layouts";
import { useUser } from "@/components/providers/user-provider";
import { HOME_PATH, LOGIN_PATH } from "@/lib/constants";

// Sign-in, forgot-password and reset-password. Someone already signed in who
// opens /login/ goes straight to the dashboard.
export default function PublicLayout() {
  const { pathname } = useLocation();
  const { user } = useUser();

  if (user && pathname === LOGIN_PATH) {
    return <Navigate to={HOME_PATH} replace />;
  }

  return (
    <div className="p-4 sm:p-8 h-dvh">
      <CarouselLayout>
        <Outlet />
      </CarouselLayout>
    </div>
  );
}
