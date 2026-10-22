import { Currency } from "../enums";
import { AgingRow, MonthlyPnl, Statement } from "../interfaces";

// Dashboard and report figures. In production every one of these comes from
// the API already calculated; see README.md for how they tie to invoices.ts.

export const mockDashboard = {
  receivable: { CAD: "7738.22", USD: "1475.00" },
  payable: { CAD: "4445.50", USD: "1180.00" },
  // Each USD invoice converted at its own invoice-date rate (design §8.4).
  receivableInCad: "9760.74",
  payableInCad: "6063.52",
  overdueCount: { shipper: 3, carrier: 3 },
  // October payments received: P-2047, P-2042, P-2041 (CAD) and P-2044 (USD).
  collectedThisMonth: { CAD: "5755.00", USD: "500.00" },
  needsReview: 2,
  unmatchedPayments: 2,
  disputed: 1,
  averagePaymentCycleDays: { shipper: 24, carrier: 31 },
};

export const mockAging: { receivable: AgingRow[]; payable: AgingRow[] } = {
  receivable: [
    {
      label: "Receivable (CAD)",
      current: "2600.83",
      days1to30: "2816.89",
      days31to60: "0.00",
      days61to90: "2320.50",
      days90plus: "0.00",
      disputed: "0.00",
      total: "7738.22",
      currency: Currency.CAD,
    },
    {
      label: "Receivable (USD)",
      current: "0.00",
      days1to30: "0.00",
      days31to60: "0.00",
      days61to90: "0.00",
      days90plus: "0.00",
      disputed: "1475.00",
      total: "1475.00",
      currency: Currency.USD,
    },
  ],
  payable: [
    {
      label: "Payable (CAD)",
      current: "1103.76",
      days1to30: "2356.99",
      days31to60: "0.00",
      days61to90: "984.75",
      days90plus: "0.00",
      disputed: "0.00",
      total: "4445.50",
      currency: Currency.CAD,
    },
    {
      label: "Payable (USD)",
      current: "0.00",
      days1to30: "1180.00",
      days31to60: "0.00",
      days61to90: "0.00",
      days90plus: "0.00",
      disputed: "0.00",
      total: "1180.00",
      currency: Currency.USD,
    },
  ],
};

// margin = revenue − carrier cost; margin % to one decimal. CAD at
// invoice-date rates. October is month to date.
export const mockMonthlyPnl: MonthlyPnl[] = [
  { month: "May 2026", revenue: "48210.00", carrierCost: "39532.20", grossMargin: "8677.80", marginPercent: "18.0" },
  { month: "Jun 2026", revenue: "52640.00", carrierCost: "43164.80", grossMargin: "9475.20", marginPercent: "18.0" },
  { month: "Jul 2026", revenue: "50120.00", carrierCost: "40597.20", grossMargin: "9522.80", marginPercent: "19.0" },
  { month: "Aug 2026", revenue: "55900.00", carrierCost: "46397.00", grossMargin: "9503.00", marginPercent: "17.0" },
  { month: "Sep 2026", revenue: "58300.00", carrierCost: "46931.50", grossMargin: "11368.50", marginPercent: "19.5" },
  { month: "Oct 2026 (MTD)", revenue: "31480.00", carrierCost: "25813.60", grossMargin: "5666.40", marginPercent: "18.0" },
];

// Chart series are plain numbers because ApexCharts plots numbers. They are
// for drawing only; no displayed amount is read from them.
export const mockMarginChart = {
  categories: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
  revenue: [48210, 52640, 50120, 55900, 58300, 31480],
  carrierCost: [39532.2, 43164.8, 40597.2, 46397, 46931.5, 25813.6],
  grossMargin: [8677.8, 9475.2, 9522.8, 9503, 11368.5, 5666.4],
};

// Statement history is only mocked for one shipper (Northwind, USR_41AQ).
const mockStatements: Record<string, Statement[]> = {
  USR_41AQ: [
    { id: "ST-412", periodFrom: "2026-10-01", periodTo: "2026-10-16", sentAt: "2026-10-16T12:00:00Z", closingBalance: "2816.89" },
    { id: "ST-398", periodFrom: "2026-09-01", periodTo: "2026-10-09", sentAt: "2026-10-09T12:00:00Z", closingBalance: "2816.89" },
    { id: "ST-371", periodFrom: "2026-09-01", periodTo: "2026-09-25", sentAt: "2026-09-25T12:00:00Z", closingBalance: "2816.89" },
  ],
};

export const findStatements = (partyId: string): Statement[] =>
  mockStatements[partyId] ?? [];

export const mockReports = [
  {
    key: "summary",
    title: "Monthly / Quarterly Summary",
    description:
      "Revenue, carrier cost, gross margin, GST/HST collected and paid, money collected and paid out.",
    formats: ["Excel", "PDF"],
  },
  {
    key: "pnl-monthly",
    title: "P&L Monthly Sheet",
    description: "Month-by-month revenue − carrier cost = gross margin, margin %.",
    formats: ["Excel", "PDF"],
  },
  {
    key: "pnl-party",
    title: "P&L by Shipper / Carrier / Shipment",
    description: "Revenue, cost, margin and margin % for each.",
    formats: ["Excel", "PDF"],
  },
  {
    key: "aging",
    title: "Aging (Receivable and Payable)",
    description:
      "Current, 1–30, 31–60, 61–90, 90+ per party, with disputed amounts in their own column.",
    formats: ["Excel", "PDF"],
  },
  {
    key: "tax",
    title: "Tax Report (HST/GST)",
    description:
      "Tax collected on shipper invoices vs input tax credits on carrier invoices, by period and province.",
    formats: ["Excel", "PDF"],
  },
  {
    key: "statements",
    title: "Statements",
    description: "Per shipper or carrier, for any date range.",
    formats: ["PDF"],
  },
  {
    key: "accountant",
    title: "Accountant Export",
    description:
      "Invoices, notes and payments for a period, for import into MGC's accounting software.",
    formats: ["CSV"],
  },
];
