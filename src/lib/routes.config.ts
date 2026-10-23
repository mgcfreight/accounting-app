// The page title, back link and header button for each route, read by the
// header — the same shape as mokal-app's routes.config.ts. Keys are the first
// path segment; `childRoutes` are matched on the last one.
//
// Detail pages are `<list>/view/?id=…`. The build also reads this table to
// write an index.html for every route (vite.config.ts), so a route missing
// here 404s on refresh.
//
// It is also the one place a route's roles are declared: RouteGuard (app/),
// the sidebar and the profile menu all ask canAccessRoute.

import { UserRole } from "./enums";

export type HeaderButton = {
  text: string;
  // Opens a modal on the page instead of navigating (see useHeaderAction).
  action: string;
};

export type RouteConfig = {
  header: string;
  previousRoute?: string;
  // Append "#<id>" from the ?id= query param to the title.
  includeIdInHeader?: boolean;
  createNewButton?: HeaderButton;
  // Roles that may open the route. Omitted means every role; a child route
  // without its own list takes its parent's. Presentation only — the API
  // enforces access on every endpoint.
  roles?: UserRole[];
  childRoutes?: Record<string, RouteConfig>;
};

export const routeConfig: Record<string, RouteConfig> = {
  dashboard: { header: "Dashboard" },
  "shipper-invoices": {
    header: "Shipper Invoices",
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
    childRoutes: {
      view: {
        header: "Carrier Invoice",
        includeIdInHeader: true,
        previousRoute: "/carrier-invoices/",
      },
    },
  },
  shipments: {
    header: "Shipments",
    childRoutes: {
      view: { header: "Shipment", previousRoute: "/shipments/" },
      // Entering a shipment makes its invoices: Admins and Accountants.
      new: {
        header: "New Shipment",
        previousRoute: "/shipments/",
        roles: [UserRole.Admin, UserRole.Accountant],
      },
    },
  },
  // Every signed-in user's own account.
  profile: { header: "My Profile" },
  payments: {
    header: "Payments",
    createNewButton: { text: "Record Payment", action: "record-payment" },
  },
  shippers: {
    header: "Shippers",
    childRoutes: {
      view: { header: "Shipper", previousRoute: "/shippers/" },
    },
  },
  carriers: {
    header: "Carriers",
    childRoutes: {
      view: { header: "Carrier", previousRoute: "/carriers/" },
    },
  },
  reports: { header: "Reports" },
  "needs-review": { header: "Needs Review" },
  "sync-status": { header: "Sync Status" },
  // Admin only: the API's /audit routes show every user's activity and IPs.
  "audit-log": { header: "Audit Log", roles: [UserRole.Admin] },
  // Admin only (design §9).
  settings: { header: "Settings", roles: [UserRole.Admin] },
};

export const getRouteConfig = (pathname: string): RouteConfig | undefined => {
  const segments = pathname.split("/").filter(Boolean);
  const config = routeConfig[segments[0]];
  if (segments.length > 1 && config?.childRoutes) {
    return config.childRoutes[segments[segments.length - 1]] ?? config;
  }
  return config;
};

// Deny by default: a path missing from the table is refused, so a route added
// to app.tsx without an entry here shows "No access" rather than opening to
// every role.
export const canAccessRoute = (pathname: string, role: UserRole): boolean => {
  const config = getRouteConfig(pathname);
  if (!config) return false;
  const segments = pathname.split("/").filter(Boolean);
  const roles = config.roles ?? routeConfig[segments[0]]?.roles;
  return !roles || roles.includes(role);
};
