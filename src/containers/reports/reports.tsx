import { Tab, Tabs } from "@heroui/react";
import { ReactNode, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { PiFileXls, PiFilePdf, PiFileCsv } from "react-icons/pi";
import { Link } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import {
  AgingTable,
  BaseButton,
  BaseCardWrapper,
  BaseSelect,
  BaseTable,
  DetailRow,
  Money,
} from "@/components/common";
import { ReportingIcon } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
import { oneOf, useListUrlState, useSyncListUrl } from "@/hooks";
import { Currency, PartyType, Permission } from "@/lib/enums";
import { ExportColumn } from "@/lib/export";
import {
  AgingRow,
  MonthlyPnl,
  PartyPnl,
  PeriodSummary,
  TaxSummaryRow,
} from "@/lib/interfaces";
import {
  mockAging,
  mockMonthlyPnl,
  mockPartyPnl,
  mockPeriodMonths,
  mockPeriodSummaries,
  mockReports,
  mockTaxSummary,
} from "@/lib/mock";
import { BaseTableColumn } from "@/lib/types";
import { exportTable, ExportFormat, moneyText } from "./export-table";

const periodOptions = [
  { key: "2026-10", label: "October 2026", value: "2026-10" },
  { key: "2026-09", label: "September 2026", value: "2026-09" },
  { key: "2026-Q3", label: "Q3 2026", value: "2026-Q3" },
  { key: "2026-YTD", label: "2026 year to date", value: "2026-YTD" },
  { key: "all", label: "All months on file", value: "all" },
];

const ALL_MONTHS = "all";
const DEFAULT_PERIOD = "2026-10";
const DEFAULT_REPORT = "summary";

// The tab label for each report: short, so the row of tabs reads at a glance.
const tabLabels: Record<string, string> = {
  summary: "Summary",
  "pnl-monthly": "Profit & Loss by month",
  "pnl-party": "Profit & Loss by shipper and carrier",
  tax: "Tax (HST/GST)",
  aging: "Aging",
  statements: "Statements",
  accountant: "Accountant export",
};

// How each report is tied to a period. "choose" reports follow the period
// picker; the demo's party P&L and tax summary only cover October, so they
// show that period fixed rather than a picker that changes nothing; aging and
// statements are not period reports.
type PeriodScope = "choose" | "fixed" | "none";

const periodScope: Record<string, PeriodScope> = {
  summary: "choose",
  "pnl-monthly": "choose",
  accountant: "choose",
  "pnl-party": "fixed",
  tax: "fixed",
  aging: "none",
  statements: "none",
};

// The report and period are kept in the URL, so a refresh or a shared link
// opens the same report for the same period.
const urlSchema = z.object({
  report: oneOf(
    mockReports.map((report) => report.key),
    DEFAULT_REPORT
  ),
  period: oneOf(
    periodOptions.map((option) => option.key),
    DEFAULT_PERIOD
  ),
});

const formatIcon = {
  Excel: <PiFileXls className="text-lg" />,
  PDF: <PiFilePdf className="text-lg" />,
  CSV: <PiFileCsv className="text-lg" />,
};

// The API has export_pdf and export_csv only; spreadsheets count as CSV.
const formatPermission = (format: string) =>
  format === "PDF" ? Permission.ReportsExportPdf : Permission.ReportsExportCsv;

const cad = (amount: string) => moneyText(amount, Currency.CAD);
// A null margin % had no revenue to take a percentage of.
const percent = (value: string | null) => (value === null ? "—" : `${value}%`);

// The monthly sheet's rows; the period's total, when there is one, is the
// last row and is marked so it can be set apart.
type PnlRow = MonthlyPnl & { isTotal?: boolean };

const pnlColumns: BaseTableColumn[] = [
  { key: "month", label: "Month" },
  { key: "revenue", label: "Revenue", align: "end" },
  { key: "carrierCost", label: "Carrier Cost", align: "end" },
  { key: "grossMargin", label: "Gross Margin", align: "end" },
  { key: "marginPercent", label: "Margin %", align: "end" },
];

const partyColumns = (side: string): BaseTableColumn[] => [
  { key: "partyName", label: side },
  { key: "shipmentCount", label: "Shipments", align: "end" },
  { key: "revenue", label: "Revenue", align: "end" },
  { key: "carrierCost", label: "Carrier Cost", align: "end" },
  { key: "grossMargin", label: "Gross Margin", align: "end" },
  { key: "marginPercent", label: "Margin %", align: "end" },
];

// The tax table's rows, with the totals as the last one. The totals come
// with the data; nothing is added up here.
type TaxRow = Omit<TaxSummaryRow, "taxableSales" | "taxablePurchases"> & {
  taxableSales: string | null;
  taxablePurchases: string | null;
  isTotal?: boolean;
};

const taxColumns: BaseTableColumn[] = [
  { key: "tax", label: "Province / Tax" },
  { key: "taxableSales", label: "Taxable Sales", align: "end" },
  { key: "taxCollected", label: "Tax Collected", align: "end" },
  { key: "taxablePurchases", label: "Taxable Purchases", align: "end" },
  { key: "inputTaxCredits", label: "Input Tax Credits", align: "end" },
  { key: "netTax", label: "Net", align: "end" },
];

const taxRows: TaxRow[] = [
  ...mockTaxSummary.rows,
  {
    key: "total",
    jurisdiction: "Total",
    taxCode: "",
    ratePercent: "",
    taxableSales: null,
    taxCollected: mockTaxSummary.totals.taxCollected,
    taxablePurchases: null,
    inputTaxCredits: mockTaxSummary.totals.inputTaxCredits,
    netTax: mockTaxSummary.totals.netTax,
    isTotal: true,
  },
];

const taxLabel = (row: TaxRow) =>
  row.isTotal
    ? "Total"
    : `${row.jurisdiction} ${row.taxCode}${row.ratePercent === "0.000" ? "" : ` ${row.ratePercent}%`}`;

// The P&L sheet's rows for a period: its own months, then the period's total
// when it is not a single month. "All months on file" shows every month and
// no total; a period without months on file shows nothing.
const pnlRowsFor = (periodKey: string, summary?: PeriodSummary): PnlRow[] => {
  if (periodKey === ALL_MONTHS) return mockMonthlyPnl;
  const months = mockPeriodMonths[periodKey];
  if (!months || !summary) return [];
  const rows = mockMonthlyPnl.filter((row) => months.includes(row.month));
  if (months.length === 1) return rows;
  return [
    ...rows,
    {
      month: `Total, ${summary.period}`,
      revenue: summary.revenue,
      carrierCost: summary.carrierCost,
      grossMargin: summary.grossMargin,
      marginPercent: summary.marginPercent,
      isTotal: true,
    },
  ];
};

// One line of the period summary: an amount in its currency, or the margin %
// (currency null). Money collected and paid out get a line per currency,
// because they are not converted.
type SummaryField = {
  key: string;
  label: string;
  value: (summary: PeriodSummary) => string;
  currency: Currency | null;
  strong?: boolean;
};

// The summary in three groups, each answering one question.
const summaryGroups: { title: string; hint: string; fields: SummaryField[] }[] = [
  {
    title: "Profit",
    hint: "What MGC billed shippers, what carriers cost, and what was left.",
    fields: [
      { key: "revenue", label: "Revenue", value: (s) => s.revenue, currency: Currency.CAD },
      { key: "carrierCost", label: "Carrier cost", value: (s) => s.carrierCost, currency: Currency.CAD },
      { key: "grossMargin", label: "Gross margin", value: (s) => s.grossMargin, currency: Currency.CAD, strong: true },
      { key: "marginPercent", label: "Margin %", value: (s) => s.marginPercent, currency: null },
    ],
  },
  {
    title: "Sales tax",
    hint: "Tax charged on shipper invoices and claimed back on carrier bills.",
    fields: [
      { key: "taxCollected", label: "Sales tax collected (GST/HST/QST)", value: (s) => s.taxCollected, currency: Currency.CAD },
      { key: "inputTaxCredits", label: "Input tax credits", value: (s) => s.inputTaxCredits, currency: Currency.CAD },
    ],
  },
  {
    title: "Cash in and out",
    hint: "Payments actually received and sent, in their own currency.",
    fields: [
      { key: "collectedCad", label: "Money collected (CAD)", value: (s) => s.collected[Currency.CAD], currency: Currency.CAD },
      { key: "collectedUsd", label: "Money collected (USD)", value: (s) => s.collected[Currency.USD], currency: Currency.USD },
      { key: "paidOutCad", label: "Money paid out (CAD)", value: (s) => s.paidOut[Currency.CAD], currency: Currency.CAD },
      { key: "paidOutUsd", label: "Money paid out (USD)", value: (s) => s.paidOut[Currency.USD], currency: Currency.USD },
    ],
  },
];

const summaryFields = summaryGroups.flatMap((group) => group.fields);

const summaryValue = (summary: PeriodSummary, field: SummaryField) =>
  field.currency
    ? moneyText(field.value(summary), field.currency)
    : percent(field.value(summary));

const SUMMARY_NOTE =
  "CAD at invoice-date rates; money collected and paid out in its own currency";

// Revenue, cost, margin and margin %: shared by the monthly and party P&L.
const pnlExportColumns = <T extends MonthlyPnl | PartyPnl>(): ExportColumn<T>[] => [
  { label: "Revenue (CAD)", value: (row) => cad(row.revenue) },
  { label: "Carrier cost (CAD)", value: (row) => cad(row.carrierCost) },
  { label: "Gross margin (CAD)", value: (row) => cad(row.grossMargin) },
  { label: "Margin %", value: (row) => percent(row.marginPercent) },
];

const agingBuckets: { key: keyof AgingRow; label: string }[] = [
  { key: "current", label: "Current" },
  { key: "days1to30", label: "1-30" },
  { key: "days31to60", label: "31-60" },
  { key: "days61to90", label: "61-90" },
  { key: "days90plus", label: "90+" },
  { key: "disputed", label: "Disputed" },
  { key: "total", label: "Total" },
];

const demo = (covers: string) => `${covers} · CAD · demo data`;

const muted = "text-xs text-[#8F9494]";

// Design §10: one report at a time, picked from the tabs. Each report says
// what it is, which period it covers and what its amounts are in, with its
// own exports beside it; the exports are the table shown. The figures are
// demo data until the API has reports; the Excel (CSV) and PDF (print view)
// exports are real files of them.
export default function Reports() {
  const fromUrl = useListUrlState(urlSchema);
  const [reportKey, setReportKey] = useState(fromUrl.report);
  const { control } = useForm({ defaultValues: { period: fromUrl.period } });
  const periodKey = useWatch({ control, name: "period" });
  useSyncListUrl(
    { report: reportKey, period: periodKey },
    { report: DEFAULT_REPORT, period: DEFAULT_PERIOD }
  );

  const report = mockReports.find((item) => item.key === reportKey) ?? mockReports[0];
  const scope = periodScope[report.key] ?? "none";
  const period = periodOptions.find((option) => option.key === periodKey);
  const summary = mockPeriodSummaries[periodKey];
  const pnlRows = pnlRowsFor(periodKey, summary);
  // The chosen period as the data names it ("October 2026 (MTD)").
  const chosenPeriod = summary?.period ?? period?.label ?? "";
  const { can } = useCan();

  // What each report covers: the period it shows, and what its amounts are in.
  const coverage: Record<string, { period: string; note: string }> = {
    summary: { period: chosenPeriod, note: SUMMARY_NOTE },
    "pnl-monthly": { period: chosenPeriod, note: "CAD at invoice-date rates" },
    "pnl-party": { period: mockPartyPnl.period, note: "CAD · the demo data only has October" },
    tax: { period: mockTaxSummary.period, note: "CAD · the demo data only has October" },
    aging: { period: "Open balances as of now", note: "each currency on its own line, not converted" },
    statements: { period: "Any date range", note: "chosen on the Statements page" },
    accountant: { period: chosenPeriod, note: "CSV for MGC's accounting software" },
  };
  const covers = coverage[report.key];

  // What each report's buttons export: the table shown below it. A report
  // whose table is empty for the period has nothing to export; one without
  // a table ("Accountant Export") is still a demo.
  const exporters: Record<string, ((format: ExportFormat) => void) | null | undefined> = {
    summary: summary
      ? (format) =>
          exportTable<SummaryField>(
            {
              title: "Monthly / Quarterly Summary",
              subtitle: `${summary.period} · ${SUMMARY_NOTE} · demo data`,
              columns: [
                { label: "Measure", value: (row) => row.label },
                { label: summary.period, value: (row) => summaryValue(summary, row) },
              ],
              rows: summaryFields,
            },
            format
          )
      : null,
    "pnl-monthly":
      pnlRows.length > 0
        ? (format) =>
            exportTable<PnlRow>(
              {
                title: "Profit & Loss Monthly Sheet",
                subtitle: demo(chosenPeriod),
                columns: [{ label: "Month", value: (row) => row.month }, ...pnlExportColumns<PnlRow>()],
                rows: pnlRows,
              },
              format
            )
        : null,
    "pnl-party": (format) =>
      exportTable<PartyPnl>(
        {
          title: "Profit & Loss by Shipper and Carrier",
          subtitle: demo(mockPartyPnl.period),
          columns: [
            { label: "Side", value: (row) => (row.type === PartyType.Shipper ? "Shipper" : "Carrier") },
            { label: "Name", value: (row) => row.partyName },
            { label: "Shipments", value: (row) => String(row.shipmentCount) },
            ...pnlExportColumns<PartyPnl>(),
          ],
          rows: [...mockPartyPnl.shippers, ...mockPartyPnl.carriers],
        },
        format
      ),
    aging: (format) =>
      exportTable<AgingRow>(
        {
          title: "Aging (Receivable and Payable)",
          subtitle: "Open balances by days past due · demo data",
          columns: [
            { label: "", value: (row) => row.label },
            ...agingBuckets.map(
              (bucket): ExportColumn<AgingRow> => ({
                label: bucket.label,
                value: (row) => moneyText(row[bucket.key] as string, row.currency),
              })
            ),
          ],
          rows: [...mockAging.receivable, ...mockAging.payable],
        },
        format
      ),
    tax: (format) =>
      exportTable<TaxRow>(
        {
          title: "Tax Report (HST/GST)",
          subtitle: demo(mockTaxSummary.period),
          columns: [
            { label: "Tax", value: taxLabel },
            { label: "Taxable sales", value: (row) => (row.taxableSales ? cad(row.taxableSales) : "") },
            { label: "Collected", value: (row) => cad(row.taxCollected) },
            { label: "Taxable purchases", value: (row) => (row.taxablePurchases ? cad(row.taxablePurchases) : "") },
            { label: "Input tax credits", value: (row) => cad(row.inputTaxCredits) },
            { label: "Net", value: (row) => cad(row.netTax) },
          ],
          rows: taxRows,
        },
        format
      ),
  };

  const exporter = exporters[report.key];

  const exportReport = (format: string) => {
    if (!exporter) {
      toast.info(`${report.title} (${format}, ${covers.period}) — demo only. This export arrives with the API.`);
      return;
    }
    exporter(format as ExportFormat);
  };

  const actions =
    report.key === "statements" ? (
      <BaseButton
        as={Link}
        to="/statements/"
        text="Open Statements"
        varient="bordered"
        className="text-base-primary rounded-xl px-3"
      />
    ) : (
      report.formats
        .filter((format) => can(formatPermission(format)))
        .map((format) => (
          <BaseButton
            key={format}
            text={`Export ${format}`}
            varient="bordered"
            className="text-base-primary rounded-xl px-3"
            startContent={formatIcon[format as keyof typeof formatIcon]}
            isDisabled={exporter === null}
            onPress={() => exportReport(format)}
          />
        ))
    );

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        aria-label="Reports"
        color="primary"
        variant="underlined"
        selectedKey={report.key}
        onSelectionChange={(key) => setReportKey(String(key))}
        // `base` is inline-flex and grows to fit every tab, which widens the
        // page on a phone; capped, the tab list scrolls instead.
        classNames={{
          base: "max-w-full",
          cursor: "bg-base-primary",
        }}
      >
        {mockReports.map((item) => (
          <Tab key={item.key} title={tabLabels[item.key] ?? item.title} />
        ))}
      </Tabs>

      <div className="bg-white rounded-lg shadow-md p-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="min-w-12 h-12 rounded-2xl bg-icon-lightDarkBlue flex items-center justify-center">
              <ReportingIcon className="svg-primary-light" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-base-primary-900">{report.title}</h2>
              <p className={`${muted} mt-1 max-w-2xl`}>{report.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t-2 border-base-default pt-4">
          <span className="text-sm font-semibold text-base-primary">Period</span>
          {scope === "choose" ? (
            <BaseSelect
              name="period"
              control={control}
              options={periodOptions}
              className="w-full sm:w-56"
              classNames={{ trigger: "h-10 rounded-lg", value: "text-sm" }}
              aria-label="Period"
              disallowEmptySelection
            />
          ) : (
            <span className="text-sm font-semibold">{covers.period}</span>
          )}
          <span className={muted}>
            {scope === "choose" && covers.period && <>Showing <strong>{covers.period}</strong> · </>}
            {covers.note} · demo data until the API has reports
          </span>
        </div>
      </div>

      {report.key === "summary" && <SummaryReport summary={summary} />}

      {report.key === "pnl-monthly" && (
        <BaseCardWrapper heading={`Profit & Loss by month: ${chosenPeriod}`}>
          <p className={`${muted} mb-2`}>
            Gross margin = revenue − carrier cost. Revenue counts issued
            invoices only.
          </p>
          {pnlRows.length > 0 ? (
            <BaseTable<PnlRow>
              ariaLabel="Profit & Loss by month"
              columns={pnlColumns}
              data={pnlRows}
              rowKey={(row) => row.month}
              renderCell={(row, key) => {
                const weight = row.isTotal ? "font-semibold" : "";
                return key === "month" ? (
                  <span className="font-semibold whitespace-nowrap">{row.month}</span>
                ) : key === "marginPercent" ? (
                  <span className={weight}>{percent(row.marginPercent)}</span>
                ) : (
                  <Money amount={row[key as keyof MonthlyPnl] as string} currency={Currency.CAD} className={weight} />
                );
              }}
            />
          ) : (
            <EmptyReport>No months on file for {chosenPeriod}.</EmptyReport>
          )}
        </BaseCardWrapper>
      )}

      {report.key === "pnl-party" && (
        <>
          <p className={muted}>
            The same shipments seen from each side: each table adds up to the
            period&apos;s revenue, carrier cost and margin.
          </p>
          <PartyPnlCard title="By shipper" side="Shipper" rows={mockPartyPnl.shippers} />
          <PartyPnlCard title="By carrier" side="Carrier" rows={mockPartyPnl.carriers} />
        </>
      )}

      {report.key === "tax" && (
        <BaseCardWrapper heading={`Tax by province: ${mockTaxSummary.period}`}>
          <p className={`${muted} mb-2`}>
            Tax collected on shipper invoices against input tax credits on
            carrier bills. Net = tax collected − input tax credits.
          </p>
          <BaseTable<TaxRow>
            ariaLabel="Tax report"
            columns={taxColumns}
            data={taxRows}
            rowKey={(row) => row.key}
            renderCell={(row, key) => {
              switch (key) {
                case "tax":
                  return <span className="font-semibold whitespace-nowrap">{taxLabel(row)}</span>;
                case "taxableSales":
                case "taxablePurchases": {
                  const amount = row[key];
                  return amount ? (
                    <Money amount={amount} currency={Currency.CAD} />
                  ) : (
                    <span className="text-gray-400">—</span>
                  );
                }
                case "taxCollected":
                case "inputTaxCredits":
                case "netTax":
                  return (
                    <Money
                      amount={row[key]}
                      currency={Currency.CAD}
                      className={row.isTotal ? "font-semibold" : ""}
                    />
                  );
                default:
                  return null;
              }
            }}
          />
        </BaseCardWrapper>
      )}

      {report.key === "aging" && (
        <>
          <BaseCardWrapper heading="Receivable: what shippers owe MGC">
            <p className={`${muted} mb-2`}>Open shipper invoices, by days past their due date.</p>
            <AgingTable rows={mockAging.receivable} />
          </BaseCardWrapper>
          <BaseCardWrapper heading="Payable: what MGC owes carriers">
            <p className={`${muted} mb-2`}>Open carrier invoices, by days past their due date.</p>
            <AgingTable rows={mockAging.payable} />
          </BaseCardWrapper>
        </>
      )}

      {report.key === "statements" && (
        <BaseCardWrapper heading="Statements">
          <p className="text-sm">
            Statements are made per shipper or carrier on the Statements page,
            where you pick the party and the date range. Use{" "}
            <strong>Open Statements</strong> above.
          </p>
        </BaseCardWrapper>
      )}

      {report.key === "accountant" && (
        <BaseCardWrapper heading={`Accountant export: ${chosenPeriod}`}>
          <p className="text-sm">
            A CSV file of the period&apos;s invoices, notes and payments, for
            import into MGC&apos;s accounting software. There is no preview: it
            arrives with the API.
          </p>
        </BaseCardWrapper>
      )}
    </div>
  );
}

function SummaryReport({ summary }: { summary?: PeriodSummary }) {
  if (!summary) {
    return (
      <BaseCardWrapper heading="Summary">
        <EmptyReport>
          There is no summary for all months on file. Pick a month, a quarter
          or the year to date.
        </EmptyReport>
      </BaseCardWrapper>
    );
  }
  return (
    <BaseCardWrapper heading={`Summary: ${summary.period}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {summaryGroups.map((group) => (
          <div key={group.title} className="flex flex-col gap-2">
            <div>
              <p className="text-sm font-semibold text-base-primary-900">{group.title}</p>
              <p className={muted}>{group.hint}</p>
            </div>
            {group.fields.map((field) => (
              <DetailRow
                key={field.key}
                label={field.label}
                strong={field.strong}
                value={
                  field.currency ? (
                    <Money amount={field.value(summary)} currency={field.currency} />
                  ) : (
                    percent(field.value(summary))
                  )
                }
              />
            ))}
          </div>
        ))}
      </div>
    </BaseCardWrapper>
  );
}

function EmptyReport({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[#8F9494] py-6 text-center">{children}</p>;
}

function PartyPnlCard({
  title,
  side,
  rows,
}: {
  title: string;
  side: string;
  rows: PartyPnl[];
}) {
  return (
    <BaseCardWrapper heading={title}>
      <BaseTable<PartyPnl>
        ariaLabel={`Profit & Loss ${title.toLowerCase()}`}
        columns={partyColumns(side)}
        data={rows}
        rowKey={(row) => row.partyId}
        renderCell={(row, key) => {
          switch (key) {
            case "partyName":
              return <span className="font-semibold">{row.partyName}</span>;
            case "shipmentCount":
              return row.shipmentCount;
            case "marginPercent":
              return percent(row.marginPercent);
            case "revenue":
            case "carrierCost":
            case "grossMargin":
              return <Money amount={row[key]} currency={Currency.CAD} />;
            default:
              return null;
          }
        }}
      />
    </BaseCardWrapper>
  );
}
