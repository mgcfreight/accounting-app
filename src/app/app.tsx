import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { ErrorBoundary, ErrorState } from "@/components/common";
import { CarouselLayout } from "@/components/layouts";
import AuditLog from "@/containers/audit-log/audit-log";
import Dashboard from "@/containers/dashboard/dashboard";
import InvoiceDetail from "@/containers/invoices/invoice-detail";
import InvoiceList from "@/containers/invoices/invoice-list";
import LoginForm from "@/containers/login/login-form";
import NeedsReview from "@/containers/needs-review/needs-review";
import PartyDetail from "@/containers/parties/party-detail";
import PartyList from "@/containers/parties/party-list";
import ForgotPasswordForm from "@/containers/password/forgot-password-form";
import ResetPasswordForm from "@/containers/password/reset-password-form";
import Payments from "@/containers/payments/payments";
import Reports from "@/containers/reports/reports";
import Settings from "@/containers/settings/settings";
import SyncStatus from "@/containers/sync-status/sync-status";
import { LOGIN_PATH } from "@/lib/constants";
import { InvoiceDirection, PartyType } from "@/lib/enums";
import AppLayout from "./app-layout";
import NotFound from "./not-found";
import Providers from "./providers";
import PublicLayout from "./public-layout";

// Every screen. A path added here also needs an entry in lib/routes.config.ts:
// the header reads its title there, the build writes an index.html for each
// path listed there (vite.config.ts) so the API can serve it, and RouteGuard
// reads the roles allowed to open it there.
//
// Detail pages are `<list>/view/?id=…`: one static page per list, so the
// build's per-route index.html serves every record.
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
          <Routes>
            <Route index element={<Navigate to={LOGIN_PATH} replace />} />

            <Route element={<PublicLayout />}>
              <Route
                path="login"
                element={
                  <CarouselLayout>
                    <LoginForm />
                  </CarouselLayout>
                }
              />
              <Route
                path="forgot-password"
                element={
                  <CarouselLayout>
                    <ForgotPasswordForm />
                  </CarouselLayout>
                }
              />
              <Route
                path="reset-password"
                element={
                  <CarouselLayout>
                    <ResetPasswordForm />
                  </CarouselLayout>
                }
              />
            </Route>

            <Route element={<AppLayout />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route
                path="shipper-invoices"
                element={
                  <InvoiceList direction={InvoiceDirection.Receivable} />
                }
              />
              <Route
                path="shipper-invoices/view"
                element={
                  <InvoiceDetail direction={InvoiceDirection.Receivable} />
                }
              />
              <Route
                path="carrier-invoices"
                element={<InvoiceList direction={InvoiceDirection.Payable} />}
              />
              <Route
                path="carrier-invoices/view"
                element={<InvoiceDetail direction={InvoiceDirection.Payable} />}
              />
              <Route path="needs-review" element={<NeedsReview />} />
              <Route path="payments" element={<Payments />} />
              <Route
                path="shippers"
                element={<PartyList type={PartyType.Shipper} />}
              />
              <Route
                path="shippers/view"
                element={<PartyDetail type={PartyType.Shipper} />}
              />
              <Route
                path="carriers"
                element={<PartyList type={PartyType.Carrier} />}
              />
              <Route
                path="carriers/view"
                element={<PartyDetail type={PartyType.Carrier} />}
              />
              <Route path="reports" element={<Reports />} />
              <Route path="sync-status" element={<SyncStatus />} />
              <Route path="audit-log" element={<AuditLog />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Providers>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
