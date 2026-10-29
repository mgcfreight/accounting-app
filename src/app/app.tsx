import {
  createBrowserRouter,
  createRoutesFromElements,
  Outlet,
  Route,
  RouterProvider,
} from "react-router";
import { ErrorBoundary, ErrorState } from "@/components/common";
import Providers from "./providers";
import appRoutes from "./routes";

// The route table is in routes.tsx. It runs under a data router
// (createBrowserRouter) rather than <BrowserRouter> because useBlocker — the
// unsaved-changes warning — works only there.
//
// The outer boundary is the last resort, for an error outside a page (the
// providers, a layout, the login screen). Pages have their own in AppLayout.
const appCrashed = (
  <div className="h-dvh">
    <ErrorState
      message="The app hit an unexpected error. Reload the page to continue."
      actionText="Reload"
      onAction={() => window.location.reload()}
    />
  </div>
);

// Providers sit inside the router: HeroUI's link navigation uses its hooks.
function Root() {
  return (
    <ErrorBoundary fallback={appCrashed}>
      <Providers>
        <Outlet />
      </Providers>
    </ErrorBoundary>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<Root />} errorElement={appCrashed}>
      {appRoutes}
    </Route>
  )
);

export default function App() {
  return <RouterProvider router={router} />;
}
