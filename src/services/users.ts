import { apiClient, parseBody } from "./api-client";
import { envelope, messageOnly, paginated, userSchema } from "./schemas";

// Staff accounts (/user). Every endpoint is Admin only on the API; the Users
// screen is hidden from other roles, but the API is what refuses them.
// `userId` always travels as a query param.

export type UserSortBy =
  "name" | "email" | "role" | "lastLoginAt" | "createdAt";

export type UserListParams = {
  page: number;
  limit: number;
  searchQuery?: string;
  roleId?: string;
  isEnabled?: boolean;
  sortBy?: UserSortBy;
  order?: "ASC" | "DESC";
};

export type NewUser = {
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  password: string;
};

export type UserChanges = {
  firstName?: string;
  lastName?: string;
  roleId?: string;
};

export const listUsers = (params: UserListParams, signal?: AbortSignal) =>
  apiClient
    .get("/user/all", {
      // The API rejects unknown and empty query values, so leave out unset ones.
      params: {
        page: params.page,
        limit: params.limit,
        searchQuery: params.searchQuery || undefined,
        roleId: params.roleId,
        isEnabled:
          params.isEnabled === undefined ? undefined : String(params.isEnabled),
        sortBy: params.sortBy,
        order: params.sortBy ? params.order : undefined,
      },
      signal,
    })
    .then((res) => parseBody(envelope(paginated(userSchema)), res.data).data);

// The user is created with this password; they change it after signing in.
export const createUser = (user: NewUser) =>
  apiClient
    .post("/user", user)
    .then((res) => parseBody(envelope(userSchema), res.data).data);

// A role change signs the user out on the API. The API refuses a change to
// your own role (400) and moving the last enabled Admin off Admin (409).
export const updateUser = (userId: string, changes: UserChanges) =>
  apiClient
    .put("/user", changes, { params: { userId } })
    .then((res) => parseBody(envelope(userSchema), res.data).data);

// Disabling signs the user out; enabling also clears a lockout.
export const setUserEnabled = (userId: string, isEnabled: boolean) =>
  apiClient
    .put("/user/enable-disable", { isEnabled }, { params: { userId } })
    .then((res) => parseBody(messageOnly, res.data).message);

// Signs the user out and clears a lockout; their 2FA is unchanged.
export const setUserPassword = (userId: string, password: string) =>
  apiClient
    .put("/user/password", { password }, { params: { userId } })
    .then((res) => parseBody(messageOnly, res.data).message);

// The user sets 2FA up again at their next sign-in.
export const resetUserTwoFactor = (userId: string) =>
  apiClient
    .put("/user/2fa/reset", undefined, { params: { userId } })
    .then((res) => parseBody(messageOnly, res.data).message);
