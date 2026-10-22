import { User } from "@/lib/interfaces";
import { apiClient } from "./api-client";

// Sign-in endpoints. Not called yet: the screens run on mock data and the
// signed-in user is the mock user (components/providers/user-provider.tsx).
// When the API is ready, the login form calls signIn and AppLayout loads
// getMe, both passing the user to the UserProvider.
//
// The response is untrusted input (security.md): check its shape before
// relying on it once these are wired.

export type Credentials = { email: string; password: string };

// The signed-in user; a 401 means nobody is signed in.
export const getMe = (signal?: AbortSignal) =>
  apiClient.get<User>("/auth/me", { signal }).then((res) => res.data);

// The API sets the session cookie on success.
export const signIn = (credentials: Credentials) =>
  apiClient.post<User>("/auth/login", credentials).then((res) => res.data);

export const signOut = () =>
  apiClient.post<void>("/auth/logout").then(() => undefined);
