// The page title, back link and header button for each route, read by the
// header — the same shape as mokal-app's routes.config.ts. Keys are the first
// path segment; `childRoutes` are matched on the last one.
//
// Detail pages are `<list>/view/?id=…`. The build also reads this table to
// write an index.html for every route (vite.config.ts), so a route missing
// here 404s on refresh.
//
// It is also the one place a route's access is declared: RouteGuard (app/),
// the sidebar and the profile menu all ask canAccessRoute.

import { Access, hasAccess } from "./access";
import { Permission } from "./enums";
import { Me } from "./interfaces";

export type HeaderButton = {
  text: string;
  // Opens a modal on the page instead of navigating (see useHeaderAction).
  action: string;
  // Who sees the button. Omitted means everyone who can open the page.
  access?: Access;
};

export type RouteConfig = {
  header: string;
  previousRoute?: string;
  // Append "#<id>" from the ?id= query param to the title.
  includeIdInHeader?: boolean;
  createNewButton?: HeaderButton;
  // Who may open the route. A child route without its own takes its
  // parent's; a top-level route without one is refused. Presentation only —
  // the API enforces access on every endpoint.
  access?: Access;
  childRoutes?: Record<string, RouteConfig>;
};

const ANY_USER: Access = { anyUser: true };
const ADMIN_ONLY: Access = { adminOnly: true };

export const routeConfig: Record<string, RouteConfig> = {
  dashboard: { header: "Dashboard", access: ANY_USER },
  "shipper-invoices": {
    header: "Shipper Invoices",
    access: { allOf: [Permission.CustomerInvoicesView] },
    childRoutes: {
      view: {
        header: "Invoice",
        includeIdInHeader: true,
        previousRoute: "/shipper-invoices/",
      },
    },
  },
  "carrier-invoices": {
    header: "Carrier Invoices",
    access: { allOf: [Permission.CarrierInvoicesView] },
    childRoutes: {
      view: {
        header: "Carrier Invoice",
        includeIdInHeader: true,
        previousRoute: "/carrier-invoices/",
      },
    },
  },
  payments: {
    header: "Payments",
    access: {
      anyOf: [Permission.CustomerPaymentsView, Permission.CarrierPaymentsView],
    },
    // Each side is checked again in the form.
    createNewButton: {
      text: "Record Payment",
      action: "record-payment",
      access: {
        anyOf: [
          Permission.CustomerPaymentsCreate,
          Permission.CarrierPaymentsCreate,
        ],
      },
    },
  },
  shippers: {
    header: "Shippers",
    access: { allOf: [Permission.PartiesView] },
    createNewButton: {
      text: "Add Shipper",
      action: "add-party",
      access: { allOf: [Permission.PartiesCreate] },
    },
    childRoutes: {
      view: { header: "Shipper", previousRoute: "/shippers/" },
    },
  },
  carriers: {
    header: "Carriers",
    access: { allOf: [Permission.PartiesView] },
    createNewButton: {
      text: "Add Carrier",
      action: "add-party",
      access: { allOf: [Permission.PartiesCreate] },
    },
    childRoutes: {
      view: { header: "Carrier", previousRoute: "/carriers/" },
    },
  },
  shipments: {
    header: "Shipments",
    access: { allOf: [Permission.ShipmentsView] },
    createNewButton: {
      text: "New Shipment",
      action: "new-shipment",
      // As the form's own route, below.
      access: {
        allOf: [Permission.ShipmentsCreate, Permission.PartiesView],
      },
    },
    childRoutes: {
      view: { header: "Shipment", previousRoute: "/shipments/" },
      // Entering a shipment makes its invoices. The form picks its parties
      // from /party, so it needs parties.view as well.
      new: {
        header: "New Shipment",
        previousRoute: "/shipments/",
        access: {
          allOf: [Permission.ShipmentsCreate, Permission.PartiesView],
        },
      },
    },
  },
  // Statements are filed under reports in the API's permission catalog.
  statements: {
    header: "Statements",
    access: { allOf: [Permission.ReportsView] },
  },
  reports: { header: "Reports", access: { allOf: [Permission.ReportsView] } },
  "needs-review": {
    header: "Needs Review",
    access: {
      anyOf: [Permission.CustomerInvoicesView, Permission.CarrierInvoicesView],
    },
  },
  // Payment reminders on either side; open with either invoice view.
  reminders: {
    header: "Payment Reminders",
    access: {
      anyOf: [Permission.CustomerInvoicesView, Permission.CarrierInvoicesView],
    },
  },
  // No permission covers sync yet; revisit with the sync feature.
  "sync-status": { header: "Sync Status", access: ADMIN_ONLY },
  // Staff accounts are Admin only. Sessions is open to everyone: the API
  // returns everyone's sessions to an Admin and only their own to others.
  users: {
    header: "Users",
    access: ADMIN_ONLY,
    createNewButton: { text: "Add User", action: "add-user" },
    childRoutes: {
      sessions: { header: "Sessions", access: ANY_USER },
    },
  },
  roles: {
    header: "Roles & Permissions",
    access: ADMIN_ONLY,
    createNewButton: { text: "Add Role", action: "add-role" },
  },
  // Admin only (design §9). The audit report is open to everyone, scoped by
  // the API the same way as sessions.
  settings: {
    header: "Settings",
    access: ADMIN_ONLY,
    childRoutes: {
      "audit-log": { header: "Audit Report", access: ANY_USER },
    },
  },
  // The signed-in user's own password, two-factor and sessions.
  account: { header: "My Account", access: ANY_USER },
};

export const getRouteConfig = (pathname: string): RouteConfig | undefined => {
  const segments = pathname.split("/").filter(Boolean);
  const config = routeConfig[segments[0]];
  if (segments.length > 1 && config?.childRoutes) {
    return config.childRoutes[segments[segments.length - 1]] ?? config;
  }
  return config;
};

type AccessHolder = Pick<Me, "isAdmin" | "permissions">;

// Deny by default: a path missing from the table, or a route with no access
// rule of its own or from its parent, is refused — so a route added to app.tsx
// without an entry here shows "No access" rather than opening to everyone.
export const canAccessRoute = (pathname: string, me: AccessHolder): boolean => {
  const config = getRouteConfig(pathname);
  if (!config) return false;
  const segments = pathname.split("/").filter(Boolean);
  const access = config.access ?? routeConfig[segments[0]]?.access;
  return !!access && hasAccess(me, access);
};

// The header's "create new" button for a route, if this user may use it.
export const headerButtonFor = (
  pathname: string,
  me: AccessHolder
): HeaderButton | undefined => {
  const button = getRouteConfig(pathname)?.createNewButton;
  if (!button || !canAccessRoute(pathname, me)) return undefined;
  return !button.access || hasAccess(me, button.access) ? button : undefined;
};
