import { Me } from "./interfaces";
import { canAccessRoute } from "./routes.config";

export type MenuIconName =
  | "dashboard"
  | "invoices"
  | "payments"
  | "shippers"
  | "carriers"
  | "reports"
  | "system"
  | "users"
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
  { icon: "payments", label: "Payments", route: "/payments/" },
  { icon: "shippers", label: "Shippers", route: "/shippers/" },
  { icon: "carriers", label: "Carriers", route: "/carriers/" },
  { icon: "reports", label: "Reports", route: "/reports/" },
  {
    icon: "system",
    label: "System",
    route: "/sync-status/",
    children: [{ label: "Sync Status", route: "/sync-status/" }],
  },
  // Non-Admins see only Sessions here (their own) and only the Audit Report
  // under Settings (their own events).
  {
    icon: "users",
    label: "Users",
    route: "/users/",
    children: [
      { label: "Users", route: "/users/" },
      { label: "Roles & Permissions", route: "/roles/" },
      { label: "Sessions", route: "/users/sessions/" },
    ],
  },
  {
    icon: "settings",
    label: "Settings",
    route: "/settings/",
    children: [
      { label: "Settings", route: "/settings/" },
      { label: "Audit Report", route: "/settings/audit-log/" },
    ],
  },
];

// The items a user may open, by the access rules in routes.config. A group
// shows while any of its children does. Hiding an item is presentation only —
// the API enforces access on every endpoint.
export const menuForUser = (
  me: Pick<Me, "isAdmin" | "permissions">,
  items: MenuItem[] = MENU_ITEMS
): MenuItem[] =>
  items.flatMap((item) => {
    if (!item.children) return canAccessRoute(item.route, me) ? [item] : [];
    const children = menuForUser(me, item.children);
    return children.length ? [{ ...item, children }] : [];
  });
