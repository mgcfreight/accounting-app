import { Permission } from "@/lib/enums";
import { apiClient, parseBody } from "./api-client";
import {
  envelope,
  messageOnly,
  paginated,
  permissionCatalogSchema,
  roleSchema,
} from "./schemas";

// Staff roles and what each may do (/role). Every endpoint is Admin only on
// the API; other roles get a 403. `roleId` always travels as a query param.

export type RoleListParams = {
  page: number;
  limit: number;
  sortBy?: "name" | "createdAt";
  order?: "ASC" | "DESC";
};

export type NewRole = {
  name: string;
  description?: string;
  permissions: Permission[];
};

// Only what is sent changes. `permissions` replaces the whole set, and signs
// out every user on the role; `description: null` clears it.
export type RoleChanges = {
  name?: string;
  description?: string | null;
  permissions?: Permission[];
};

export const getPermissionCatalog = (signal?: AbortSignal) =>
  apiClient
    .get("/role/permissions", { signal })
    .then((res) => parseBody(envelope(permissionCatalogSchema), res.data).data);

// Omitting sortBy lists the built-in roles first, then by name.
export const listRoles = (params: RoleListParams, signal?: AbortSignal) =>
  apiClient
    .get("/role/all", {
      params: {
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        order: params.sortBy ? params.order : undefined,
      },
      signal,
    })
    .then((res) => parseBody(envelope(paginated(roleSchema)), res.data).data);

// Every role for a picker. The API pages at most 100 at a time.
export const ALL_ROLES_PARAMS: RoleListParams = { page: 1, limit: 100 };

export const createRole = (role: NewRole) =>
  apiClient
    .post("/role", role)
    .then((res) => parseBody(envelope(roleSchema), res.data).data);

export const updateRole = (roleId: string, changes: RoleChanges) =>
  apiClient
    .put("/role", changes, { params: { roleId } })
    .then((res) => parseBody(envelope(roleSchema), res.data).data);

// Refused for built-in roles (400) and for a role that still has users (409).
export const deleteRole = (roleId: string) =>
  apiClient
    .delete("/role", { params: { roleId } })
    .then((res) => parseBody(messageOnly, res.data).message);
