import { Card, CardBody } from "@heroui/react";
import { useForm, useWatch } from "react-hook-form";
import { PiFileXls, PiFilePdf, PiFileCsv } from "react-icons/pi";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  AgingTable,
  BaseButton,
  BaseCardWrapper,
  BaseSelect,
  BaseTable,
  DetailRow,
  FilterBar,
  Money,
} from "@/components/common";
import { ReportingIcon } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
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

// The one period the demo's party P&L and tax summary cover.
const BREAKDOWN_PERIOD = "2026-10";

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
  { key: "tax", label: "Tax" },
  { key: "taxableSales", label: "Taxable Sales", align: "end" },
  { key: "taxCollected", label: "Collected", align: "end" },
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
const pnlRowsFor = (periodKey: string, summary?: PeriodSummary): MonthlyPnl[] => {
  if (periodKey === ALL_MONTHS) return mockMonthlyPnl;
  const months = mockPeriodMonths[periodKey];
  if (!months || !summary) return [];
  const rows = mockMonthlyPnl.filter((row) => months.includes(row.month));
  if (months.length === 1) return rows;
  return [
    ...rows,
    {
      month: summary.period,
      revenue: summary.revenue,
      carrierCost: summary.carrierCost,
      grossMargin: summary.grossMargin,
      marginPercent: summary.marginPercent,
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
};

const summaryFields: SummaryField[] = [
  { key: "revenue", label: "Revenue", value: (s) => s.revenue, currency: Currency.CAD },
  { key: "carrierCost", label: "Carrier cost", value: (s) => s.carrierCost, currency: Currency.CAD },
  { key: "grossMargin", label: "Gross margin", value: (s) => s.grossMargin, currency: Currency.CAD },
  { key: "marginPercent", label: "Margin %", value: (s) => s.marginPercent, currency: null },
  { key: "taxCollected", label: "Sales tax collected (GST/HST/QST)", value: (s) => s.taxCollected, currency: Currency.CAD },
  { key: "inputTaxCredits", label: "Input tax credits", value: (s) => s.inputTaxCredits, currency: Currency.CAD },
  { key: "collectedCad", label: "Money collected (CAD)", value: (s) => s.collected[Currency.CAD], currency: Currency.CAD },
  { key: "collectedUsd", label: "Money collected (USD)", value: (s) => s.collected[Currency.USD], currency: Currency.USD },
  { key: "paidOutCad", label: "Money paid out (CAD)", value: (s) => s.paidOut[Currency.CAD], currency: Currency.CAD },
  { key: "paidOutUsd", label: "Money paid out (USD)", value: (s) => s.paidOut[Currency.USD], currency: Currency.USD },
];

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

// Design §10: every report with its exports, and the reports themselves for
// the chosen period. The figures are demo data until the API has reports;
// the Excel (CSV) and PDF (print view) exports are real files of them.
export default function Reports() {
  const { control } = useForm({ defaultValues: { period: "2026-10" } });
  const periodKey = useWatch({ control, name: "period" });
  const period = periodOptions.find((option) => option.key === periodKey);
  const summary = mockPeriodSummaries[periodKey];
  const pnlRows = pnlRowsFor(periodKey, summary);
  const { can } = useCan();

  const breakdownNote = (covers: string) =>
    periodKey === BREAKDOWN_PERIOD
      ? `${covers}, CAD.`
      : `Showing ${covers}: the demo data only has October.`;

  // What each report card's buttons export: the table shown below it. A
  // report without one ("Accountant Export") is still a demo.
  const exporters: Record<string, ((format: ExportFormat) => void) | undefined> = {
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
      : undefined,
    "pnl-monthly": (format) =>
      exportTable<MonthlyPnl>(
        {
          title: "P&L Monthly Sheet",
          subtitle: demo(period?.label ?? ""),
          columns: [{ label: "Month", value: (row) => row.month }, ...pnlExportColumns<MonthlyPnl>()],
          rows: pnlRows,
        },
        format
      ),
    "pnl-party": (format) =>
      exportTable<PartyPnl>(
        {
          title: "P&L by Shipper and Carrier",
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

  const exportReport = (key: string, title: string, format: string) => {
    const run = exporters[key];
    if (!run) {
      toast.info(`${title} (${format}, ${period?.label}) — demo only. This export arrives with the API.`);
      return;
    }
    run(format as ExportFormat);
  };

  return (
    <div className="flex flex-col gap-6">
      <FilterBar>
        <span className="text-sm font-semibold text-base-primary">Period</span>
        <BaseSelect
          name="period"
          control={control}
          options={periodOptions}
          className="w-full sm:w-56"
          classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
          aria-label="Period"
          disallowEmptySelection
        />
        <span className="text-xs text-[#8F9494]">Demo data until the API has reports.</span>
      </FilterBar>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {mockReports.map((report) => (
          <Card key={report.key} className="bg-white">
            <CardBody className="flex flex-col justify-between gap-4 p-4">
              <div className="flex gap-3">
                <div className="min-w-12 h-12 rounded-2xl bg-icon-lightDarkBlue flex items-center justify-center">
                  <ReportingIcon className="svg-primary-light" />
                </div>
                <div>
                  <p className="font-semibold text-base-primary-900">{report.title}</p>
                  <p className="text-xs text-[#8F9494] mt-1">{report.description}</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                {report.key === "statements" ? (
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
                        text={format}
                        varient="bordered"
                        className="text-base-primary rounded-xl px-3"
                        startContent={formatIcon[format as keyof typeof formatIcon]}
                        onPress={() => exportReport(report.key, report.title, format)}
                      />
                    ))
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {summary && (
        <BaseCardWrapper heading={`Summary: ${summary.period}`}>
          <p className="text-xs text-[#8F9494] mb-2">{SUMMARY_NOTE}.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
            {summaryFields.map((field) => (
              <DetailRow
                key={field.key}
                label={field.label}
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
        </BaseCardWrapper>
      )}

      <BaseCardWrapper heading="P&L Monthly Sheet (CAD)">
        <BaseTable<MonthlyPnl>
          ariaLabel="P&L monthly"
          columns={pnlColumns}
          data={pnlRows}
          rowKey={(row) => row.month}
          renderCell={(row, key) =>
            key === "month" ? (
              <span className="font-semibold">{row.month}</span>
            ) : key === "marginPercent" ? (
              percent(row.marginPercent)
            ) : (
              <Money amount={row[key as keyof MonthlyPnl]} currency={Currency.CAD} />
            )
          }
        />
      </BaseCardWrapper>

      <div className="flex flex-col gap-6">
        <PartyPnlCard
          title="P&L by Shipper"
          side="Shipper"
          rows={mockPartyPnl.shippers}
          note={breakdownNote(mockPartyPnl.period)}
        />
        <PartyPnlCard
          title="P&L by Carrier"
          side="Carrier"
          rows={mockPartyPnl.carriers}
          note={breakdownNote(mockPartyPnl.period)}
        />
      </div>

      <BaseCardWrapper heading="Tax Report (HST/GST)">
        <p className="text-xs text-[#8F9494] mb-2">
          {breakdownNote(mockTaxSummary.period)} Tax collected on shipper
          invoices against input tax credits on carrier bills.
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

      <BaseCardWrapper heading="Aging">
        <AgingTable rows={[...mockAging.receivable, ...mockAging.payable]} />
      </BaseCardWrapper>
    </div>
  );
}

function PartyPnlCard({
  title,
  side,
  rows,
  note,
}: {
  title: string;
  side: string;
  rows: PartyPnl[];
  note: string;
}) {
  return (
    <BaseCardWrapper heading={title}>
      <p className="text-xs text-[#8F9494] mb-2">{note}</p>
      <BaseTable<PartyPnl>
        ariaLabel={title}
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
