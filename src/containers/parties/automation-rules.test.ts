import { describe, expect, it } from "vitest";
import {
  AdjustmentMode,
  AutomationKind,
  CreditStatus,
  Currency,
  InvoiceDeliveryMode,
  PartyType,
  PaymentTerms,
  TaxBasis,
  TaxTreatment,
} from "@/lib/enums";
import { AgreementView, PartyAutomation } from "@/lib/interfaces";
import { DEFAULT_SEND_HOUR, DEFAULT_SKIP_WEEKENDS } from "@/lib/mock/automation";
import { isPaused, seedAutomation, unavailableReason } from "./automation-rules";

const agreement = (changes: Partial<AgreementView> = {}): AgreementView => ({
  id: "agr-1",
  partyId: "party-1",
  paymentTerms: PaymentTerms.Net7,
  currency: Currency.CAD,
  taxTreatment: TaxTreatment.Standard,
  taxBasis: TaxBasis.BillTo,
  billingTrigger: null,
  noticeDaysBefore: null,
  alertDaysBefore: null,
  defaultAdjustmentMode: AdjustmentMode.Separate,
  autoSendInvoices: false,
  billingNoticeEnabled: true,
  remindersEnabled: true,
  weeklyStatementEnabled: false,
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  notes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...changes,
});

const ruleOf = (automation: PartyAutomation, kind: AutomationKind) =>
  automation.rules.find((rule) => rule.kind === kind)!;

describe("seedAutomation", () => {
  it("takes reminders, delivery and statements from the agreement", () => {
    const seeded = seedAutomation(
      PartyType.Shipper,
      agreement({
        remindersEnabled: false,
        autoSendInvoices: true,
        weeklyStatementEnabled: true,
      })
    );
    expect(ruleOf(seeded, AutomationKind.BeforeDue).enabled).toBe(false);
    expect(ruleOf(seeded, AutomationKind.Overdue).enabled).toBe(false);
    expect(ruleOf(seeded, AutomationKind.InvoiceDelivery).deliveryMode).toBe(
      InvoiceDeliveryMode.Auto
    );
    expect(ruleOf(seeded, AutomationKind.Statement).enabled).toBe(true);
  });

  it("uses the company send hour and weekend setting", () => {
    const seeded = seedAutomation(PartyType.Shipper, agreement());
    expect(seeded.sendHour).toBe(DEFAULT_SEND_HOUR);
    expect(seeded.skipWeekends).toBe(DEFAULT_SKIP_WEEKENDS);
    expect(seeded.paused).toBe(false);
  });

  it("keeps the credit-limit alert off without a credit limit", () => {
    for (const changes of [
      {},
      { creditStatus: CreditStatus.Allowed, creditLimit: null },
      { creditStatus: CreditStatus.Blocked, creditLimit: "5000.00" },
    ]) {
      const seeded = seedAutomation(PartyType.Shipper, agreement(changes));
      expect(ruleOf(seeded, AutomationKind.CreditLimit).enabled).toBe(false);
    }
    expect(
      ruleOf(seedAutomation(PartyType.Shipper, undefined), AutomationKind.CreditLimit).enabled
    ).toBe(false);
  });
});

describe("unavailableReason", () => {
  it("allows the credit-limit alert only with credit allowed and a limit set", () => {
    expect(
      unavailableReason(
        AutomationKind.CreditLimit,
        agreement({ creditStatus: CreditStatus.Allowed, creditLimit: "5000.00" })
      )
    ).toBeNull();
    expect(unavailableReason(AutomationKind.CreditLimit, agreement())).not.toBeNull();
    expect(unavailableReason(AutomationKind.CreditLimit, undefined)).not.toBeNull();
  });

  it("puts no limit on other messages", () => {
    expect(unavailableReason(AutomationKind.BeforeDue, undefined)).toBeNull();
  });
});

const base: PartyAutomation = {
  paused: false,
  pausedUntil: null,
  pauseReason: "",
  sendHour: 9,
  skipWeekends: true,
  rules: [],
};

const TODAY = "2026-11-05";

describe("isPaused", () => {
  it("is not paused when no pause is set", () => {
    expect(isPaused(base, TODAY)).toBe(false);
  });

  it("treats a pause with no end date as indefinite", () => {
    expect(isPaused({ ...base, paused: true, pausedUntil: null }, TODAY)).toBe(true);
  });

  it("is paused through the end date, inclusive", () => {
    expect(isPaused({ ...base, paused: true, pausedUntil: "2026-11-06" }, TODAY)).toBe(true);
    expect(isPaused({ ...base, paused: true, pausedUntil: TODAY }, TODAY)).toBe(true);
  });

  it("is not paused once the end date has passed", () => {
    expect(isPaused({ ...base, paused: true, pausedUntil: "2026-11-04" }, TODAY)).toBe(false);
  });

  it("ignores a leftover date when the pause is off", () => {
    expect(isPaused({ ...base, paused: false, pausedUntil: "2026-12-31" }, TODAY)).toBe(false);
  });
});
