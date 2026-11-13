import { Card, CardBody } from "@heroui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { PiFileCsv, PiFilePdf, PiFileXls } from "react-icons/pi";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  AgingTable,
  BaseButton,
  BaseCardWrapper,
  BaseSelect,
  BaseTable,
  DetailRow,
  ErrorState,
  FilterBar,
  Money,
} from "@/components/common";
import { ReportingIcon } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
import { useFileDownload, useServerPaging } from "@/hooks";
import { Currency, PartyType, Permission } from "@/lib/enums";
import {
  FxGainLossRow,
  MonthlyPnl,
  PartyAgingRow,
  PartyPnl,
  ReportSummary,
  ShipmentPnl,
  TaxSummaryRow,
} from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import { formatDate, torontoToday } from "@/lib/utils";
import {
  exportReport,
  getAging,
  getFxGainLoss,
  getMonthlyPnl,
  getPartyAging,
  getPartyPnl,
  getReportSummary,
  getTaxReport,
  listShipmentPnl,
  ReportFormat,
  ReportKind,
} from "@/services";

type PeriodOption = { key: string; label: string; value: string };

const monthName = (year: number, month: number) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

// The periods to pick from, as of today in Toronto: this month and the two
// before, this quarter and the one before, the year to date and last year.
// The API refuses a period in the future, so none is offered.
const periodOptions = (today: string): PeriodOption[] => {
  const [year, month] = today.split("-").map(Number);
  const months = [0, 1, 2].map((back) => {
    const index = year * 12 + (month - 1) - back;
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    return { key, label: `${monthName(y, m)}${back === 0 ? " (to date)" : ""}`, value: key };
  });
  const quarter = Math.ceil(month / 3);
  const [prevYear, prevQuarter] = quarter === 1 ? [year - 1, 4] : [year, quarter - 1];
  return [
    ...months,
    { key: `${year}-Q${quarter}`, label: `Q${quarter} ${year} (to date)`, value: `${year}-Q${quarter}` },
    { key: `${prevYear}-Q${prevQuarter}`, label: `Q${prevQuarter} ${prevYear}`, value: `${prevYear}-Q${prevQuarter}` },
    { key: `${year}-YTD`, label: `${year} year to date`, value: `${year}-YTD` },
    { key: `${year - 1}`, label: `${year - 1}`, value: `${year - 1}` },
  ];
};

type ReportCard = {
  key: string;
  title: string;
  description: string;
  // The API's export; none for the Statements link or the accountant export.
  kind?: ReportKind;
};

const reportCards: ReportCard[] = [
  {
    key: "summary",
    kind: "summary",
    title: "Monthly / Quarterly Summary",
    description:
      "Revenue, carrier cost, gross margin, GST/HST collected and paid, money collected and paid out, bad debts and exchange gain or loss.",
  },
  {
    key: "pnl-monthly",
    kind: "pnl/monthly",
    title: "P&L Monthly Sheet",
    description: "Month-by-month revenue − carrier cost = gross margin, margin %.",
  },
  {
    key: "pnl-party",
    kind: "pnl/party",
    title: "P&L by Shipper / Carrier",
    description: "Revenue, cost, margin and margin % for each, a sheet per side.",
  },
  {
    key: "pnl-shipment",
    kind: "pnl/shipment",
    title: "P&L by Shipment",
    description: "Every shipment in the period, biggest revenue first.",
  },
  {
    key: "aging",
    kind: "aging/party",
    title: "Aging (Receivable and Payable)",
    description:
      "Current, 1–30, 31–60, 61–90, 90+ per party as of today, with disputed amounts in their own column.",
  },
  {
    key: "tax",
    kind: "tax",
    title: "Tax Report (HST/GST)",
    description:
      "Tax collected on shipper invoices against input tax credits on carrier bills and bad-debt relief, by tax.",
  },
  {
    key: "fx",
    kind: "fx",
    title: "Exchange Gain / Loss",
    description: "What the USD rate change did to each payment on a USD invoice, in CAD.",
  },
  {
    key: "statements",
    title: "Statements",
    description: "Per shipper or carrier, with PDF and Excel copies.",
  },
  {
    key: "accountant",
    title: "Accountant Export",
    description:
      "Invoices, notes and payments for a period, for import into MGC's accounting software.",
  },
];

