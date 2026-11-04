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

// Adds one step to a list, keeping it in the order the steps happen.
export function addStep(
  steps: number[],
  text: string,
  spec: NonNullable<AutomationSpec["steps"]>,
  countDown: boolean
): { steps: number[] } | { error: string } {
  const day = text.trim();
  if (!/^\d{1,3}$/.test(day) || Number(day) > spec.max) {
    return { error: `A whole number of days from 0 to ${spec.max}` };
  }
  if (steps.includes(Number(day))) return { error: `${day} is already a step` };
  if (steps.length >= spec.maxSteps) {
    return {
      error: spec.maxSteps === 1 ? "Remove the current day first" : `At most ${spec.maxSteps} steps`,
    };
  }
  return { steps: sortSteps([...steps, Number(day)], countDown) };
}

export const sortSteps = (steps: number[], countDown: boolean) =>
  [...steps].sort((a, b) => (countDown ? b - a : a - b));

// Ready-made step lists, offered as one-click choices in the editor.
export const stepPresets: Partial<Record<AutomationKind, { label: string; steps: number[] }[]>> = {
  [AutomationKind.BeforeDue]: [
    { label: "One reminder", steps: [7] },
    { label: "Two reminders", steps: [7, 1] },
    { label: "Early and often", steps: [14, 7, 3, 1] },
  ],
  [AutomationKind.Overdue]: [
    { label: "Light", steps: [7, 30] },
    { label: "Firm", steps: [1, 7, 14, 30] },
    { label: "Strict", steps: [1, 3, 7, 14, 30] },
  ],
  [AutomationKind.CarrierBillDue]: [
    { label: "A week ahead", steps: [7] },
    { label: "Week and day before", steps: [7, 1] },
  ],
  [AutomationKind.OverduePayable]: [
    { label: "Next day", steps: [1] },
    { label: "Daily first week", steps: [1, 3, 7] },
  ],
};

// Kinds that carry a PDF, and kinds that can skip small balances.
export const ATTACHABLE = new Set([
  AutomationKind.InvoiceDelivery,
  AutomationKind.BeforeDue,
  AutomationKind.Overdue,
  AutomationKind.Statement,
]);
export const HAS_MIN_BALANCE = new Set([AutomationKind.BeforeDue, AutomationKind.Overdue]);

// The message a step sends: its own, or the rule's.
export const templateFor = (rule: AutomationRule, day: number) =>
  rule.stepTemplates[String(day)] ?? { subject: rule.subject, body: rule.body };

// Only the step templates for days that are still steps: removing a step
// drops its message rather than keeping it unseen.
export const keepStepTemplates = (
  templates: Record<string, { subject: string; body: string }>,
  steps: number[]
) =>
  Object.fromEntries(
    Object.entries(templates).filter(([day]) => steps.includes(Number(day)))
  );

// Example values for the template preview. Clearly made up: the real ones,
// amounts included, are filled in by the API when it sends.
export const SAMPLE_VALUES: Record<string, string> = {
  partyName: "Acme Logistics",
  invoiceNumber: "INV-0000",
  dueDate: "1 Jan 2027",
  balance: "[balance]",
  daysUntilDue: "7",
  daysOverdue: "7",
  periodFrom: "1 Dec 2026",
  periodTo: "31 Dec 2026",
  totalOpen: "[open balance]",
  owed: "[amount owed]",
  creditLimit: "[credit limit]",
  shipmentRef: "SHP-0000",
  daysSinceDelivery: "14",
  amountPaid: "[amount paid]",
  paymentDate: "1 Jan 2027",
};

// A template with its placeholders swapped for the example values. Unknown
// ones are left as typed, so a mistake shows in the preview.
export const fillTemplate = (text: string, values: Record<string, string> = SAMPLE_VALUES) =>
  text.replace(/\{([^{}]*)\}/g, (whole, name: string) => values[name] ?? whole);

// One point on the reminder timeline: days from the due date (negative is
// before it), what fires, and whether the accounts team is copied.
export interface TimelinePoint {
  offset: number;
  kind: AutomationKind;
  teamCopied: boolean;
}

// Every enabled before-due and overdue step around the due date, in order.
export function reminderTimeline(rules: AutomationRule[]): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const before =
      rule.kind === AutomationKind.BeforeDue || rule.kind === AutomationKind.CarrierBillDue;
    const after =
      rule.kind === AutomationKind.Overdue || rule.kind === AutomationKind.OverduePayable;
    if (!before && !after) continue;
    for (const day of rule.steps) {
      points.push({
        offset: before ? -day : day,
        kind: rule.kind,
        teamCopied:
          rule.notifyTeam ||
          (rule.kind === AutomationKind.Overdue &&
            rule.escalateFromDays !== null &&
            day >= rule.escalateFromDays),
      });
    }
  }
  return points.sort((a, b) => a.offset - b.offset);
}

export const timelineLabel = (offset: number) =>
  offset === 0
    ? "On the due date"
    : `${Math.abs(offset)} day${Math.abs(offset) === 1 ? "" : "s"} ${offset < 0 ? "before" : "after"}`;

// True when an enabled rule would reach no one: no contact picked or
// flagged, no team copy, no extra address. Unknown while contacts load.
export function reachesNobody(
  rule: AutomationRule,
  spec: AutomationSpec,
  contacts: ContactView[]
): boolean {
  if (!rule.enabled) return false;
  return recipientText(rule, spec, contacts) === "";
}

export const contactFlagLabels: Record<ContactFlag, string> = {
  receivesInvoices: "invoices",
  receivesReminders: "reminders",
  receivesStatements: "statements",
};

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

// The rule in force: the company default unless customised. On/off is the
// party's own either way.
export function effectiveRule(rule: AutomationRule): AutomationRule {
  if (rule.custom) return rule;
  return { ...companyAutomationDefaults[rule.kind], enabled: rule.enabled };
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
  agreement: AgreementView | undefined
): PartyAutomation {
  const rules = automationKinds(type).map((kind): AutomationRule => {
    const rule = { ...companyAutomationDefaults[kind] };
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
