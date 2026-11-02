import { describe, expect, it } from "vitest";
import { isInvoiceNumber } from "./invoice-view";

describe("isInvoiceNumber", () => {
  it("knows shipper and carrier invoice numbers", () => {
    expect(isInvoiceNumber("sin_EGP9wr_230")).toBe(true);
    expect(isInvoiceNumber("cin_EGP9wr_230a")).toBe(true);
  });

  it("leaves internal ids to the id lookup", () => {
    expect(isInvoiceNumber("csi_VoBHDEphoM")).toBe(false);
    expect(isInvoiceNumber("cri_VoBHDEphoM")).toBe(false);
  });
});
