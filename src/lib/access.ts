import { Permission } from "./enums";
import { Me } from "./interfaces";

// What the signed-in user's role allows, from GET /auth/me. Every page and
// button check goes through these. Presentation only: the API checks every
// request on its own and answers 403.

type Holder = Pick<Me, "isAdmin" | "permissions">;

// Holds every one of `needed`.
export const can = (me: Holder, ...needed: Permission[]) =>
  me.isAdmin || needed.every((p) => me.permissions.includes(p));

// Holds at least one of `options`.
export const canAny = (me: Holder, ...options: Permission[]) =>
  me.isAdmin || options.some((p) => me.permissions.includes(p));

// Who may open a route or see a header button (routes.config.ts). Users,
// roles and settings changes aren't permissions: they are Admin only.
export type Access =
  | { anyUser: true }
  | { adminOnly: true }
  | { allOf: Permission[] }
  | { anyOf: Permission[] };

export const hasAccess = (me: Holder, access: Access): boolean => {
  if ("anyUser" in access) return true;
  if ("adminOnly" in access) return me.isAdmin;
  if ("allOf" in access) return can(me, ...access.allOf);
  return canAny(me, ...access.anyOf);
};
