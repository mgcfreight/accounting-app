import { Me } from "./interfaces";
import { canAccessRoute } from "./routes.config";

export type MenuIconName =
  | "dashboard"
  | "invoices"
  | "payments"
  | "shippers"
  | "carriers"
  | "shipments"
  | "statements"
  | "reports"
  | "system"
  | "users"
  | "settings";

export interface MenuItem {
  label: string;
  route: string;
  icon?: MenuIconName;
  // The heading the sidebar shows above a top-level item. Consecutive items
  // with the same section share one heading.
  section?: string;
  children?: MenuItem[];
}

// The screens from section 9 of the design document, grouped the way
// mokal-app's admin menu groups its own.
export const MENU_ITEMS: MenuItem[] = [
  { icon: "dashboard", label: "Dashboard", route: "/dashboard/" },
  {
    icon: "invoices",
    section: "Billing",
    label: "Invoices",
    route: "/shipper-invoices/",
    children: [
      { label: "Shipper Invoices", route: "/shipper-invoices/" },
      { label: "Carrier Invoices", route: "/carrier-invoices/" },
      { label: "Needs Review", route: "/needs-review/" },
      { label: "Payment Reminders", route: "/reminders/" },
    ],
  },
  {
    icon: "payments",
    section: "Billing",
    label: "Payments",
    route: "/payments/",
  },
  {
    icon: "shippers",
    section: "Partners",
    label: "Shippers",
    route: "/shippers/",
  },
  {
    icon: "carriers",
    section: "Partners",
    label: "Carriers",
    route: "/carriers/",
  },
  {
    icon: "shipments",
    section: "Partners",
    label: "Shipments",
    route: "/shipments/",
  },
  {
    icon: "statements",
    section: "Reporting",
    label: "Statements",
    route: "/statements/",
  },
  {
    icon: "reports",
    section: "Reporting",
    label: "Reports",
    route: "/reports/",
  },
  {
    icon: "system",
    section: "Admin",
    label: "System",
    route: "/sync-status/",
    children: [{ label: "Sync Status", route: "/sync-status/" }],
  },
  // Non-Admins see only Sessions here (their own) and only the Audit Report
  // under Settings (their own events).
  {
    icon: "users",
    section: "Admin",
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
    section: "Admin",
    label: "Settings",
    route: "/settings/",
    children: [
      { label: "Settings", route: "/settings/" },
      { label: "Audit Report", route: "/settings/audit-log/" },
    ],
  },
];

// The items a user may open, by the access rules in routes.config. A group
// shows while any of its children does, and a group left with one child is
// shown as that child, under the group's icon, so it opens in one click
// rather than two. Hiding an item is presentation only — the API enforces
// access on every endpoint.
export const menuForUser = (
  me: Pick<Me, "isAdmin" | "permissions">,
  items: MenuItem[] = MENU_ITEMS
): MenuItem[] =>
  items.flatMap((item) => {
    if (!item.children) return canAccessRoute(item.route, me) ? [item] : [];
    const children = menuForUser(me, item.children);
    if (children.length === 1) {
      return [{ ...children[0], icon: item.icon, section: item.section }];
    }
    return children.length ? [{ ...item, children }] : [];
  });
