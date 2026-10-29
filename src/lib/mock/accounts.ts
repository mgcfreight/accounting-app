import {
  Currency,
  DisputeStatus,
  InstallmentStatus,
  InvoiceDirection,
  PaymentDirection,
} from "../enums";
import { Dispute, InstallmentPlan } from "../interfaces";

// Disputes and installment plans. The demo's "today" is
// 2026-10-19, as in invoices.ts.

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
