import { describe, expect, it } from "vitest";
import {
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  PaymentTerms,
} from "@/lib/enums";
import { InvoiceView } from "./invoice-view";
import { paymentReminder } from "./payment-reminder";

const today = "2026-10-30";

// Only the fields paymentReminder reads.
const shipperInvoice = (changes: object = {}) =>
  ({
    customerId: "P-1",
    status: CustomerInvoiceStatus.Issued,
    balanceDue: "1221.13",
    dueDate: "2026-11-30",
    paymentTerms: PaymentTerms.Net30,
    ...changes,
  }) as unknown as InvoiceView;

const carrierBill = (changes: object = {}) =>
  ({
    carrierId: "P-2",
    status: CarrierInvoiceStatus.Approved,
    balanceDue: "1103.76",
    dueDate: "2026-11-30",
    paymentTerms: PaymentTerms.Net30,
    ...changes,
  }) as unknown as InvoiceView;

const agreement = {
  remindersEnabled: true,
  noticeDaysBefore: null,
  alertDaysBefore: null,
};

const settings = {
  defaultNoticeDays: { NET_7: 2, NET_15: 4, NET_30: 7, NET_60: 7 },
  carrierAlertDaysBefore: 3,
};

describe("paymentReminder", () => {
  it("uses Settings' default for the shipper's terms", () => {
    expect(paymentReminder(shipperInvoice(), agreement, settings, today)).toEqual({
      remindOn: "2026-11-23",
      daysBefore: 7,
    });
    expect(
      paymentReminder(shipperInvoice({ paymentTerms: PaymentTerms.Net7 }), agreement, settings, today)
    ).toEqual({ remindOn: "2026-11-28", daysBefore: 2 });
    expect(
      paymentReminder(shipperInvoice({ paymentTerms: PaymentTerms.Net15 }), agreement, settings, today)
    ).toEqual({ remindOn: "2026-11-26", daysBefore: 4 });
  });

  it("prefers the shipper agreement's own days, even 0", () => {
    expect(
      paymentReminder(shipperInvoice(), { ...agreement, noticeDaysBefore: 10 }, settings, today)
    ).toEqual({ remindOn: "2026-11-20", daysBefore: 10 });
    expect(
      paymentReminder(shipperInvoice(), { ...agreement, noticeDaysBefore: 0 }, settings, today)
    ).toEqual({ remindOn: "2026-11-30", daysBefore: 0 });
  });

  it("gives COD and prepaid shippers no default", () => {
    for (const paymentTerms of [PaymentTerms.COD, PaymentTerms.Prepaid]) {
      expect(paymentReminder(shipperInvoice({ paymentTerms }), agreement, settings, today)).toBeNull();
    }
  });

  it("alerts on a carrier bill by the agreement, else Settings", () => {
    expect(paymentReminder(carrierBill(), agreement, settings, today)).toEqual({
      remindOn: "2026-11-27",
      daysBefore: 3,
    });
    expect(
      paymentReminder(carrierBill(), { ...agreement, alertDaysBefore: 5 }, settings, today)
    ).toEqual({ remindOn: "2026-11-25", daysBefore: 5 });
  });

  it("has none for a carrier bill while no alert days are set", () => {
    expect(
      paymentReminder(carrierBill(), agreement, { ...settings, carrierAlertDaysBefore: null }, today)
    ).toBeNull();
  });

  it("has none when the agreement turns reminders off", () => {
    const off = { ...agreement, remindersEnabled: false, noticeDaysBefore: 7, alertDaysBefore: 3 };
    expect(paymentReminder(shipperInvoice(), off, settings, today)).toBeNull();
    expect(paymentReminder(carrierBill(), off, settings, today)).toBeNull();
  });

  it("has none once the day has passed, but still shows it on the day", () => {
    expect(paymentReminder(shipperInvoice({ dueDate: "2026-11-05" }), agreement, settings, today)).toBeNull();
    expect(paymentReminder(shipperInvoice({ dueDate: "2026-11-06" }), agreement, settings, today)).toEqual({
      remindOn: today,
      daysBefore: 7,
    });
  });

  it("has none for an invoice that isn't owed or has no due date", () => {
    expect(
      paymentReminder(shipperInvoice({ status: CustomerInvoiceStatus.Draft }), agreement, settings, today)
    ).toBeNull();
    expect(paymentReminder(shipperInvoice({ balanceDue: "0.00" }), agreement, settings, today)).toBeNull();
    expect(paymentReminder(shipperInvoice({ dueDate: null }), agreement, settings, today)).toBeNull();
  });
});
