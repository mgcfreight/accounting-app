import {
  Currency,
  InstallmentStatus,
  PaymentDirection,
} from "../enums";
import { InstallmentPlan } from "../interfaces";

// Installment plans. The demo's "today" is 2026-10-19, as in invoices.ts.

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
