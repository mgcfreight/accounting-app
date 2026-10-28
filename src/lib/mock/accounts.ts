import {
  Currency,
  DisputeStatus,
  InstallmentStatus,
  InvoiceDirection,
  PartyType,
  PaymentDirection,
  ReminderChannel,
  ReminderStatus,
  StatementRunKind,
} from "../enums";
import {
  Dispute,
  InstallmentPlan,
  PartyAccountSummary,
  Reminder,
  StatementRun,
} from "../interfaces";

// Statements, reminders, disputes and installment plans. The demo's "today"
// is 2026-10-19, as in invoices.ts. Balances and overdue amounts are the
// ones in parties.ts; last payments are the ones in payments.ts where the
// payment is there, and older ones otherwise.

const summary = (
  partyId: string,
  partyName: string,
  type: PartyType,
  currency: Currency,
  figures: Omit<
    PartyAccountSummary,
    "partyId" | "partyName" | "type" | "currency"
  >
): PartyAccountSummary => ({ partyId, partyName, type, currency, ...figures });

// The dashboard's average payment cycle (24 days for shippers, 31 for
// carriers) is the mean of the averages below.
export const mockAccountSummaries: PartyAccountSummary[] = [
  summary("USR_41AQ", "Northwind Distribution", PartyType.Shipper, Currency.CAD, {
    businessVolume: "38450.00",
    shipmentCount: 14,
    balance: "2816.89",
    overdue: "2816.89",
    oldestOverdueDays: 5,
    // P-2047 is not allocated yet.
    lastPayment: { paidOn: "2026-10-16", paymentNumber: "P-2047", invoiceRef: null, amount: "1500.00" },
    averagePaymentDays: 24,
    weeklyStatement: true,
    statementEmail: "ap@northwind.example.com",
  }),
  summary("USR_52BR", "Maple Leaf Foods Co.", PartyType.Shipper, Currency.CAD, {
    businessVolume: "61230.40",
    shipmentCount: 22,
    balance: "2600.83",
    overdue: "0.00",
    oldestOverdueDays: 0,
    lastPayment: { paidOn: "2026-10-10", paymentNumber: "P-2042", invoiceRef: "INV-10422", amount: "1000.00" },
    averagePaymentDays: 20,
    weeklyStatement: true,
    statementEmail: "payables@mapleleaf.example.com",
  }),
  summary("USR_63CS", "Pacific Rim Traders", PartyType.Shipper, Currency.CAD, {
    businessVolume: "24890.00",
    shipmentCount: 9,
    balance: "0.00",
    overdue: "0.00",
    oldestOverdueDays: 0,
    lastPayment: { paidOn: "2026-10-03", paymentNumber: "P-2041", invoiceRef: "INV-10423", amount: "3255.00" },
    averagePaymentDays: 12,
    weeklyStatement: false,
    statementEmail: "accounts@pacificrim.example.com",
  }),
  summary("USR_74DT", "Great Lakes Supply", PartyType.Shipper, Currency.USD, {
    businessVolume: "16720.00",
    shipmentCount: 6,
    balance: "1475.00",
    overdue: "1475.00",
    oldestOverdueDays: 22,
    // P-2044 is not allocated yet: INV-10424 is disputed.
    lastPayment: { paidOn: "2026-10-12", paymentNumber: "P-2044", invoiceRef: null, amount: "500.00" },
    averagePaymentDays: 30,
    weeklyStatement: true,
    statementEmail: "billing@greatlakes.example.com",
  }),
  summary("USR_85EU", "Atlantic Seafoods", PartyType.Shipper, Currency.CAD, {
    // One shipment, its invoice still a draft.
    businessVolume: "1220.00",
    shipmentCount: 1,
    balance: "0.00",
    overdue: "0.00",
    oldestOverdueDays: 0,
    lastPayment: null,
    averagePaymentDays: null,
    weeklyStatement: false,
    statementEmail: "finance@atlanticseafoods.example.com",
  }),
  summary("USR_96FV", "Prairie Agri Inc.", PartyType.Shipper, Currency.CAD, {
    businessVolume: "29870.00",
    shipmentCount: 11,
    balance: "2320.50",
    overdue: "2320.50",
    oldestOverdueDays: 66,
    lastPayment: { paidOn: "2026-06-30", paymentNumber: "P-1988", invoiceRef: "INV-10391", amount: "2104.75" },
    averagePaymentDays: 34,
    weeklyStatement: false,
    statementEmail: "ap@prairieagri.example.com",
  }),
  summary("CAR_01", "Day & Ross", PartyType.Carrier, Currency.CAD, {
    businessVolume: "72340.50",
    shipmentCount: 31,
    balance: "3460.75",
    overdue: "2356.99",
    oldestOverdueDays: 5,
    lastPayment: { paidOn: "2026-09-02", paymentNumber: "P-2019", invoiceRef: "CINV-10398", amount: "3120.00" },
    averagePaymentDays: 30,
    weeklyStatement: false,
    statementEmail: null,
  }),
  summary("CAR_02", "TST-CF Express", PartyType.Carrier, Currency.CAD, {
    businessVolume: "41260.00",
    shipmentCount: 18,
    balance: "0.00",
    overdue: "0.00",
    oldestOverdueDays: 0,
    lastPayment: { paidOn: "2026-09-28", paymentNumber: "P-2031", invoiceRef: "CINV-10411", amount: "1650.00" },
    averagePaymentDays: 27,
    weeklyStatement: false,
    statementEmail: null,
  }),
  summary("CAR_03", "Manitoulin Transport", PartyType.Carrier, Currency.CAD, {
    businessVolume: "30115.00",
    shipmentCount: 12,
    balance: "0.00",
    overdue: "0.00",
    oldestOverdueDays: 0,
    lastPayment: { paidOn: "2026-10-15", paymentNumber: "P-2045", invoiceRef: "CINV-10423", amount: "2709.00" },
    averagePaymentDays: 25,
    weeklyStatement: false,
    statementEmail: null,
  }),
  summary("CAR_04", "XPO Logistics", PartyType.Carrier, Currency.USD, {
    businessVolume: "9840.00",
    shipmentCount: 5,
    balance: "1180.00",
    overdue: "1180.00",
    oldestOverdueDays: 22,
    lastPayment: { paidOn: "2026-08-12", paymentNumber: "P-1996", invoiceRef: "CINV-10380", amount: "1240.00" },
    averagePaymentDays: 38,
    weeklyStatement: false,
    statementEmail: null,
  }),
  summary("CAR_05", "Kriska Transportation", PartyType.Carrier, Currency.CAD, {
    businessVolume: "18755.00",
    shipmentCount: 8,
    balance: "984.75",
    overdue: "984.75",
    oldestOverdueDays: 66,
    lastPayment: { paidOn: "2026-09-10", paymentNumber: "P-2046", invoiceRef: "CINV-10426", amount: "900.00" },
    averagePaymentDays: 35,
    weeklyStatement: false,
    statementEmail: null,
  }),
];

