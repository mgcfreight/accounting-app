import {
  AllocationRule,
  Currency,
  MatchStatus,
  PaymentDirection,
  PaymentMethod,
} from "../enums";
import { Allocation, Payment } from "../interfaces";

const allocation = (
  invoiceNumber: string,
  invoiceBalanceBefore: string,
  amount: string,
  invoiceBalanceAfter: string,
  rule: AllocationRule
): Allocation => ({
  invoiceNumber,
  invoiceBalanceBefore,
  amount,
  invoiceBalanceAfter,
  rule,
});

// Each allocation shows the invoice balance before and after it, from
// invoices.ts. P-2042 went to INV-10422 before INV-10422a replaced it.
// Auto-matching tries the invoice number in the reference, then an exact
// amount, then the party's oldest open invoice (design §8.5).
export const mockPayments: Payment[] = [
  {
    id: "P-2047",
    number: "P-2047",
    direction: PaymentDirection.In,
    partyId: "USR_41AQ",
    partyName: "Northwind Distribution",
    method: PaymentMethod.ETransfer,
    source: "MANUAL",
    reference: "Oct freight",
    paidOn: "2026-10-16",
    currency: Currency.CAD,
    amount: "1500.00",
    unapplied: "1500.00",
    match: MatchStatus.Unmatched,
    allocations: [],
    // No invoice number and no invoice for exactly 1,500.00: the oldest open
    // invoice, part-paid.
    suggested: [
      allocation("INV-10421", "2816.89", "1500.00", "1316.89", AllocationRule.OldestOpen),
    ],
  },
  {
    id: "P-2045",
    number: "P-2045",
    direction: PaymentDirection.Out,
    partyId: "CAR_03",
    partyName: "Manitoulin Transport",
    method: PaymentMethod.Eft,
    source: "MANUAL",
    reference: "CINV-10423 / MT-55201",
    paidOn: "2026-10-15",
    currency: Currency.CAD,
    amount: "2709.00",
    unapplied: "0.00",
    match: MatchStatus.Matched,
    allocations: [
      allocation("CINV-10423", "2709.00", "2709.00", "0.00", AllocationRule.InvoiceNumber),
    ],
    suggested: [],
  },
  {
    id: "P-2044",
    number: "P-2044",
    direction: PaymentDirection.In,
    partyId: "USR_74DT",
    partyName: "Great Lakes Supply",
    method: PaymentMethod.Wire,
    source: "MANUAL",
    reference: "GLS-REMIT-0921",
    paidOn: "2026-10-12",
    currency: Currency.USD,
    amount: "500.00",
    unapplied: "500.00",
    match: MatchStatus.Unmatched,
    allocations: [],
    // INV-10424 is disputed, so the match waits for staff to confirm.
    suggested: [
      allocation("INV-10424", "1475.00", "500.00", "975.00", AllocationRule.OldestOpen),
    ],
  },
  {
    id: "P-2042",
    number: "P-2042",
    direction: PaymentDirection.In,
    partyId: "USR_52BR",
    partyName: "Maple Leaf Foods Co.",
    method: PaymentMethod.Eft,
    source: "MANUAL",
    reference: "INV-10422",
    paidOn: "2026-10-10",
    currency: Currency.CAD,
    amount: "1000.00",
    unapplied: "0.00",
    match: MatchStatus.Matched,
    allocations: [
      allocation("INV-10422", "2056.60", "1000.00", "1056.60", AllocationRule.InvoiceNumber),
    ],
    suggested: [],
  },
  {
    id: "P-2041",
    number: "P-2041",
    direction: PaymentDirection.In,
    partyId: "USR_63CS",
    partyName: "Pacific Rim Traders",
    method: PaymentMethod.Card,
    source: "MGC_STRIPE",
    reference: "pi_3Q8xLmA2eZvKYlo2",
    paidOn: "2026-10-03",
    currency: Currency.CAD,
    amount: "3255.00",
    unapplied: "0.00",
    match: MatchStatus.Matched,
    // A Stripe payment names its invoice.
    allocations: [
      allocation("INV-10423", "3255.00", "3255.00", "0.00", AllocationRule.InvoiceNumber),
    ],
    suggested: [],
  },
  {
    id: "P-2046",
    number: "P-2046",
    direction: PaymentDirection.Out,
    partyId: "CAR_05",
    partyName: "Kriska Transportation",
    method: PaymentMethod.Cheque,
    source: "MANUAL",
    reference: "CHQ 004512",
    paidOn: "2026-09-10",
    currency: Currency.CAD,
    amount: "900.00",
    unapplied: "0.00",
    match: MatchStatus.Matched,
    // The first instalment of the plan in installments.ts.
    allocations: [
      allocation("CINV-10426", "1884.75", "900.00", "984.75", AllocationRule.Manual),
    ],
    suggested: [],
  },
];
