import {
  Currency,
  DisputeStatus,
  InstallmentStatus,
  InvoiceDirection,
  PaymentDirection,
  ReminderChannel,
  ReminderStatus,
} from "../enums";
import { Dispute, InstallmentPlan, Reminder } from "../interfaces";

// Reminders, disputes and installment plans. The demo's "today" is
// 2026-10-19, as in invoices.ts.

const TEAM = "MGC accounts team";

// Seven days before each due date: shippers get an email, and the accounts
// team gets an alert for each carrier bill. `balance` is the balance when
// the reminder went out, or now for one still scheduled.
export const mockReminders: Reminder[] = [
  { id: "RM-56", direction: InvoiceDirection.Receivable, invoiceNumber: "INV-10422a", partyName: "Maple Leaf Foods Co.", dueDate: "2026-10-31", remindOn: "2026-10-24", currency: Currency.CAD, balance: "1221.13", channel: ReminderChannel.CustomerEmail, recipient: "payables@mapleleaf.example.com", status: ReminderStatus.Scheduled, sentAt: null, note: null },
  { id: "RM-57", direction: InvoiceDirection.Receivable, invoiceNumber: "INV-10428", partyName: "Maple Leaf Foods Co.", dueDate: "2026-11-07", remindOn: "2026-10-31", currency: Currency.CAD, balance: "1379.70", channel: ReminderChannel.CustomerEmail, recipient: "payables@mapleleaf.example.com", status: ReminderStatus.Scheduled, sentAt: null, note: null },
  { id: "RM-58", direction: InvoiceDirection.Payable, invoiceNumber: "CINV-10428", partyName: "Day & Ross", dueDate: "2026-11-07", remindOn: "2026-10-31", currency: Currency.CAD, balance: "1103.76", channel: ReminderChannel.TeamAlert, recipient: TEAM, status: ReminderStatus.Scheduled, sentAt: null, note: null },
  { id: "RM-52", direction: InvoiceDirection.Payable, invoiceNumber: "CINV-10423", partyName: "Manitoulin Transport", dueDate: "2026-10-20", remindOn: "2026-10-13", currency: Currency.CAD, balance: "2709.00", channel: ReminderChannel.TeamAlert, recipient: TEAM, status: ReminderStatus.Sent, sentAt: "2026-10-13T13:00:00Z", note: null },
  { id: "RM-50", direction: InvoiceDirection.Receivable, invoiceNumber: "INV-10421", partyName: "Northwind Distribution", dueDate: "2026-10-14", remindOn: "2026-10-07", currency: Currency.CAD, balance: "2816.89", channel: ReminderChannel.CustomerEmail, recipient: "ap@northwind.example.com", status: ReminderStatus.Sent, sentAt: "2026-10-07T13:00:00Z", note: null },
  { id: "RM-51", direction: InvoiceDirection.Payable, invoiceNumber: "CINV-10421", partyName: "Day & Ross", dueDate: "2026-10-14", remindOn: "2026-10-07", currency: Currency.CAD, balance: "2356.99", channel: ReminderChannel.TeamAlert, recipient: TEAM, status: ReminderStatus.Sent, sentAt: "2026-10-07T13:00:00Z", note: null },
  { id: "RM-44", direction: InvoiceDirection.Receivable, invoiceNumber: "INV-10424", partyName: "Great Lakes Supply", dueDate: "2026-09-27", remindOn: "2026-09-20", currency: Currency.USD, balance: "1475.00", channel: ReminderChannel.CustomerEmail, recipient: "billing@greatlakes.example.com", status: ReminderStatus.Sent, sentAt: "2026-09-20T12:00:00Z", note: null },
  { id: "RM-45", direction: InvoiceDirection.Payable, invoiceNumber: "CINV-10424", partyName: "XPO Logistics", dueDate: "2026-09-27", remindOn: "2026-09-20", currency: Currency.USD, balance: "1180.00", channel: ReminderChannel.TeamAlert, recipient: TEAM, status: ReminderStatus.Sent, sentAt: "2026-09-20T12:00:00Z", note: null },
  { id: "RM-31", direction: InvoiceDirection.Receivable, invoiceNumber: "INV-10426", partyName: "Prairie Agri Inc.", dueDate: "2026-08-14", remindOn: "2026-08-07", currency: Currency.CAD, balance: "2320.50", channel: ReminderChannel.CustomerEmail, recipient: "ap@prairieagri.example.com", status: ReminderStatus.Skipped, sentAt: null, note: "Reminders are off in this shipper's agreement" },
];

// Days before the due date a reminder goes out (the requirement: 7).
export const REMINDER_DAYS_BEFORE_DUE = 7;

// An open dispute's balance sits in the aging report's Disputed column
// (INV-10424: USD 1,475.00, as in reports.ts).
export const mockDisputes: Dispute[] = [
  { id: "D-7", direction: InvoiceDirection.Receivable, invoiceNumber: "INV-10424", partyName: "Great Lakes Supply", currency: Currency.USD, disputedAmount: "1475.00", reason: "Shipper says the liftgate was not used", openedOn: "2026-09-30", openedBy: "Sam Patel", status: DisputeStatus.Open, resolution: null, resolvedOn: null },
  { id: "D-6", direction: InvoiceDirection.Payable, invoiceNumber: "CINV-10419", partyName: "TST-CF Express", currency: Currency.CAD, disputedAmount: "240.00", reason: "Carrier billed a second fuel surcharge", openedOn: "2026-09-20", openedBy: "Sam Patel", status: DisputeStatus.Resolved, resolution: "Carrier sent a corrected bill without the second surcharge", resolvedOn: "2026-09-26" },
  { id: "D-5", direction: InvoiceDirection.Receivable, invoiceNumber: "INV-10398", partyName: "Northwind Distribution", currency: Currency.CAD, disputedAmount: "185.00", reason: "Detention charged twice", openedOn: "2026-09-02", openedBy: "Sam Patel", status: DisputeStatus.Resolved, resolution: "Credit note CN-1042 for CAD 185.00 issued", resolvedOn: "2026-09-12" },
];

// Installments add up to the plan's total; paid + remaining = total.
export const mockInstallmentPlans: InstallmentPlan[] = [
  {
    id: "IP-3",
    direction: PaymentDirection.In,
    partyName: "Prairie Agri Inc.",
    invoiceNumbers: ["INV-10426"],
    currency: Currency.CAD,
    total: "2320.50",
    paid: "0.00",
    remaining: "2320.50",
    agreedOn: "2026-10-17",
    installments: [
      { number: 1, dueDate: "2026-10-24", amount: "773.50", status: InstallmentStatus.Due, paidOn: null },
      { number: 2, dueDate: "2026-11-07", amount: "773.50", status: InstallmentStatus.Due, paidOn: null },
      { number: 3, dueDate: "2026-11-21", amount: "773.50", status: InstallmentStatus.Due, paidOn: null },
    ],
  },
  {
    id: "IP-2",
    direction: PaymentDirection.Out,
    partyName: "Kriska Transportation",
    invoiceNumbers: ["CINV-10426"],
    currency: Currency.CAD,
    total: "1884.75",
    paid: "900.00",
    remaining: "984.75",
    agreedOn: "2026-09-08",
    installments: [
      { number: 1, dueDate: "2026-09-10", amount: "900.00", status: InstallmentStatus.Paid, paidOn: "2026-09-10" },
      { number: 2, dueDate: "2026-10-10", amount: "492.38", status: InstallmentStatus.Late, paidOn: null },
      { number: 3, dueDate: "2026-11-10", amount: "492.37", status: InstallmentStatus.Due, paidOn: null },
    ],
  },
];
