import {
  AutomationKind,
  CreditStatus,
  InvoiceDeliveryMode,
  PartyType,
  StatementFrequency,
  StatementScope,
} from "@/lib/enums";
import {
  AgreementView,
  AutomationRule,
  ContactView,
  NoticeSettings,
  PartyAutomation,
} from "@/lib/interfaces";
import { EMAIL_SHAPE } from "@/lib/constants";
import {
  companyAutomationDefaults,
  DEFAULT_SEND_HOUR,
  DEFAULT_SKIP_WEEKENDS,
} from "@/lib/mock/automation";

// What each automated message is, who it's for, and what can be set on it.
// The logic here is pure so it can be tested; the card and its modals are in
// party-automation.tsx.

export type ContactFlag = "receivesInvoices" | "receivesReminders" | "receivesStatements";

export interface AutomationSpec {
  label: string;
  help: string;
  // "party": emailed to the shipper's or carrier's contacts. "team": an
  // alert to MGC's accounts team.
  audience: "party" | "team";
  // Which contact flag picks the recipients under the company default.
  contactFlag: ContactFlag | null;
  // Unset when the kind has no timing steps.
  steps?: { label: string; unit: string; max: number; maxSteps: number };
  placeholders: string[];
}

const invoicePlaceholders = ["partyName", "invoiceNumber", "dueDate", "balance"];

export const automationSpecs: Record<AutomationKind, AutomationSpec> = {
  [AutomationKind.InvoiceDelivery]: {
    label: "Invoice delivery",
    help: "How an issued invoice reaches the shipper.",
    audience: "party",
    contactFlag: "receivesInvoices",
    placeholders: ["partyName", "invoiceNumber", "dueDate"],
  },
  [AutomationKind.BeforeDue]: {
    label: "Reminders before due",
    help: "Email the shipper ahead of each invoice's due date.",
    audience: "party",
    contactFlag: "receivesReminders",
    steps: { label: "Days before the due date", unit: "before due", max: 60, maxSteps: 5 },
    placeholders: [...invoicePlaceholders, "daysUntilDue"],
  },
  [AutomationKind.Overdue]: {
    label: "Overdue reminders",
    help: "Email the shipper after a due date passes unpaid. Held while the invoice is disputed.",
    audience: "party",
    contactFlag: "receivesReminders",
    steps: { label: "Days past the due date", unit: "overdue", max: 120, maxSteps: 5 },
    placeholders: [...invoicePlaceholders, "daysOverdue"],
  },
  [AutomationKind.Statement]: {
    label: "Statements",
    help: "Email the shipper a statement of their account on a schedule.",
    audience: "party",
    contactFlag: "receivesStatements",
    placeholders: ["partyName", "periodFrom", "periodTo", "totalOpen"],
  },
  [AutomationKind.BillingNotice]: {
    label: "Billing period notice",
    help: "Tell the shipper before a billing period closes, so they can check what's on it.",
    audience: "party",
    contactFlag: "receivesInvoices",
    steps: { label: "Days before the period ends", unit: "before the period ends", max: 60, maxSteps: 3 },
    placeholders: ["partyName", "periodTo"],
  },
  [AutomationKind.CreditLimit]: {
    label: "Credit limit alert",
    help: "Alert MGC's accounts team when the shipper owes close to its credit limit.",
    audience: "team",
    contactFlag: null,
    placeholders: ["partyName", "owed", "creditLimit"],
  },
  [AutomationKind.CarrierBillDue]: {
    label: "Bill due alerts",
    help: "Alert MGC's accounts team ahead of each carrier bill's due date.",
    audience: "team",
    contactFlag: null,
    steps: { label: "Days before the due date", unit: "before due", max: 60, maxSteps: 5 },
    placeholders: [...invoicePlaceholders],
  },
  [AutomationKind.MissingCarrierBill]: {
    label: "Missing bill alert",
    help: "Alert MGC's accounts team when a delivered shipment still has no bill from this carrier.",
    audience: "team",
    contactFlag: null,
    steps: { label: "Days after delivery", unit: "after delivery", max: 90, maxSteps: 1 },
    placeholders: ["partyName", "shipmentRef", "daysSinceDelivery"],
  },
  [AutomationKind.Remittance]: {
    label: "Remittance advice",
    help: "Email the carrier when MGC records a payment to them.",
    audience: "party",
    contactFlag: "receivesInvoices",
    placeholders: ["partyName", "invoiceNumber", "amountPaid", "paymentDate"],
  },
  [AutomationKind.OverduePayable]: {
    label: "Overdue bill alerts",
    help: "Alert MGC's accounts team when a carrier bill passes its due date unpaid.",
    audience: "team",
    contactFlag: null,
    steps: { label: "Days past the due date", unit: "overdue", max: 120, maxSteps: 5 },
    placeholders: [...invoicePlaceholders, "daysOverdue"],
  },
};

