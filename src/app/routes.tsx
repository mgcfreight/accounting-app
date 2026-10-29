import { lazy } from "react";
import { Navigate, Route } from "react-router";
import { LOGIN_PATH } from "@/lib/constants";
import { InvoiceDirection, PartyType } from "@/lib/enums";
import AppLayout from "./app-layout";
import NotFound from "./not-found";
import PublicLayout from "./public-layout";

// Each screen loads in its own chunk the first time it is opened, so the
// first page doesn't wait for every other one. The Suspense boundaries are in
// AppLayout and PublicLayout, inside the sidebar and header.
const Account = lazy(() => import("@/containers/account/account"));
const AuditLog = lazy(() => import("@/containers/audit-log/audit-log"));
const Dashboard = lazy(() => import("@/containers/dashboard/dashboard"));
const InvoiceDetail = lazy(() => import("@/containers/invoices/invoice-detail"));
const InvoiceList = lazy(() => import("@/containers/invoices/invoice-list"));
const ForgotPasswordForm = lazy(
  () => import("@/containers/login/forgot-password-form")
);
const LoginForm = lazy(() => import("@/containers/login/login-form"));
const ResetPasswordForm = lazy(
  () => import("@/containers/login/reset-password-form")
);
const NeedsReview = lazy(() => import("@/containers/needs-review/needs-review"));
const PartyDetail = lazy(() => import("@/containers/parties/party-detail"));
const PartyList = lazy(() => import("@/containers/parties/party-list"));
const Payments = lazy(() => import("@/containers/payments/payments"));
const Reminders = lazy(() => import("@/containers/reminders/reminders"));
const Reports = lazy(() => import("@/containers/reports/reports"));
const RoleList = lazy(() => import("@/containers/roles/role-list"));
const Settings = lazy(() => import("@/containers/settings/settings"));
const ShipmentDetail = lazy(
  () => import("@/containers/shipments/shipment-detail")
);
const ShipmentForm = lazy(() => import("@/containers/shipments/shipment-form"));
const ShipmentList = lazy(() => import("@/containers/shipments/shipment-list"));
const Statements = lazy(() => import("@/containers/statements/statements"));
const SyncStatus = lazy(() => import("@/containers/sync-status/sync-status"));
const SessionReport = lazy(() => import("@/containers/users/session-report"));
const UserList = lazy(() => import("@/containers/users/user-list"));

// Every screen. A path added here also needs an entry in lib/routes.config.ts:
// the header reads its title there, the build writes an index.html for each
// path listed there (vite.config.ts) so the API can serve it, and RouteGuard
// reads who may open it there.
//
// Detail pages are `<list>/view/?id=…`: one static page per list, so the
// build's per-route index.html serves every record.
//
// Route elements, not a component: app.tsx hands them to the data router.
const appRoutes = (
  <>
    <Route index element={<Navigate to={LOGIN_PATH} replace />} />

    <Route element={<PublicLayout />}>
      <Route path="login" element={<LoginForm />} />
      <Route path="forgot-password" element={<ForgotPasswordForm />} />
      <Route path="reset-password" element={<ResetPasswordForm />} />
    </Route>

    <Route element={<AppLayout />}>
      <Route path="dashboard" element={<Dashboard />} />
      <Route
        path="shipper-invoices"
        element={<InvoiceList direction={InvoiceDirection.Receivable} />}
      />
      <Route
        path="shipper-invoices/view"
        element={<InvoiceDetail direction={InvoiceDirection.Receivable} />}
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
      <Route path="reminders" element={<Reminders />} />
      <Route path="payments" element={<Payments />} />
      <Route path="shippers" element={<PartyList type={PartyType.Shipper} />} />
      <Route
        path="shippers/view"
        element={<PartyDetail type={PartyType.Shipper} />}
      />
      <Route path="carriers" element={<PartyList type={PartyType.Carrier} />} />
      <Route
        path="carriers/view"
        element={<PartyDetail type={PartyType.Carrier} />}
      />
      <Route path="shipments" element={<ShipmentList />} />
      <Route path="shipments/view" element={<ShipmentDetail />} />
      <Route path="shipments/new" element={<ShipmentForm />} />
      <Route path="statements" element={<Statements />} />
      <Route path="reports" element={<Reports />} />
      <Route path="sync-status" element={<SyncStatus />} />
      <Route path="users" element={<UserList />} />
      <Route path="users/sessions" element={<SessionReport />} />
      <Route path="roles" element={<RoleList />} />
      <Route path="settings" element={<Settings />} />
      <Route path="settings/audit-log" element={<AuditLog />} />
      <Route path="account" element={<Account />} />
    </Route>

    <Route path="*" element={<NotFound />} />
  </>
);

export default appRoutes;
