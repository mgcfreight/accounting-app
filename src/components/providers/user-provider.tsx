import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { User } from "@/lib/interfaces";
import { mockCurrentUser } from "@/lib/mock";

// The signed-in user, for the whole app (app/providers.tsx). Kept in memory
// only — never in localStorage or a readable cookie (security.md); the API's
// httpOnly session cookie is what keeps someone signed in.
//
// Today it starts as the mock user, the sign-in form sets it and Sign Out
// clears it. When the API is ready, start it empty, set it from signIn() on
// the login form and from getMe() in AppLayout (services/auth.ts).
//
// Role checks made with this are presentation only; the API enforces access.
type UserContextValue = {
  user: User | null;
  setUser: (user: User) => void;
  signOut: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(mockCurrentUser);
  const value = useMemo(
    () => ({ user, setUser, signOut: () => setUser(null) }),
    [user]
  );
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

// The user (or null when signed out) and the functions that change it.
export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used inside UserProvider.");
  return context;
}

// For pages behind AppLayout, which only renders them for a signed-in user.
export function useCurrentUser(): User {
  const { user } = useUser();
  if (!user) throw new Error("useCurrentUser needs a signed-in user.");
  return user;
}
