import { Currency } from "../enums";
import { TmsOverdueSummary } from "../interfaces";

// A sample GET /account/overdue answer, for the overdue bar's tests: three
// shippers, one overdue invoice each. CAD total: 2320.50 + 2816.89 = 5137.39.
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