export const automationKinds = (type: PartyType): AutomationKind[] =>
  type === PartyType.Shipper
    ? [
        AutomationKind.InvoiceDelivery,
        AutomationKind.BeforeDue,
        AutomationKind.Overdue,
        AutomationKind.Statement,
        AutomationKind.BillingNotice,
        AutomationKind.CreditLimit,
      ]
    : [
        AutomationKind.CarrierBillDue,
        AutomationKind.OverduePayable,
        AutomationKind.MissingCarrierBill,
        AutomationKind.Remittance,
      ];

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export const frequencyLabels: Record<StatementFrequency, string> = {
  [StatementFrequency.WeeklyAndMonthEnd]: "Weekly and at month-end",
  [StatementFrequency.Weekly]: "Weekly",
  [StatementFrequency.Biweekly]: "Every two weeks",
  [StatementFrequency.MonthEnd]: "Month-end only",
};

export const scopeLabels: Record<StatementScope, string> = {
  [StatementScope.OpenInvoices]: "Open invoices only",
  [StatementScope.AllActivity]: "All activity in the period",
};

// "14, 7, 1" → [14, 7, 1], or why it can't be used. Whole days, no repeats,
// sorted the way they happen: before-due steps count down, the rest count up.
export function parseSteps(
  text: string,
  spec: NonNullable<AutomationSpec["steps"]>,
  countDown: boolean
): { steps: number[] } | { error: string } {
  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return { error: "Enter at least one day" };
  if (parts.length > spec.maxSteps) {
    return {
      error: spec.maxSteps === 1 ? "Enter one number" : `At most ${spec.maxSteps} steps`,
    };
  }
  const steps: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > spec.max) {
      return { error: `Whole days from 0 to ${spec.max}, separated by commas` };
    }
    const day = Number(part);
    if (steps.includes(day)) return { error: `${day} is listed twice` };
    steps.push(day);
  }
  steps.sort((a, b) => (countDown ? b - a : a - b));
  return { steps };
}

// "a@x.com, b@y.com" → lower-cased addresses, or the first one that isn't.
export function parseEmails(text: string): { emails: string[] } | { error: string } {
  const emails = text
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length > 10) return { error: "At most 10 addresses" };
  for (const email of emails) {
    if (email.length > 254 || !EMAIL_SHAPE.test(email)) {
      return { error: `"${email}" isn't a valid email` };
    }
  }
  return { emails: [...new Set(emails)] };
}

// The {placeholders} in a template that this kind can't fill.
export function unknownPlaceholders(text: string, allowed: string[]): string[] {
  const found = Array.from(text.matchAll(/\{([^{}]*)\}/g), (match) => match[1]);
  return [...new Set(found.filter((name) => !allowed.includes(name)))];
}

const dayList = (steps: number[]) => {
  const days = steps.map(String);
  const list =
    days.length <= 1 ? days.join("") : `${days.slice(0, -1).join(", ")} and ${days.at(-1)}`;
  return `${list} day${steps.length === 1 && steps[0] === 1 ? "" : "s"}`;
};

