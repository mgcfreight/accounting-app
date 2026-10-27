import { Currency, PartyType } from "../enums";
import {
  AgingRow,
  MonthlyPnl,
  PartyPnl,
  PeriodSummary,
  Statement,
  TaxSummaryRow,
} from "../interfaces";

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

// Summaries by the Reports page's periods (its periodOptions keys). October
// ties to mockMonthlyPnl and to the tax summary below; Q3 is Jul + Aug + Sep.
// Collected and paid out are money received and sent, CAD.
export const mockPeriodSummaries: Record<string, PeriodSummary> = {
  "2026-10": { key: "2026-10", period: "October 2026 (MTD)", revenue: "31480.00", carrierCost: "25813.60", grossMargin: "5666.40", marginPercent: "18.0", taxCollected: "3460.47", inputTaxCredits: "2848.49", collected: "5755.00", paidOut: "2709.00" },
  "2026-09": { key: "2026-09", period: "September 2026", revenue: "58300.00", carrierCost: "46931.50", grossMargin: "11368.50", marginPercent: "19.5", taxCollected: "6421.80", inputTaxCredits: "5162.47", collected: "49860.25", paidOut: "41775.10" },
  "2026-Q3": { key: "2026-Q3", period: "Q3 2026", revenue: "164320.00", carrierCost: "133925.70", grossMargin: "30394.30", marginPercent: "18.5", taxCollected: "18154.12", inputTaxCredits: "14731.82", collected: "151240.60", paidOut: "126610.35" },
  "2026-YTD": { key: "2026-YTD", period: "2026 year to date", revenue: "452310.00", carrierCost: "370894.20", grossMargin: "81415.80", marginPercent: "18.0", taxCollected: "49876.33", inputTaxCredits: "40921.08", collected: "418920.45", paidOut: "352107.90" },
};

// The months of each quarter, for the quarterly view of the P&L sheet.
export const mockQuarterMonths: Record<string, string[]> = {
  "2026-Q3": ["Jul 2026", "Aug 2026", "Sep 2026"],
};

const pnl = (
  partyId: string,
  partyName: string,
  type: PartyType,
  shipmentCount: number,
  revenue: string,
  carrierCost: string,
  grossMargin: string,
  marginPercent: string
): PartyPnl => ({
  partyId,
  partyName,
  type,
  shipmentCount,
  revenue,
  carrierCost,
  grossMargin,
  marginPercent,
});

// October 2026 (MTD), CAD. Each side adds up to October's revenue 31,480.00,
// carrier cost 25,813.60 and gross margin 5,666.40 over 15 shipments.
export const mockPartyPnl: { period: string; shippers: PartyPnl[]; carriers: PartyPnl[] } = {
  period: "October 2026 (MTD)",
  shippers: [
    pnl("USR_41AQ", "Northwind Distribution", PartyType.Shipper, 5, "9850.00", "8076.00", "1774.00", "18.0"),
    pnl("USR_52BR", "Maple Leaf Foods Co.", PartyType.Shipper, 4, "8120.00", "6740.40", "1379.60", "17.0"),
    pnl("USR_63CS", "Pacific Rim Traders", PartyType.Shipper, 2, "4310.00", "3491.10", "818.90", "19.0"),
    pnl("USR_74DT", "Great Lakes Supply", PartyType.Shipper, 1, "3900.00", "3237.00", "663.00", "17.0"),
    pnl("USR_85EU", "Atlantic Seafoods", PartyType.Shipper, 1, "1220.00", "1000.40", "219.60", "18.0"),
    pnl("USR_96FV", "Prairie Agri Inc.", PartyType.Shipper, 2, "4080.00", "3268.70", "811.30", "19.9"),
  ],
  carriers: [
    pnl("CAR_01", "Day & Ross", PartyType.Carrier, 5, "11040.00", "9120.00", "1920.00", "17.4"),
    pnl("CAR_02", "TST-CF Express", PartyType.Carrier, 3, "6620.00", "5480.60", "1139.40", "17.2"),
    pnl("CAR_03", "Manitoulin Transport", PartyType.Carrier, 2, "5810.00", "4750.00", "1060.00", "18.2"),
    pnl("CAR_04", "XPO Logistics", PartyType.Carrier, 1, "3650.00", "3010.00", "640.00", "17.5"),
    pnl("CAR_05", "Kriska Transportation", PartyType.Carrier, 4, "4360.00", "3453.00", "907.00", "20.8"),
  ],
};

// October 2026 (MTD). Tax on the taxable amount, rounded half-up; QST is on
// the price before GST. Net = collected − input tax credits. Taxable sales
// add up to October's revenue and purchases to its carrier cost; the totals
// match mockPeriodSummaries["2026-10"].
export const mockTaxSummary: {
  period: string;
  rows: TaxSummaryRow[];
  totals: { taxCollected: string; inputTaxCredits: string; netTax: string };
} = {
  period: "October 2026 (MTD)",
  rows: [
    { key: "ON-HST", jurisdiction: "ON", taxCode: "HST", ratePercent: "13.000", taxableSales: "14200.00", taxCollected: "1846.00", taxablePurchases: "11650.00", inputTaxCredits: "1514.50", netTax: "331.50" },
    { key: "QC-GST", jurisdiction: "QC", taxCode: "GST", ratePercent: "5.000", taxableSales: "8120.00", taxCollected: "406.00", taxablePurchases: "6740.40", inputTaxCredits: "337.02", netTax: "68.98" },
    { key: "QC-QST", jurisdiction: "QC", taxCode: "QST", ratePercent: "9.975", taxableSales: "8120.00", taxCollected: "809.97", taxablePurchases: "6740.40", inputTaxCredits: "672.35", netTax: "137.62" },
    { key: "BC-GST", jurisdiction: "BC", taxCode: "GST", ratePercent: "5.000", taxableSales: "4310.00", taxCollected: "215.50", taxablePurchases: "3491.10", inputTaxCredits: "174.56", netTax: "40.94" },
    { key: "NB-HST", jurisdiction: "NB", taxCode: "HST", ratePercent: "15.000", taxableSales: "1220.00", taxCollected: "183.00", taxablePurchases: "1000.40", inputTaxCredits: "150.06", netTax: "32.94" },
    { key: "US-ZERO", jurisdiction: "US", taxCode: "Zero-rated", ratePercent: "0.000", taxableSales: "3630.00", taxCollected: "0.00", taxablePurchases: "2931.70", inputTaxCredits: "0.00", netTax: "0.00" },
  ],
  totals: { taxCollected: "3460.47", inputTaxCredits: "2848.49", netTax: "611.98" },
};