export const findAccountSummary = (partyId: string) =>
  mockAccountSummaries.find((row) => row.partyId === partyId);

// Balances refresh every day at 06:00 Toronto time; shipper statements go
// out every Friday at 08:00 to shippers with weekly statements on. The
// 2026-10-02 email to Northwind bounced, so its statement history skips it.
export const mockStatementRuns: StatementRun[] = [
  { id: "SR-118", kind: StatementRunKind.DailyRefresh, ranAt: "2026-10-19T10:00:00Z", partyCount: 11, sentCount: null, failedCount: null },
  { id: "SR-117", kind: StatementRunKind.DailyRefresh, ranAt: "2026-10-18T10:00:00Z", partyCount: 11, sentCount: null, failedCount: null },
  { id: "SR-116", kind: StatementRunKind.DailyRefresh, ranAt: "2026-10-17T10:00:00Z", partyCount: 11, sentCount: null, failedCount: null },
  { id: "SR-115", kind: StatementRunKind.WeeklyEmail, ranAt: "2026-10-16T12:00:00Z", partyCount: 3, sentCount: 3, failedCount: 0 },
  { id: "SR-114", kind: StatementRunKind.DailyRefresh, ranAt: "2026-10-16T10:00:00Z", partyCount: 11, sentCount: null, failedCount: null },
  { id: "SR-108", kind: StatementRunKind.WeeklyEmail, ranAt: "2026-10-09T12:00:00Z", partyCount: 3, sentCount: 3, failedCount: 0 },
  { id: "SR-101", kind: StatementRunKind.WeeklyEmail, ranAt: "2026-10-02T12:00:00Z", partyCount: 3, sentCount: 2, failedCount: 1 },
];

// The next Friday statement run after the demo's today.
export const nextWeeklyStatementRun = "2026-10-23T12:00:00Z";

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
