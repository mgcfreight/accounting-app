import { BrowserRouter } from "react-router";
import { ErrorBoundary, ErrorState } from "@/components/common";
import Providers from "./providers";
import AppRoutes from "./routes";

// The route table is in routes.tsx.
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

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary fallback={appCrashed}>
        <Providers>
          <AppRoutes />
        </Providers>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
