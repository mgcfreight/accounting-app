import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { toast } from "sonner";
import { can, canAny } from "@/lib/access";
import { Permission } from "@/lib/enums";
import { Me } from "@/lib/interfaces";
import { ApiError, getMe, logout, onSessionExpired } from "@/services";

// The signed-in user, for the whole app (app/providers.tsx), loaded from
// GET /auth/me. Kept in memory only — the session itself is the API's
// httpOnly cookies, which the browser sends and this code never reads
// (security.md).
//
// Permission checks made with this are presentation only; the API enforces
// access. Permissions live only in this query, never in localStorage.

export const ME_QUERY_KEY = ["auth", "me"] as const;

type UserContextValue = {
  // undefined while the first /auth/me is in flight; null when signed out.
  user: Me | null | undefined;
  // /auth/me failed for a reason other than "not signed in" (offline, 5xx).
  loadError: unknown;
  retry: () => void;
  // Reloads the user after sign-in or a change to their own account.
  refreshUser: () => Promise<unknown>;
  signOut: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

// A 401 here has already been through one refresh attempt (api-client), so
// it means nobody is signed in: that is an answer, not a failure.
//
// No abort signal: this provider lives as long as the app, so there is
// nothing to cancel. Reading `signal` would make TanStack abort the request
// when StrictMode's dev-only unmount runs, and send it a second time.
const loadMe = async () => {
  try {
    return await getMe();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
};

export function UserProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: loadMe,
    staleTime: Infinity,
    retry: false,
  });
  const user = me.data;

  // Every other cached response belongs to the user who just left.
  const clearSession = useCallback(() => {
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== ME_QUERY_KEY[0],
    });
    queryClient.setQueryData(ME_QUERY_KEY, null);
  }, [queryClient]);

  // The API couldn't renew the session (expired, signed in elsewhere,
  // disabled, role changed). Say so only if someone was signed in.
  const signedIn = useRef(false);
  useEffect(() => {
    signedIn.current = !!user;
  }, [user]);
  useEffect(
    () =>
      onSessionExpired(() => {
        if (signedIn.current) {
          toast.warning("Your session has ended. Please sign in again.");
        }
        clearSession();
      }),
    [clearSession]
  );

  const value = useMemo<UserContextValue>(
    () => ({
      user,
      loadError: me.error,
      retry: () => void me.refetch(),
      refreshUser: () =>
        queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
      signOut: async () => {
        // Signed out locally even if the request fails: the API ends the
        // session on its side when it can, and the cookies expire anyway.
        await logout().catch(() => undefined);
        clearSession();
      },
    }),
    [user, me, queryClient, clearSession]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used inside UserProvider.");
  return context;
}

// For pages behind AppLayout, which only renders them for a signed-in user.
export function useCurrentUser(): Me {
  const { user } = useUser();
  if (!user) throw new Error("useCurrentUser needs a signed-in user.");
  return user;
}

// `can(…)` / `canAny(…)` for the signed-in user, to show or hide a button.
// Presentation only: the API answers 403 to anything the role doesn't allow.
export function useCan() {
  const me = useCurrentUser();
  return {
    me,
    can: (...needed: Permission[]) => can(me, ...needed),
    canAny: (...options: Permission[]) => canAny(me, ...options),
  };
}
