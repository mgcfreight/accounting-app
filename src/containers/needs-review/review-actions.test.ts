import { describe, expect, it } from "vitest";
import {
  CarrierInvoiceStatus,
  Currency,
  CustomerInvoiceStatus,
  InvoiceDirection,
  ReviewChange,
  ReviewKind,
} from "@/lib/enums";
import { ReviewItem } from "@/lib/interfaces";
import { changeAction, changedText } from "./review-actions";

const item = (over: Partial<ReviewItem>): ReviewItem => ({
  invoiceId: "cri_2pQ8sV4eF5",
  direction: InvoiceDirection.Payable,
  kind: ReviewKind.TmsChange,
  invoiceNumber: "cin_EGP9wr_232",
  invoiceStatus: CarrierInvoiceStatus.Approved,
  version: 2,
  shipmentId: "shp_2pQ8sV4eF5",
  loadNumber: "MGC-232",
  partyId: "pty_9xL1mN2oP3",
  partyName: "Northern Haul Ltd.",
  currency: Currency.CAD,
  currentAmount: "500.00",
  previousAmount: "500.00",
  newAmount: "600.00",
  tmsCurrency: Currency.CAD,
  updatedFromTms: false,
  changes: [ReviewChange.Total],
  detectedAt: "2026-11-09T17:45:30.000Z",
  ...over,
});

// Accounts, 13 Nov 2026, with a carrier cost going from 500 to 600.
describe("changeAction", () => {
  it("only notes a carrier bill that is in but not approved", () => {
    for (const invoiceStatus of [CarrierInvoiceStatus.Received, CarrierInvoiceStatus.OnHold]) {
      expect(changeAction(item({ invoiceStatus }), true)).toEqual({
        link: null,
        resolve: "Add a Note",
      });
    }
  });

  it("changes the amounts of a draft or expected bill staff have edited", () => {
    for (const invoiceStatus of [CustomerInvoiceStatus.Draft, CarrierInvoiceStatus.Expected]) {
      expect(changeAction(item({ invoiceStatus }), true).link).toBe("Change Amounts");
    }
  });

  it("only confirms one the sync already updated", () => {
    expect(
      changeAction(
        item({ invoiceStatus: CarrierInvoiceStatus.Expected, updatedFromTms: true }),
        true
      )
    ).toEqual({ link: null, resolve: "Confirm" });
  });

  it("revises an issued or approved invoice, and voids a cancelled one", () => {
    expect(changeAction(item({}), true).link).toBe("Revise or Note");
    expect(changeAction(item({ kind: ReviewKind.Cancellation }), true).link).toBe(
      "Void or Credit"
    );
    expect(
      changeAction(
        item({ kind: ReviewKind.Cancellation, invoiceStatus: CustomerInvoiceStatus.Draft }),
        true
      ).link
    ).toBe("Void");
  });

  it("only lets a role that may not act view the invoice", () => {
    expect(changeAction(item({}), false).link).toBe("View invoice");
  });
});

describe("changedText", () => {
  it("names what MGC Freight changed", () => {
    expect(changedText(item({ changes: [ReviewChange.Shipper, ReviewChange.Total] }))).toBe(
      "Shipper, Total"
    );
    expect(changedText(item({ changes: [] }))).toBe("");
  });
});
