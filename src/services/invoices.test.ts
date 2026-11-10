import { describe, expect, it } from "vitest";
import { ApiError } from "./api-client";
import { isInvoiceEditConflict } from "./invoices";

const conflict = (message: string, status = 409) =>
  new ApiError(message, status, { statusCode: status, message, error: "Conflict" });

describe("isInvoiceEditConflict", () => {
  it("is true for a stale version", () => {
    expect(
      isInvoiceEditConflict(
        conflict("The invoice was changed by someone else. Reload it and try again.")
      )
    ).toBe(true);
  });

  it("is true when someone else made a new version first", () => {
    expect(
      isInvoiceEditConflict(
        conflict(
          "Someone else just made a new version of this invoice. Reload it and try again."
        )
      )
    ).toBe(true);
  });

  it("is false for a 409 on a closed month", () => {
    expect(
      isInvoiceEditConflict(
        conflict(
          "This would change the figures of a closed month; an Admin must reopen the month first (2026-09)"
        )
      )
    ).toBe(false);
  });

  it("is false for other 409s and other statuses", () => {
    expect(
      isInvoiceEditConflict(conflict("This carrier bill number is already on another invoice"))
    ).toBe(false);
    expect(
      isInvoiceEditConflict(
        conflict("The invoice was changed by someone else. Reload it and try again.", 400)
      )
    ).toBe(false);
    expect(isInvoiceEditConflict(new Error("boom"))).toBe(false);
  });
});
