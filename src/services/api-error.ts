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

// The text to show a user for a failed request.
export const errorMessage = (error: unknown): string => {
  if (!(error instanceof ApiError)) {
    return "Something went wrong. Please try again.";
  }
  if (error.status === 429) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return error.message;
};