const exportFileName = (kind: ReportKind, period: string, format: ReportFormat) =>
  `${kind.replace("/", "-")}${kind === "aging/party" ? "" : `-${period}`}.${format}`;

const percent = (value: string) => `${value}%`;

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

const shipmentColumns: BaseTableColumn[] = [
  { key: "load", label: "Load" },
  { key: "shipper", label: "Shipper" },
  { key: "carrier", label: "Carrier" },
  { key: "revenue", label: "Revenue", align: "end" },
  { key: "carrierCost", label: "Carrier Cost", align: "end" },
  { key: "grossMargin", label: "Gross Margin", align: "end" },
  { key: "marginPercent", label: "Margin %", align: "end" },
];

// The tax table's rows, with the API's totals as the last one.
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
  { key: "badDebtRelief", label: "Bad-Debt Relief", align: "end" },
  { key: "netTax", label: "Net", align: "end" },
];

const taxLabel = (row: TaxRow) =>
  row.isTotal
    ? "Total"
    : `${row.jurisdiction} ${row.taxCode}${Number(row.ratePercent) === 0 ? "" : ` ${row.ratePercent}%`}`;

const fxColumns: BaseTableColumn[] = [
  { key: "allocatedOn", label: "Date" },
  { key: "party", label: "Party" },
  { key: "invoice", label: "Invoice / Payment" },
  { key: "amount", label: "Amount", align: "end" },
  { key: "rates", label: "Rates", align: "end" },
  { key: "billedCad", label: "Billed (CAD)", align: "end" },
  { key: "settledCad", label: "Settled (CAD)", align: "end" },
  { key: "gainLoss", label: "Gain / Loss", align: "end" },
];

const partyAgingColumns: BaseTableColumn[] = [
  { key: "party", label: "Party" },
  { key: "current", label: "Current", align: "end" },
  { key: "days1to30", label: "1–30", align: "end" },
  { key: "days31to60", label: "31–60", align: "end" },
  { key: "days61to90", label: "61–90", align: "end" },
  { key: "days90plus", label: "90+", align: "end" },
  { key: "disputed", label: "Disputed", align: "end" },
  { key: "total", label: "Total", align: "end" },
];

type SummaryField = {
  key: Exclude<keyof ReportSummary, "period" | "expectedBills" | "leftOutNoRate">;
  label: string;
};

const summaryFields: SummaryField[] = [
  { key: "revenue", label: "Revenue" },
  { key: "carrierCost", label: "Carrier cost" },
  { key: "grossMargin", label: "Gross margin" },
  { key: "marginPercent", label: "Margin %" },
  { key: "taxCollected", label: "GST/HST collected" },
  { key: "inputTaxCredits", label: "Input tax credits" },
  { key: "collected", label: "Money collected" },
  { key: "paidOut", label: "Money paid out" },
  { key: "badDebts", label: "Bad debts written off" },
  { key: "badDebtRelief", label: "Bad-debt GST/HST relief" },
  { key: "fxGainLoss", label: "Exchange gain / loss" },
];

const cad = (amount: string, bold = false) => (
  <Money amount={amount} currency={Currency.CAD} className={bold ? "font-semibold" : undefined} />
);

