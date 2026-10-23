import { UserRole } from "./enums";
import { canAccessRoute } from "./routes.config";

export type MenuIconName =
  | "dashboard"
  | "invoices"
  | "shipments"
  | "payments"
  | "shippers"
  | "carriers"
  | "reports"
  | "system"
  | "settings";

export interface MenuItem {
  label: string;
  route: string;
  icon?: MenuIconName;
  children?: MenuItem[];
}

// The screens from section 9 of the design document, grouped the way
// mokal-app's admin menu groups its own.
export const MENU_ITEMS: MenuItem[] = [
  { icon: "dashboard", label: "Dashboard", route: "/dashboard/" },
  {
    icon: "invoices",
    label: "Invoices",
    route: "/shipper-invoices/",
    children: [
      { label: "Shipper Invoices", route: "/shipper-invoices/" },
      { label: "Carrier Invoices", route: "/carrier-invoices/" },
      { label: "Needs Review", route: "/needs-review/" },
    ],
  },
  { icon: "shipments", label: "Shipments", route: "/shipments/" },
  { icon: "payments", label: "Payments", route: "/payments/" },
  { icon: "shippers", label: "Shippers", route: "/shippers/" },
  { icon: "carriers", label: "Carriers", route: "/carriers/" },
  { icon: "reports", label: "Reports", route: "/reports/" },
  {
    icon: "system",
    label: "System",
    route: "/sync-status/",
    children: [
      { label: "Sync Status", route: "/sync-status/" },
      { label: "Audit Log", route: "/audit-log/" },
    ],
  },
  { icon: "settings", label: "Settings", route: "/settings/" },
];

// The items a role may open, by the roles in routes.config. A group shows
// while any of its children does. Hiding an item is presentation only — the
// API enforces access on every endpoint.
export const menuForRole = (
  role: UserRole,
  items: MenuItem[] = MENU_ITEMS
): MenuItem[] =>
  items.flatMap((item) => {
    if (!item.children) return canAccessRoute(item.route, role) ? [item] : [];
    const children = menuForRole(role, item.children);
    return children.length ? [{ ...item, children }] : [];
  });
