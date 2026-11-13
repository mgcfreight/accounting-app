import {
  AutomationKind,
  InvoiceDeliveryMode,
  StatementFrequency,
  StatementScope,
} from "../enums";
import { AutomationRule } from "../interfaces";

// Days before the due date a reminder goes out (the requirement: 7).
const REMINDER_DAYS_BEFORE_DUE = 7;

// The company's default for each automated message, which a shipper or
// carrier uses until staff customise it. Demo values: no API serves these
// yet. The before-due and overdue days match what the Accounts API does
// today (7 days before; 7 and 30 days past due).

export const DEFAULT_SEND_HOUR = 9;
export const DEFAULT_SKIP_WEEKENDS = true;

const base: Omit<AutomationRule, "kind" | "steps" | "subject" | "body"> = {
  enabled: true,
  custom: false,
  contactIds: [],
  notifyTeam: false,
  extraEmails: [],
  escalateFromDays: null,
  deliveryMode: InvoiceDeliveryMode.Manual,
  frequency: StatementFrequency.WeeklyAndMonthEnd,
  weekday: 5,
  statementScope: StatementScope.OpenInvoices,
  thresholdPercent: 80,
};

const rule = (
  kind: AutomationKind,
  steps: number[],
  subject: string,
  body: string,
  changes: Partial<AutomationRule> = {}
): AutomationRule => ({ ...base, kind, steps, subject, body, ...changes });

export const companyAutomationDefaults: Record<AutomationKind, AutomationRule> = {
  [AutomationKind.InvoiceDelivery]: rule(
    AutomationKind.InvoiceDelivery,
    [],
    "Invoice {invoiceNumber} from MGC",
    "Hello {partyName},\n\nPlease find invoice {invoiceNumber} attached, due {dueDate}.\n\nThank you,\nMGC Accounts"
  ),
  [AutomationKind.BeforeDue]: rule(
    AutomationKind.BeforeDue,
    [REMINDER_DAYS_BEFORE_DUE],
    "Invoice {invoiceNumber} is due {dueDate}",
    "Hello {partyName},\n\nA reminder that invoice {invoiceNumber} for {balance} is due on {dueDate}.\n\nThank you,\nMGC Accounts"
  ),
  [AutomationKind.Overdue]: rule(
    AutomationKind.Overdue,
    [7, 30],
    "Invoice {invoiceNumber} is {daysOverdue} days overdue",
    "Hello {partyName},\n\nInvoice {invoiceNumber} for {balance} was due on {dueDate} and is now {daysOverdue} days overdue. Please arrange payment.\n\nThank you,\nMGC Accounts"
  ),
  [AutomationKind.Statement]: rule(
    AutomationKind.Statement,
    [],
    "Your MGC statement to {periodTo}",
    "Hello {partyName},\n\nYour statement for {periodFrom} to {periodTo} is attached. Open balance: {totalOpen}.\n\nThank you,\nMGC Accounts",
    { enabled: false }
  ),
  [AutomationKind.BillingNotice]: rule(
    AutomationKind.BillingNotice,
    [3],
    "Your billing period ends {periodTo}",
    "Hello {partyName},\n\nYour billing period ends on {periodTo}. Please check the shipments on it before it closes.\n\nThank you,\nMGC Accounts"
  ),
  [AutomationKind.CreditLimit]: rule(
    AutomationKind.CreditLimit,
    [],
    "{partyName} is near its credit limit",
    "{partyName} owes {owed} against a credit limit of {creditLimit}.",
    { notifyTeam: true, enabled: false }
  ),
  [AutomationKind.CarrierBillDue]: rule(
    AutomationKind.CarrierBillDue,
    [REMINDER_DAYS_BEFORE_DUE],
    "Carrier bill {invoiceNumber} from {partyName} is due {dueDate}",
    "Carrier bill {invoiceNumber} from {partyName} for {balance} is due on {dueDate}.",
    { notifyTeam: true }
  ),
  [AutomationKind.MissingCarrierBill]: rule(
    AutomationKind.MissingCarrierBill,
    [14],
    "No bill yet from {partyName} for {shipmentRef}",
    "Shipment {shipmentRef} was delivered {daysSinceDelivery} days ago and {partyName} hasn't billed it yet.",
    { notifyTeam: true, enabled: false }
  ),
  [AutomationKind.Remittance]: rule(
    AutomationKind.Remittance,
    [],
    "Payment from MGC for {invoiceNumber}",
    "Hello {partyName},\n\nWe have sent {amountPaid} for invoice {invoiceNumber} on {paymentDate}.\n\nThank you,\nMGC Accounts",
    { enabled: false }
  ),
  [AutomationKind.OverduePayable]: rule(
    AutomationKind.OverduePayable,
    [1],
    "Carrier bill {invoiceNumber} from {partyName} is overdue",
    "Carrier bill {invoiceNumber} from {partyName} for {balance} was due on {dueDate} and is {daysOverdue} days overdue.",
    { notifyTeam: true }
  ),
};
