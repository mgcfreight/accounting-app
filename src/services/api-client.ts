import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { ApiError } from "./api-error";
import { isRecord, parseTokens, unwrap } from "./parse";
import {
  expireSession,
  getAccessToken,
  getRefreshToken,
  setSessionTokens,
} from "./session";

export { ApiError };

// The one path to the Accounts API: every request goes through `apiClient`.
// Each endpoint gets a typed function in services/ built on it; nothing else
// in the app calls axios or fetch.
//
// The API's session is a Bearer token pair (services/session.ts). This file
// attaches the access token to every request and, when one is refused with a
// 401, rotates the pair once (GET /auth/tokens) and retries. No cookies are
// sent: the API doesn't use them, and its CORS config doesn't allow them.

declare module "axios" {
  interface AxiosRequestConfig {
    // The access token this request went out with, if any.
    sentAccessToken?: string;
    // Already retried with a rotated token; another 401 is final.
    retriedAfterRefresh?: boolean;
  }
}

const configuredTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS);

export const apiClient = axios.create({
  // The API's global prefix (APP_PREFIX) is part of the base URL.
  baseURL: (import.meta.env.VITE_API_URL || "/v1").replace(/\/+$/, ""),
  timeout:
    Number.isInteger(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : 60_000,
  headers: { Accept: "application/json" },
});

// A request that sets its own Authorization (the refresh call sends the
// refresh token) keeps it.
apiClient.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken && !config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
    config.sentAccessToken = accessToken;
  }
  return config;
});

// NestJS sends `message` as a string, or a list of validation messages.
const messageFrom = (body: unknown): string | undefined => {
  if (typeof body !== "object" || body === null) return undefined;
  const { message } = body as { message?: unknown };
  if (typeof message === "string") return message;
  if (Array.isArray(message) && message.every((m) => typeof m === "string")) {
    return message.join(" ");
  }
  return undefined;
};

const toApiError = (error: AxiosError): ApiError => {
  if (error.response) {
    const { status, data } = error.response;
    return new ApiError(
      messageFrom(data) ?? `Request failed (${status}).`,
      status,
      data,
      error
    );
  }
  const timedOut =
    error.code === AxiosError.ECONNABORTED ||
    error.code === AxiosError.ETIMEDOUT;
  return new ApiError(
    timedOut
      ? "The server took too long to respond."
      : "Couldn't reach the server. Check your connection and try again.",
    0,
    undefined,
    error
  );
};

// Each refresh token works once, and the API treats a reused one as stolen
// and signs the user out everywhere. So concurrent 401s share one refresh.
let refreshing: Promise<string> | null = null;

const requestNewTokens = async (): Promise<string> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new ApiError("You're signed out. Sign in again.", 401);
  }
  const res = await apiClient.get("/auth/tokens", {
    headers: { Authorization: `Bearer ${refreshToken}` },
  });
  const tokens = unwrap(res, (data) =>
    isRecord(data) ? parseTokens(data.tokens) : null
  );
  // Signed out while this was in flight: don't bring the session back.
  if (getRefreshToken() !== refreshToken) {
    throw new ApiError("You're signed out. Sign in again.", 401);
  }
  setSessionTokens(tokens);
  return tokens.accessToken;
};

const refreshAccessToken = () => {
  refreshing ??= requestNewTokens().finally(() => {
    refreshing = null;
  });
  return refreshing;
};

const retryAfterRefresh = async (
  config: InternalAxiosRequestConfig,
  original: AxiosError
) => {
  let accessToken = getAccessToken();
  if (!accessToken) throw toApiError(original);

  // Unless another request already rotated the pair since this one was sent.
  if (accessToken === config.sentAccessToken) {
    try {
      accessToken = await refreshAccessToken();
    } catch (refreshError) {
      // The API refused the refresh token: the session is over. A network or
      // server failure leaves it alone; the next request may succeed.
      if (
        refreshError instanceof ApiError &&
        (refreshError.status === 401 || refreshError.status === 403)
      ) {
        expireSession();
        throw new ApiError(
          "Your session has expired. Sign in again.",
          401,
          undefined,
          refreshError
        );
      }
      throw refreshError;
    }
  }

  config.headers.set("Authorization", `Bearer ${accessToken}`);
  config.sentAccessToken = accessToken;
  config.retriedAfterRefresh = true;
  return apiClient(config);
};

// Turns every axios failure into an ApiError. A request cancelled by its
// caller (TanStack Query passes a `signal`) is let through as it is.
apiClient.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isCancel(error) || !(error instanceof AxiosError)) {
    return Promise.reject(error);
  }
  const { config, response } = error;
  if (
    response?.status === 401 &&
    config?.sentAccessToken &&
    !config.retriedAfterRefresh
  ) {
    return retryAfterRefresh(config, error);
  }
  return Promise.reject(toApiError(error));
});
