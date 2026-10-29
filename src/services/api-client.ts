import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { z } from "zod";

// The one path to the Accounts API: every request goes through `apiClient`.
// Each endpoint gets a typed function in services/ built on it; nothing else
// in the app calls axios or fetch.
//
// The session is two httpOnly cookies set by the API (`mgc_at`, the 15-minute
// access token, and `mgc_rt`, the refresh token), sent by `withCredentials`.
// No token is ever read or attached here (security.md).

const configuredTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS);

export const apiClient = axios.create({
  // The API's routes are under /v1 (its APP_PREFIX), on the origin that
  // serves this app.
  baseURL: (import.meta.env.VITE_API_URL || "/v1").replace(/\/+$/, ""),
  timeout:
    Number.isInteger(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : 60_000,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

// Every failure is thrown as this — never returned as `undefined`, which a
// screen could mistake for "no data" and show as 0.00. `status` is 0 when the
// server was not reached (offline, timed out).
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(
    message: string,
    status: number,
    body?: unknown,
    cause?: unknown
  ) {
    super(message, { cause });
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

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

// Thrown when a response arrives but isn't the shape the screen expects —
// a mismatch with the API, never shown as data.
export class ResponseShapeError extends Error {
  constructor(cause: unknown) {
    super("The server sent a response this screen can't read.", { cause });
    this.name = "ResponseShapeError";
  }
}

// The text to show for a failed request: the API's own message (they are
// written for staff), or a generic one for anything else.
export const errorMessage = (error: unknown) =>
  error instanceof ApiError || error instanceof ResponseShapeError
    ? error.message
    : "Something went wrong. Please try again.";

// Checks a response body against its schema, throwing on any mismatch.
export const parseBody = <T extends z.ZodType>(schema: T, body: unknown) => {
  const result = schema.safeParse(body);
  if (!result.success) throw new ResponseShapeError(result.error);
  return result.data as z.infer<T>;
};

// The name in a Content-Disposition header: filename* (UTF-8) first, then
// the plain one. Null when the header is missing or unreadable.
const attachmentName = (header: unknown): string | null => {
  if (typeof header !== "string") return null;
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Fall through to the plain name.
    }
  }
  return header.match(/filename="([^"]+)"/i)?.[1] ?? null;
};

// A generated file (PDF, Excel) from the API, with the name it was sent
// under. Cross-origin, the browser hides Content-Disposition unless the API
// exposes it, so the caller gives the name to use then. A failure arrives
// as a Blob; its JSON message is read out so the ApiError reads as usual.
export const getFile = async (
  url: string,
  params: Record<string, unknown>,
  fallbackName: string
): Promise<{ blob: Blob; fileName: string }> => {
  try {
    const res = await apiClient.get<Blob>(url, {
      params,
      responseType: "blob",
      headers: { Accept: "*/*" },
    });
    return {
      blob: res.data,
      fileName:
        attachmentName(res.headers["content-disposition"]) ?? fallbackName,
    };
  } catch (error) {
    if (error instanceof ApiError && error.body instanceof Blob) {
      let body: unknown;
      try {
        body = JSON.parse(await error.body.text());
      } catch {
        throw error;
      }
      throw new ApiError(
        messageFrom(body) ?? error.message,
        error.status,
        body,
        error
      );
    }
    throw error;
  }
};

// Called when the session can't be renewed (signed out elsewhere, disabled,
// expired), so the UserProvider can clear the user and show the login page.
type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export const onSessionExpired = (listener: SessionExpiredListener) => {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
};

// Requests where a 401 means "wrong code / no session yet", not "access token
// expired": sign-in, the 2FA challenge steps, password reset, and the refresh
// itself. A 401 from any other endpoint triggers one refresh.
const NO_REFRESH = new Set([
  "/auth/login",
  "/auth/2fa/verify",
  "/auth/2fa/email/send",
  "/auth/2fa/email/verify",
  "/auth/2fa/setup",
  "/auth/2fa/enable",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/tokens",
]);

// The API's refresh token is single use, and presenting a used one signs the
// user out everywhere, so refreshes must never run in parallel: every 401
// waits on the same one.
let refreshing: Promise<boolean> | null = null;

const refreshSession = () => {
  refreshing ??= apiClient
    .post("/auth/tokens")
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// On a 401 the access cookie has probably expired: renew it once and repeat
// the request. If renewing fails, the session is over.
apiClient.interceptors.response.use(undefined, async (error: unknown) => {
  if (!(error instanceof AxiosError) || error.response?.status !== 401) {
    return Promise.reject(error);
  }
  const config = error.config as RetriableConfig | undefined;
  if (!config || config._retried || NO_REFRESH.has(config.url ?? "")) {
    return Promise.reject(error);
  }
  if (await refreshSession()) {
    const retry: RetriableConfig = { ...config, _retried: true };
    return apiClient.request(retry);
  }
  sessionExpiredListeners.forEach((listener) => listener());
  return Promise.reject(error);
});

// Turns every axios failure into an ApiError. A request cancelled by its
// caller (TanStack Query passes a `signal`) is let through as it is.
// Registered second, so it runs after the refresh handler above has decided.
apiClient.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isCancel(error) || !(error instanceof AxiosError)) {
    return Promise.reject(error);
  }
  if (error.response) {
    const { status, data } = error.response;
    return Promise.reject(
      new ApiError(
        messageFrom(data) ?? `Request failed (${status}).`,
        status,
        data,
        error
      )
    );
  }
  const timedOut =
    error.code === AxiosError.ECONNABORTED ||
    error.code === AxiosError.ETIMEDOUT;
  return Promise.reject(
    new ApiError(
      timedOut
        ? "The server took too long to respond."
        : "Couldn't reach the server. Check your connection and try again.",
      0,
      undefined,
      error
    )
  );
});
