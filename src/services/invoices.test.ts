import { describe, expect, it } from "vitest";
import { ApiError } from "./api-client";
import { isInvoiceEditConflict } from "./invoices";

const conflict = (
  code: string | undefined,
  message = "Some refusal",
  status = 409
) =>
  new ApiError(message, status, {
    statusCode: status,
    message,
    error: "Conflict",
    ...(code ? { code } : {}),
  });

describe("isInvoiceEditConflict", () => {
  it("is true for a stale version", () => {
    expect(isInvoiceEditConflict(conflict("INVOICE_STALE"))).toBe(true);
  });

  it("is true when someone else made a new version first", () => {
    expect(isInvoiceEditConflict(conflict("INVOICE_ALREADY_REVISED"))).toBe(
      true
    );
  });

  it("goes by the code, not the wording", () => {
    expect(
      isInvoiceEditConflict(conflict("INVOICE_STALE", "Reworded by the API"))
    ).toBe(true);
    expect(
      isInvoiceEditConflict(
        conflict(
          undefined,
          "The invoice was changed by someone else. Reload it and try again."
        )
      )
    ).toBe(false);
  });

  it("is false for a 409 without an edit-conflict code", () => {
    expect(
      isInvoiceEditConflict(
        conflict(
          undefined,
          "This would change the figures of a closed month; an Admin must reopen the month first (2026-09)"
        )
      )
    ).toBe(false);
    expect(isInvoiceEditConflict(conflict("SOMETHING_ELSE"))).toBe(false);
  });

  it("is false for other statuses, odd bodies and other errors", () => {
    expect(
      isInvoiceEditConflict(conflict("INVOICE_STALE", "Some refusal", 400))
    ).toBe(false);
    expect(
      isInvoiceEditConflict(new ApiError("x", 409, "not an object"))
    ).toBe(false);
    expect(isInvoiceEditConflict(new ApiError("x", 409))).toBe(false);
    expect(isInvoiceEditConflict(new Error("boom"))).toBe(false);
  });
});
