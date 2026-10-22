import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { User } from "@/lib/interfaces";

// The signed-in user, for the whole app (app/providers.tsx). Kept in memory
// only — never in localStorage or a cookie (security.md) — so it starts
// empty: the login form sets it after signIn(), and Sign Out clears it.
//
// The session itself (the API's tokens) lives in services/; app/providers.tsx
// passes in how to end it and how to hear that the API ended it.
//
// Role checks made with this are presentation only; the API enforces access.
type UserContextValue = {
  user: User | null;
  setUser: (user: User) => void;
  signOut: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({
  children,
  endSession,
  onSessionExpired,
}: {
  children: ReactNode;
  // Signs out on the API. The user is cleared at once, whether or not it
  // succeeds.
  endSession: () => Promise<void>;
  // Subscribes to the API refusing the session; returns the unsubscribe.
  onSessionExpired: (listener: () => void) => () => void;
}) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => onSessionExpired(() => setUser(null)), [onSessionExpired]);

  const signOut = useCallback(() => {
    setUser(null);
    void endSession().catch(() => undefined);
  }, [endSession]);

  const value = useMemo(
    () => ({ user, setUser, signOut }),
    [user, signOut]
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
