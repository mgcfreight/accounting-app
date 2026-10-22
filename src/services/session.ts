// The signed-in session: the API's access and refresh tokens, held in this
// module's memory and nowhere else — never localStorage, sessionStorage or a
// cookie (security.md). Reloading the page drops them, so a reload means
// signing in again.
//
// Only services/ touches the tokens: sign-in stores them, apiClient attaches
// the access token and rotates the pair, sign-out clears them. The rest of the
// app sees the user, never a token.

export type Tokens = { accessToken: string; refreshToken: string };

let tokens: Tokens | null = null;
const expiryListeners = new Set<() => void>();

export const setSessionTokens = (next: Tokens) => {
  tokens = next;
};

export const getAccessToken = () => tokens?.accessToken ?? null;

export const getRefreshToken = () => tokens?.refreshToken ?? null;

export const clearSession = () => {
  tokens = null;
};

// The API refused the session (it expired, was revoked, or the user was
// disabled): the tokens are gone, and each listener is told so the app can
// show the login screen.
export const expireSession = () => {
  clearSession();
  expiryListeners.forEach((listener) => listener());
};

// Returns the unsubscribe function, so it can be a useEffect's cleanup.
export const onSessionExpired = (listener: () => void) => {
  expiryListeners.add(listener);
  return () => {
    expiryListeners.delete(listener);
  };
};