const hourText = (hour: number) =>
  `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour < 12 ? "a.m." : "p.m."}`;

export { hourText };

// The party's contacts as the automation card sees them. Loading and failure
// are kept apart from "no contacts", so neither reads as "nobody receives it".
export type ContactsState =
  | { status: "pending" }
  | { status: "error"; retry: () => void }
  | { status: "success"; contacts: ContactView[] };

// Who a rule goes to, in words: named contacts, the contacts flagged for it,
// the team, extra addresses.
export function recipientText(
  rule: AutomationRule,
  spec: AutomationSpec,
  contacts: ContactView[]
): string {
  const active = contacts.filter((contact) => contact.isActive);
  const parts: string[] = [];
  if (spec.audience === "party") {
    const chosen = rule.contactIds.length
      ? active.filter((contact) => rule.contactIds.includes(contact.id))
      : active.filter((contact) => spec.contactFlag && contact[spec.contactFlag]);
    if (chosen.length) parts.push(chosen.map((contact) => contact.email).join(", "));
  }
  if (rule.notifyTeam) parts.push("the accounts team");
  if (rule.extraEmails.length) parts.push(rule.extraEmails.join(", "));
  return parts.join("; ");
}

// One line saying what a rule does, for the card. Uses the company default
// when the rule isn't customised.
export function describeRule(rule: AutomationRule, spec: AutomationSpec): string {
  if (!rule.enabled) return "Off";
  const steps = rule.steps;
  switch (rule.kind) {
    case AutomationKind.InvoiceDelivery:
      return rule.deliveryMode === InvoiceDeliveryMode.Auto
        ? "Emailed automatically when issued"
        : "Sent by staff from the invoice page";
    case AutomationKind.Statement: {
      const when =
        rule.frequency === StatementFrequency.MonthEnd
          ? "on the last weekday of the month"
          : rule.frequency === StatementFrequency.WeeklyAndMonthEnd
            ? `every ${WEEKDAYS[rule.weekday - 1]} and on the last weekday of the month`
            : rule.frequency === StatementFrequency.Biweekly
              ? `every other ${WEEKDAYS[rule.weekday - 1]}`
              : `every ${WEEKDAYS[rule.weekday - 1]}`;
      return `${scopeLabels[rule.statementScope]}, ${when}`;
    }
    case AutomationKind.CreditLimit:
      return `When the balance reaches ${rule.thresholdPercent}% of the credit limit`;
    case AutomationKind.Overdue: {
      const text = `${dayList(steps)} ${spec.steps!.unit}`;
      return rule.escalateFromDays === null
        ? text
        : `${text}; the accounts team is copied from ${rule.escalateFromDays} days`;
    }
    default:
      return spec.steps ? `${dayList(steps)} ${spec.steps.unit}` : "On";
  }
}

// The days Settings holds (GET /settings/notices) for this party's
// defaults: the billing-period notice for its payment terms, and the carrier
// "payment due soon" alert. Null where Settings has none.
export type SettingsDays = {
  billingNoticeDays: number | null;
  carrierAlertDays: number | null;
};

export const settingsDays = (
  settings: NoticeSettings | undefined,
  agreement: AgreementView | undefined
): SettingsDays => {
  const terms = agreement?.paymentTerms as string | undefined;
  const byTerms = settings?.defaultNoticeDays as Record<string, number> | undefined;
  return {
    billingNoticeDays:
      terms && byTerms && terms in byTerms ? byTerms[terms] : null,
    carrierAlertDays: settings?.carrierAlertDaysBefore ?? null,
  };
};

// The company default for one message. Its days come from Settings where
// Settings has them, so a party never shows, or saves, other days than the
// company's; the rest are built-in defaults.
export function companyDefault(
  kind: AutomationKind,
  days: SettingsDays
): AutomationRule {
  const rule = { ...companyAutomationDefaults[kind] };
  if (kind === AutomationKind.BillingNotice && days.billingNoticeDays !== null) {
    rule.steps = [days.billingNoticeDays];
  }
  if (kind === AutomationKind.CarrierBillDue && days.carrierAlertDays !== null) {
    rule.steps = [days.carrierAlertDays];
  }
  return rule;
}

