import axios, { AxiosError } from "axios";

// The one path to the Accounts API: every request goes through `apiClient`.
// Each endpoint gets a typed function in services/ built on it; nothing else
// in the app calls axios or fetch.
//
// The session is the API's httpOnly cookie, sent by `withCredentials`. No
// token is ever read or attached here (security.md).

const configuredTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS);

export const apiClient = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, ""),
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

// Turns every axios failure into an ApiError. A request cancelled by its
// caller (TanStack Query passes a `signal`) is let through as it is.
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