// What a summary's CAD figures could not include.
const leftOutText = (summary: ReportSummary) => {
  const { shipperInvoices, carrierBills, payments, writeOffs } = summary.leftOutNoRate;
  const parts = [
    shipperInvoices && `${shipperInvoices} shipper invoice${shipperInvoices === 1 ? "" : "s"}`,
    carrierBills && `${carrierBills} carrier bill${carrierBills === 1 ? "" : "s"}`,
    payments && `${payments} payment${payments === 1 ? "" : "s"}`,
    writeOffs && `${writeOffs} write-off${writeOffs === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return parts.length
    ? `Left out for want of a USD rate: ${parts.join(", ")}.`
    : null;
};

// Design §10: every report for the chosen period, worked out by the API in
// CAD at each record's own rate, with the API's Excel and PDF of each.
export default function Reports() {
  const options = periodOptions(torontoToday());
  const { control } = useForm({ defaultValues: { period: options[0].value } });
  const period = useWatch({ control, name: "period" });
  const periodLabel = options.find((option) => option.key === period)?.label ?? period;
  const { can } = useCan();

  const summary = useQuery({
    queryKey: ["report", "summary", period],
    queryFn: ({ signal }) => getReportSummary(period, signal),
  });
  const monthly = useQuery({
    queryKey: ["report", "pnl", "monthly", period],
    queryFn: ({ signal }) => getMonthlyPnl(period, signal),
  });
  const party = useQuery({
    queryKey: ["report", "pnl", "party", period],
    queryFn: ({ signal }) => getPartyPnl(period, signal),
  });
  const tax = useQuery({
    queryKey: ["report", "tax", period],
    queryFn: ({ signal }) => getTaxReport(period, signal),
  });
  const fx = useQuery({
    queryKey: ["report", "fx", period],
    queryFn: ({ signal }) => getFxGainLoss(period, signal),
  });
  const aging = useQuery({
    queryKey: ["accounts", "aging"],
    queryFn: ({ signal }) => getAging(signal),
  });
  const partyAging = useQuery({
    queryKey: ["report", "aging", "party"],
    queryFn: ({ signal }) => getPartyAging(signal),
  });

  const download = useFileDownload(
    ({ kind, format }: { kind: ReportKind; format: ReportFormat }) =>
      exportReport(kind, period, format, exportFileName(kind, period, format))
  );
  const downloading = (kind: ReportKind, format: ReportFormat) =>
    download.isPending &&
    download.variables?.kind === kind &&
    download.variables.format === format;

  const monthRows: (MonthlyPnl & { isTotal?: boolean })[] = monthly.data
    ? [
        ...monthly.data.months,
        // A single month's total is that month again.
        ...(monthly.data.months.length > 1
          ? [{ ...monthly.data.total, month: "Total", isTotal: true }]
          : []),
      ]
    : [];

  const taxRows: TaxRow[] = tax.data
    ? [
        ...tax.data.rows,
        {
          key: "total",
          jurisdiction: "Total",
          taxCode: "",
          ratePercent: "",
          taxableSales: null,
          taxCollected: tax.data.totals.taxCollected,
          taxablePurchases: null,
          inputTaxCredits: tax.data.totals.inputTaxCredits,
          badDebtRelief: tax.data.totals.badDebtRelief,
          netTax: tax.data.totals.netTax,
          isTotal: true,
        },
      ]
    : [];

  const agingRows = [
    ...(aging.data?.receivable ?? []),
    ...(aging.data?.payable ?? []),
  ];
  const partyAgingRows = [
    ...(partyAging.data?.receivable ?? []),
    ...(partyAging.data?.payable ?? []),
  ];

  const exportButtons = (card: ReportCard) => {
    if (card.key === "statements") {
      return (
        <BaseButton
          as={Link}
          to="/statements/"
          text="Open Statements"
          varient="bordered"
          className="text-base-primary rounded-xl px-3"
        />
      );
    }
    const kind = card.kind;
    if (!kind) {
      return (
        can(Permission.ReportsExportCsv) && (
          <BaseButton
            text="CSV"
            varient="bordered"
            className="text-base-primary rounded-xl px-3"
            startContent={<PiFileCsv className="text-lg" />}
            onPress={() =>
              toast.info(`${card.title} (${periodLabel}) — demo only. It waits on the choice of accounting software.`)
            }
          />
        )
      );
    }
    return (
      <>
        {can(Permission.ReportsExportCsv) && (
          <BaseButton
            text="Excel"
            varient="bordered"
            className="text-base-primary rounded-xl px-3"
            startContent={<PiFileXls className="text-lg" />}
            isLoading={downloading(kind, "xlsx")}
            onPress={() => download.mutate({ kind, format: "xlsx" })}
          />
        )}
        {can(Permission.ReportsExportPdf) && (
          <BaseButton
            text="PDF"
            varient="bordered"
            className="text-base-primary rounded-xl px-3"
            startContent={<PiFilePdf className="text-lg" />}
            isLoading={downloading(kind, "pdf")}
            onPress={() => download.mutate({ kind, format: "pdf" })}
          />
        )}
      </>
    );
  };

  const s = summary.data;
  const leftOut = s ? leftOutText(s) : null;

  return (
    <div className="flex flex-col gap-6">
      <FilterBar>
        <span className="text-sm font-semibold text-base-primary">Period</span>
        <BaseSelect
          name="period"
          control={control}
          options={options}
          className="w-full sm:w-56"
          classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
          aria-label="Period"
          disallowEmptySelection
        />
        <span className="text-xs text-[#8F9494]">
          CAD, each invoice at its own rate, by invoice date.
        </span>
      </FilterBar>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {reportCards.map((card) => (
          <Card key={card.key} className="bg-white">
            <CardBody className="flex flex-col justify-between gap-4 p-4">
              <div className="flex gap-3">
                <div className="min-w-12 h-12 rounded-2xl bg-icon-lightDarkBlue flex items-center justify-center">
                  <ReportingIcon className="svg-primary-light" />
                </div>
                <div>
                  <p className="font-semibold text-base-primary-900">{card.title}</p>
                  <p className="text-xs text-[#8F9494] mt-1">{card.description}</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">{exportButtons(card)}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      <BaseCardWrapper heading={`Summary: ${s?.period.label ?? periodLabel} (CAD)`}>
        {summary.isError ? (
          <ErrorState
            message="We couldn't load the summary. Please try again."
            onAction={() => void summary.refetch()}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              {summaryFields.map((field) => (
                <DetailRow
                  key={field.key}
                  label={field.label}
                  value={
                    !s
                      ? "—"
                      : field.key === "marginPercent"
                        ? percent(s.marginPercent)
                        : cad(s[field.key])
                  }
                />
              ))}
            </div>
            {s && (
              <div className="flex flex-col gap-1 mt-3 text-xs text-[#8F9494]">
                {s.period.toDate && <p>The period is still running: the figures will grow.</p>}
                {s.expectedBills.count > 0 && (
                  <p>
                    {s.expectedBills.count} carrier bill{s.expectedBills.count === 1 ? "" : "s"} not
                    received yet (expected {cad(s.expectedBills.amount)}) are not in the carrier
                    cost.
                  </p>
                )}
                {leftOut && <p>{leftOut}</p>}
              </div>
            )}
          </>
        )}
      </BaseCardWrapper>

      <BaseCardWrapper heading="P&L Monthly Sheet (CAD)">
        {monthly.isError ? (
          <ErrorState
            message="We couldn't load the monthly P&L. Please try again."
            onAction={() => void monthly.refetch()}
          />
        ) : (
          <BaseTable<MonthlyPnl & { isTotal?: boolean }>
            ariaLabel="P&L monthly"
            columns={pnlColumns}
            data={monthRows}
            loading={monthly.isPending}
            rowKey={(row) => row.month}
            emptyContent="Nothing in this period"
            renderCell={(row, key) =>
              key === "month" ? (
                <span className="font-semibold">{row.month}</span>
              ) : key === "marginPercent" ? (
                percent(row.marginPercent)
              ) : (
                cad(row[key as keyof MonthlyPnl], row.isTotal)
              )
            }
          />
        )}
      </BaseCardWrapper>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PartyPnlCard
          title="P&L by Shipper"
          side="Shipper"
          rows={party.data?.shippers ?? []}
          loading={party.isPending}
          failed={party.isError}
          retry={() => void party.refetch()}
        />
        <PartyPnlCard
          title="P&L by Carrier"
          side="Carrier"
          rows={party.data?.carriers ?? []}
          loading={party.isPending}
          failed={party.isError}
          retry={() => void party.refetch()}
        />
      </div>

      <ShipmentPnlCard period={period} />

      <BaseCardWrapper heading="Tax Report (HST/GST)">
        <p className="text-xs text-[#8F9494] mb-2">
          Tax collected on shipper invoices against input tax credits on
          carrier bills and the relief on bad debts written off, CAD.
        </p>
        {tax.isError ? (
          <ErrorState
            message="We couldn't load the tax report. Please try again."
            onAction={() => void tax.refetch()}
          />
        ) : (
          <BaseTable<TaxRow>
            ariaLabel="Tax report"
            columns={taxColumns}
            data={taxRows}
            loading={tax.isPending}
            rowKey={(row) => row.key}
            renderCell={(row, key) => {
              switch (key) {
                case "tax":
                  return <span className="font-semibold whitespace-nowrap">{taxLabel(row)}</span>;
                case "taxableSales":
                case "taxablePurchases": {
                  const amount = row[key];
                  return amount ? cad(amount) : <span className="text-gray-400">—</span>;
                }
                case "taxCollected":
                case "inputTaxCredits":
                case "badDebtRelief":
                case "netTax":
                  return cad(row[key], row.isTotal);
                default:
                  return null;
              }
            }}
          />
        )}
      </BaseCardWrapper>

      <BaseCardWrapper heading="Exchange Gain / Loss (CAD)">
        {fx.isError ? (
          <ErrorState
            message="We couldn't load the exchange gain and loss. Please try again."
            onAction={() => void fx.refetch()}
          />
        ) : (
          <>
            <BaseTable<FxGainLossRow>
              ariaLabel="Exchange gain and loss"
              columns={fxColumns}
              data={fx.data?.rows ?? []}
              loading={fx.isPending}
              rowKey={(row) => row.allocationId}
              emptyContent="No USD payments allocated in this period"
              renderCell={(row, key) => {
                switch (key) {
                  case "allocatedOn":
                    return <span className="whitespace-nowrap">{formatDate(row.allocatedOn)}</span>;
                  case "party":
                    return (
                      <div className="flex flex-col">
                        <span className="font-semibold">{row.partyName}</span>
                        <span className="text-gray-500">
                          {row.type === PartyType.Shipper ? "Shipper" : "Carrier"}
                        </span>
                      </div>
                    );
                  case "invoice":
                    return (
                      <span className="whitespace-nowrap">
                        {row.invoiceNumber ?? "No number"} · {row.paymentNumber}
                      </span>
                    );
                  case "amount":
                    return <Money amount={row.amount} currency={row.currency} />;
                  case "rates":
                    return (
                      <span className="whitespace-nowrap">
                        {row.invoiceRate} → {row.paymentRate}
                      </span>
                    );
                  case "billedCad":
                  case "settledCad":
                    return cad(row[key]);
                  case "gainLoss":
                    return cad(row.gainLoss, true);
                  default:
                    return null;
                }
              }}
            />
            {fx.data && (
              <div className="flex flex-col gap-2 border-t-2 border-base-default pt-4 mt-2">
                <DetailRow label="Shippers" value={cad(fx.data.totals.shippers)} />
                <DetailRow label="Carriers" value={cad(fx.data.totals.carriers)} />
                <DetailRow label="Net gain / loss" value={cad(fx.data.totals.net, true)} />
                {fx.data.leftOutNoRate > 0 && (
                  <p className="text-xs text-[#8F9494]">
                    {fx.data.leftOutNoRate} allocation{fx.data.leftOutNoRate === 1 ? "" : "s"} left
                    out: the invoice or the payment has no rate.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </BaseCardWrapper>

      <BaseCardWrapper heading="Aging">
        <p className="text-xs text-[#8F9494] mb-2">Open balances by days past due, as of today.</p>
        {aging.isError ? (
          <ErrorState
            message="We couldn't load the aging. Please try again."
            onAction={() => void aging.refetch()}
          />
        ) : (
          <AgingTable rows={agingRows} />
        )}
        <h3 className="text-base-primary font-semibold mt-4 mb-2">By party</h3>
        {partyAging.isError ? (
          <ErrorState
            message="We couldn't load the aging by party. Please try again."
            onAction={() => void partyAging.refetch()}
          />
        ) : (
          <BaseTable<PartyAgingRow>
            ariaLabel="Aging by party"
            columns={partyAgingColumns}
            data={partyAgingRows}
            loading={partyAging.isPending}
            rowKey={(row) => `${row.type}-${row.partyId}-${row.currency}`}
            emptyContent="Nothing owed either way"
            renderCell={(row, key) =>
              key === "party" ? (
                <div className="flex flex-col">
                  <span className="font-semibold">{row.partyName}</span>
                  <span className="text-gray-500">
                    {row.type === PartyType.Shipper ? "Receivable" : "Payable"} · {row.currency}
                  </span>
                </div>
              ) : (
                <Money
                  amount={row[key as keyof PartyAgingRow] as string}
                  currency={row.currency}
                  className={key === "total" ? "font-semibold" : undefined}
                />
              )
            }
          />
        )}
      </BaseCardWrapper>
    </div>
  );
}

function PartyPnlCard({
  title,
  side,
  rows,
  loading,
  failed,
  retry,
}: {
  title: string;
  side: string;
  rows: PartyPnl[];
  loading: boolean;
  failed: boolean;
  retry: () => void;
}) {
  return (
    <BaseCardWrapper heading={title}>
      {failed ? (
        <ErrorState message="We couldn't load the P&L by party. Please try again." onAction={retry} />
      ) : (
        <BaseTable<PartyPnl>
          ariaLabel={title}
          columns={partyColumns(side)}
          data={rows}
          loading={loading}
          rowKey={(row) => row.partyId ?? `none-${row.type}`}
          emptyContent="Nothing in this period"
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
                return cad(row[key]);
              default:
                return null;
            }
          }}
        />
      )}
    </BaseCardWrapper>
  );
}

// Every shipment's P&L for the period, paged by the API.
function ShipmentPnlCard({ period }: { period: string }) {
  const paging = useServerPaging(period);
  const params = { period, page: paging.page, limit: paging.limit };
  const shipments = useQuery({
    queryKey: ["report", "pnl", "shipment", params],
    queryFn: ({ signal }) => listShipmentPnl(params, signal),
    placeholderData: keepPreviousData,
  });

  return (
    <BaseCardWrapper heading="P&L by Shipment (CAD)">
      {shipments.isError ? (
        <ErrorState
          message="We couldn't load the P&L by shipment. Please try again."
          onAction={() => void shipments.refetch()}
        />
      ) : (
        <BaseTable<ShipmentPnl>
          ariaLabel="P&L by shipment"
          columns={shipmentColumns}
          data={shipments.data?.items ?? []}
          loading={shipments.isPending}
          refreshing={shipments.isPlaceholderData}
          rowKey={(row) => row.shipmentId}
          meta={paging.tableMeta(shipments.data?.meta)}
          setMeta={paging.setMeta}
          bottomContent="Shipments"
          emptyContent="No shipments in this period"
          renderCell={(row, key) => {
            switch (key) {
              case "load":
                return <span className="font-semibold whitespace-nowrap">{row.loadNumber}</span>;
              case "shipper":
                return row.shipperName;
              case "carrier":
                return row.carrierName ?? <span className="text-gray-400">No carrier</span>;
              case "marginPercent":
                return percent(row.marginPercent);
              case "revenue":
              case "carrierCost":
              case "grossMargin":
                return cad(row[key]);
              default:
                return null;
            }
          }}
        />
      )}
    </BaseCardWrapper>
  );
}
