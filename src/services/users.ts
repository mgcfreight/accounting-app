import { UserRole } from "@/lib/enums";
import { apiClient } from "./api-client";
import { parsePage, parseSession, parseUser, unwrap } from "./parse";

// Staff user management (the API's /user routes). Admin only; the API
// refuses everyone else. The user is picked by `userId` in the query string.

export type UserListQuery = {
  page: number;
  // At most 100.
  limit: number;
  searchQuery?: string;
  role?: UserRole;
  isEnabled?: boolean;
};

export type NewUser = {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  // 12-64 characters with an upper-case letter, a lower-case letter and a
  // number. The Admin passes it to the user.
  password: string;
};

export type UserChanges = Partial<
  Pick<NewUser, "firstName" | "lastName" | "role">
>;

export const getUsers = async (query: UserListQuery, signal?: AbortSignal) =>
  unwrap(
    await apiClient.get("/user/all", { params: query, signal }),
    parsePage(parseUser)
  );

export const createUser = async (body: NewUser) =>
  unwrap(await apiClient.post("/user", body), parseUser);

// Name and role. The API refuses a change to your own role, and demoting the
// last enabled Admin.
export const updateUser = async (userId: string, body: UserChanges) =>
  unwrap(await apiClient.put("/user", body, { params: { userId } }), parseUser);

// Disabling signs the user out everywhere. Not allowed on yourself, or on
// the last enabled Admin.
export const setUserEnabled = async (userId: string, isEnabled: boolean) => {
  await apiClient.put(
    "/user/enable-disable",
    { isEnabled },
    { params: { userId } }
  );
};

// Sets a new password, signs the user out and clears a lockout. 2FA is
// unchanged.
export const setUserPassword = async (userId: string, password: string) => {
  await apiClient.put("/user/password", { password }, { params: { userId } });
};

// Removes the user's authenticator and recovery codes and signs them out;
// they set 2FA up again at next sign-in. Not allowed on yourself.
export const resetUserTwoFactor = async (userId: string) => {
  await apiClient.put("/user/2fa/reset", undefined, { params: { userId } });
};

export const getUser = async (userId: string, signal?: AbortSignal) =>
  unwrap(await apiClient.get("/user", { params: { userId }, signal }), parseUser);

// A user's sign-in history, newest first: when, from which IP and device,
// and for how long.
export const getUserSessions = async (
  query: { userId: string; page: number; limit: number },
  signal?: AbortSignal
) =>
  unwrap(
    await apiClient.get("/user/sessions", { params: query, signal }),
    parsePage(parseSession)
  );
