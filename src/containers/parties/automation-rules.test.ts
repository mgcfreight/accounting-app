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
import {
  automationFor,
  effectiveRule,
  isPaused,
  seedAutomation,
  settingsDays,
  SettingsDays,
  unavailableReason,
} from "./automation-rules";

const NO_DAYS: SettingsDays = { billingNoticeDays: null, carrierAlertDays: null };

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
      }),
      NO_DAYS
    );
    expect(ruleOf(seeded, AutomationKind.BeforeDue).enabled).toBe(false);
    expect(ruleOf(seeded, AutomationKind.Overdue).enabled).toBe(false);
    expect(ruleOf(seeded, AutomationKind.InvoiceDelivery).deliveryMode).toBe(
      InvoiceDeliveryMode.Auto
    );
    expect(ruleOf(seeded, AutomationKind.Statement).enabled).toBe(true);
  });

  it("uses the company send hour and weekend setting", () => {
    const seeded = seedAutomation(PartyType.Shipper, agreement(), NO_DAYS);
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
      const seeded = seedAutomation(PartyType.Shipper, agreement(changes), NO_DAYS);
      expect(ruleOf(seeded, AutomationKind.CreditLimit).enabled).toBe(false);
    }
    expect(
      ruleOf(seedAutomation(PartyType.Shipper, undefined, NO_DAYS), AutomationKind.CreditLimit).enabled
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

describe("company defaults from Settings", () => {
  const notices = {
    defaultNoticeDays: { NET_7: 2, NET_15: 4, NET_30: 7, NET_60: 9 },
    carrierAlertDaysBefore: 3,
    updatedAt: null,
    updatedBy: null,
  };

  it("takes the billing notice for the terms and the carrier alert from Settings", () => {
    const days = settingsDays(notices, agreement({ paymentTerms: PaymentTerms.Net60 }));
    expect(days).toEqual({ billingNoticeDays: 9, carrierAlertDays: 3 });
    const seeded = seedAutomation(PartyType.Shipper, agreement(), days);
    expect(ruleOf(seeded, AutomationKind.BillingNotice).steps).toEqual([9]);
    const carrier = seedAutomation(PartyType.Carrier, agreement(), days);
    expect(ruleOf(carrier, AutomationKind.CarrierBillDue).steps).toEqual([3]);
  });

  it("shows a rule that isn't customised with Settings' days", () => {
    const days = { billingNoticeDays: 5, carrierAlertDays: null };
    const rule = { ...ruleOf(seedAutomation(PartyType.Shipper, agreement(), days), AutomationKind.BillingNotice), steps: [99] };
    expect(effectiveRule({ ...rule, custom: false }, days).steps).toEqual([5]);
    expect(effectiveRule({ ...rule, custom: true }, days).steps).toEqual([99]);
  });
});

describe("automationFor", () => {
  it("keeps saved rules and adds a row for a kind missing from them", () => {
    const seeded = seedAutomation(PartyType.Shipper, agreement(), NO_DAYS);
    const saved: PartyAutomation = {
      ...seeded,
      sendHour: 14,
      rules: [{ ...ruleOf(seeded, AutomationKind.BeforeDue), enabled: false }],
    };
    const shown = automationFor(PartyType.Shipper, agreement(), saved, NO_DAYS);
    expect(shown.sendHour).toBe(14);
    expect(shown.rules.map((rule) => rule.kind)).toEqual(seeded.rules.map((rule) => rule.kind));
    expect(ruleOf(shown, AutomationKind.BeforeDue).enabled).toBe(false);
    expect(ruleOf(shown, AutomationKind.Overdue)).toEqual(ruleOf(seeded, AutomationKind.Overdue));
  });
});