// The rule in force: the company default unless customised. On/off is the
// party's own either way.
export function effectiveRule(
  rule: AutomationRule,
  days: SettingsDays
): AutomationRule {
  if (rule.custom) return rule;
  return { ...companyDefault(rule.kind, days), enabled: rule.enabled };
}

// Why a message can't be switched on for this party, or null when it can.
// The credit-limit alert needs a limit to watch: credit allowed and a limit
// set on the agreement in force (null means "no limit"; undefined means the
// API hasn't sent credit settings yet).
export function unavailableReason(
  kind: AutomationKind,
  agreement: AgreementView | undefined
): string | null {
  if (kind !== AutomationKind.CreditLimit) return null;
  const hasLimit =
    agreement?.creditStatus === CreditStatus.Allowed &&
    typeof agreement.creditLimit === "string";
  return hasLimit ? null : "No credit limit on the agreement in force";
}

// A party's automation as the page first shows it. The on/off of the
// messages the agreement already has a switch for comes from the agreement
// in force (the real data); days set on the agreement count as customised.
export function seedAutomation(
  type: PartyType,
  agreement: AgreementView | undefined,
  days: SettingsDays
): PartyAutomation {
  const rules = automationKinds(type).map((kind): AutomationRule => {
    const rule = companyDefault(kind, days);
    if (unavailableReason(kind, agreement)) rule.enabled = false;
    if (!agreement) return rule;
    switch (kind) {
      case AutomationKind.InvoiceDelivery:
        rule.deliveryMode = agreement.autoSendInvoices
          ? InvoiceDeliveryMode.Auto
          : InvoiceDeliveryMode.Manual;
        if (agreement.autoSendInvoices) rule.custom = true;
        break;
      case AutomationKind.BeforeDue:
      case AutomationKind.Overdue:
        rule.enabled = agreement.remindersEnabled;
        break;
      case AutomationKind.Statement:
        rule.enabled = agreement.weeklyStatementEnabled;
        break;
      case AutomationKind.BillingNotice:
        rule.enabled = agreement.billingNoticeEnabled;
        if (agreement.noticeDaysBefore !== null) {
          rule.steps = [agreement.noticeDaysBefore];
          rule.custom = true;
        }
        break;
      case AutomationKind.CarrierBillDue:
        rule.enabled = agreement.remindersEnabled;
        if (agreement.alertDaysBefore !== null) {
          rule.steps = [agreement.alertDaysBefore];
          rule.custom = true;
        }
        break;
    }
    return rule;
  });
  return {
    paused: false,
    pausedUntil: null,
    pauseReason: "",
    sendHour: DEFAULT_SEND_HOUR,
    skipWeekends: DEFAULT_SKIP_WEEKENDS,
    rules,
  };
}

// Paused when `paused` is set: indefinitely if `pausedUntil` is null,
// otherwise through `pausedUntil`, inclusive. Calendar dates compare as text.
export const isPaused = (automation: PartyAutomation, today: string) =>
  automation.paused &&
  (automation.pausedUntil === null || automation.pausedUntil >= today);

// What the card shows: the saved settings, or the seeded ones until there
// are any. Rows always follow automationKinds(type), each filled from its
// saved rule, so a kind missing from what was saved (added later, or not in
// the response) still has a row, seeded like a new party's.
export function automationFor(
  type: PartyType,
  agreement: AgreementView | undefined,
  saved: PartyAutomation | null,
  days: SettingsDays
): PartyAutomation {
  const seeded = seedAutomation(type, agreement, days);
  if (!saved) return seeded;
  return {
    ...saved,
    rules: seeded.rules.map(
      (rule) => saved.rules.find((item) => item.kind === rule.kind) ?? rule
    ),
  };
}
