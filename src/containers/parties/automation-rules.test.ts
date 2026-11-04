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
import { AgreementView, AutomationRule, ContactView, PartyAutomation } from "@/lib/interfaces";
import {
  companyAutomationDefaults,
  DEFAULT_SEND_HOUR,
  DEFAULT_SKIP_WEEKENDS,
} from "@/lib/mock/automation";
import {
  addStep,
  automationSpecs,
  fillTemplate,
  isPaused,
  keepStepTemplates,
  reachesNobody,
  reminderTimeline,
  seedAutomation,
  templateFor,
  unavailableReason,
} from "./automation-rules";

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

const contact = (changes: Partial<ContactView> = {}): ContactView => ({
  id: "c-1",
  partyId: "party-1",
  name: "Accounts Payable",
  email: "ap@acme.com",
  phone: null,
  receivesInvoices: true,
  receivesReminders: true,
  receivesStatements: false,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...changes,
});

const rule = (kind: AutomationKind, changes: Partial<AutomationRule> = {}): AutomationRule => ({
  ...companyAutomationDefaults[kind],
  ...changes,
});

describe("addStep", () => {
  const spec = automationSpecs[AutomationKind.BeforeDue].steps!;

  it("adds a day in the order the steps happen", () => {
    expect(addStep([7], "14", spec, true)).toEqual({ steps: [14, 7] });
    expect(addStep([7], "1", spec, true)).toEqual({ steps: [7, 1] });
    const overdue = automationSpecs[AutomationKind.Overdue].steps!;
    expect(addStep([30], "7", overdue, false)).toEqual({ steps: [7, 30] });
  });

  it("refuses repeats, out-of-range days and too many steps", () => {
    expect(addStep([7], "7", spec, true)).toHaveProperty("error");
    expect(addStep([], "61", spec, true)).toHaveProperty("error");
    expect(addStep([], "1.5", spec, true)).toHaveProperty("error");
    expect(addStep([], "-1", spec, true)).toHaveProperty("error");
    expect(addStep([1, 2, 3, 4, 5], "6", spec, true)).toHaveProperty("error");
  });
});

describe("reminderTimeline", () => {
  it("puts before-due steps before the due date and overdue ones after", () => {
    const points = reminderTimeline([
      rule(AutomationKind.BeforeDue, { steps: [14, 7] }),
      rule(AutomationKind.Overdue, { steps: [7, 30], escalateFromDays: 30 }),
    ]);
    expect(points.map((p) => p.offset)).toEqual([-14, -7, 7, 30]);
    // The team is copied from 30 days overdue only.
    expect(points.map((p) => p.teamCopied)).toEqual([false, false, false, true]);
  });

  it("leaves out messages that are off and ones without steps", () => {
    const points = reminderTimeline([
      rule(AutomationKind.BeforeDue, { enabled: false }),
      rule(AutomationKind.Statement, { enabled: true }),
    ]);
    expect(points).toEqual([]);
  });
});

describe("reachesNobody", () => {
  const spec = automationSpecs[AutomationKind.BeforeDue];

  it("is true when no contact is flagged and nothing else is set", () => {
    const contacts = [contact({ receivesReminders: false })];
    expect(reachesNobody(rule(AutomationKind.BeforeDue), spec, contacts)).toBe(true);
  });

  it("counts a retired contact as no one", () => {
    const retired = contact({ isActive: false });
    const chosen = rule(AutomationKind.BeforeDue, { contactIds: [retired.id] });
    expect(reachesNobody(chosen, spec, [retired])).toBe(true);
  });

  it("is false with a flagged contact, the team or another address", () => {
    expect(reachesNobody(rule(AutomationKind.BeforeDue), spec, [contact()])).toBe(false);
    expect(reachesNobody(rule(AutomationKind.BeforeDue, { notifyTeam: true }), spec, [])).toBe(false);
    expect(
      reachesNobody(rule(AutomationKind.BeforeDue, { extraEmails: ["a@b.com"] }), spec, [])
    ).toBe(false);
  });

  it("is false for a message that is off", () => {
    expect(reachesNobody(rule(AutomationKind.BeforeDue, { enabled: false }), spec, [])).toBe(false);
  });
});

describe("templates", () => {
  it("fills known placeholders and leaves unknown ones as typed", () => {
    expect(fillTemplate("Hi {partyName}, {invoiceNumber} {nope}")).toBe(
      "Hi Acme Logistics, INV-0000 {nope}"
    );
  });

  it("never shows a made-up amount", () => {
    expect(fillTemplate("{balance}")).toBe("[balance]");
  });

  it("uses a step's own message when it has one", () => {
    const r = rule(AutomationKind.Overdue, {
      steps: [7, 30],
      stepTemplates: { "30": { subject: "Final notice", body: "Pay now." } },
    });
    expect(templateFor(r, 30).subject).toBe("Final notice");
    expect(templateFor(r, 7).subject).toBe(r.subject);
  });

  it("drops the messages of steps that were removed", () => {
    const templates = { "7": { subject: "a", body: "b" }, "30": { subject: "c", body: "d" } };
    expect(Object.keys(keepStepTemplates(templates, [7]))).toEqual(["7"]);
  });
});
