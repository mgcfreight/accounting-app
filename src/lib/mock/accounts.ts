import { Currency } from "../enums";
import { TmsOverdueSummary } from "../interfaces";

// The overdue bar above the header shows this on every page until the API
// reports overdue payments from the TMS. The three shippers with an overdue
// balance in the account summaries below, one overdue invoice each.
// CAD total: 2320.50 + 2816.89 = 5137.39.
export const mockTmsOverdue: TmsOverdueSummary = {
  shippers: [
    {
      partyId: "USR_96FV",
      partyName: "Prairie Agri Inc.",
      currency: Currency.CAD,
      amount: "2320.50",
      invoiceCount: 1,
      oldestOverdueDays: 66,
    },
    {
      partyId: "USR_74DT",
      partyName: "Great Lakes Supply",
      currency: Currency.USD,
      amount: "1475.00",
      invoiceCount: 1,
      oldestOverdueDays: 22,
    },
    {
      partyId: "USR_41AQ",
      partyName: "Northwind Distribution",
      currency: Currency.CAD,
      amount: "2816.89",
      invoiceCount: 1,
      oldestOverdueDays: 5,
    },
  ],
  totals: [
    { currency: Currency.CAD, amount: "5137.39" },
    { currency: Currency.USD, amount: "1475.00" },
  ],
  oldestOverdueDays: 66,
};
