import { Card, CardBody, Radio, RadioGroup } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BsTruck } from "react-icons/bs";
import { HiOutlineCurrencyDollar } from "react-icons/hi2";
import { LuClock, LuFileWarning } from "react-icons/lu";
import { PiHandCoins, PiReceipt } from "react-icons/pi";
import { TbArrowsShuffle } from "react-icons/tb";
import { Link } from "react-router";
import {
  AgingTable,
  AlertBanner,
  BarChart,
  BaseButton,
  ErrorState,
  LineChart,
  SectionTitle,
  StatCard,
} from "@/components/common";
import { useCan } from "@/components/providers/user-provider";
import { Currency, PartyType, Permission } from "@/lib/enums";
import {
  CurrencyAmounts,
  DashboardSummary,
  ExcludedFromCad,
  MonthlyPnl,
  PartyAccountSummary,
} from "@/lib/interfaces";
import { formatMoney } from "@/lib/money";
import { fullName, torontoToday } from "@/lib/utils";
import {
  getAging,
  getDashboard,
  getMonthlyPnl,
  listAccountSummaries,
} from "@/services";
import RecentInvoices from "./recent-invoices";

type TotalsView = "CAD" | "USD" | "IN_CAD";

const totalsLabel: Record<TotalsView, string> = {
  CAD: "CAD invoices",
  USD: "USD invoices",
  IN_CAD: "All, in CAD at invoice-date rates",
};

// How many parties each payment-cycle list shows.
const CYCLE_ROWS = 8;

// One side of the outstanding totals; "—" when the role may not see it.
const sideTotal = (
  view: TotalsView,
  amounts: CurrencyAmounts | null,
  inCad: string | null
) =>
  view === "IN_CAD"
    ? formatMoney(inCad, Currency.CAD)
    : formatMoney(amounts?.[view], view as Currency);

const leftOutText = (label: string, excluded: ExcludedFromCad | null) =>
  excluded && excluded.invoiceCount > 0
    ? `${label}: ${excluded.invoiceCount} USD invoice${
        excluded.invoiceCount === 1 ? "" : "s"
      } (${formatMoney(excluded.amount, Currency.USD) ?? "—"}) left out, no rate yet`
    : null;

// Chart series are numbers for drawing only; no figure is read back from them.
const chartSeries = (months: MonthlyPnl[], key: keyof MonthlyPnl) =>
  months.map((month) => Number(month[key]));

// mokal-app's admin dashboard layout: welcome header, chart beside a grid of
// KPI cards, two panels, then a recent-items table. Figures are design §9/§10,
// all from the Accounts API.
export default function Dashboard() {
  const { me: user, can } = useCan();
  const [view, setView] = useState<TotalsView>("CAD");
  const canViewReports = can(Permission.ReportsView);
  const canViewShippers = can(Permission.CustomerInvoicesView);
  const canViewCarriers = can(Permission.CarrierInvoicesView);

  const dashboard = useQuery({
    queryKey: ["account", "dashboard"],
    queryFn: ({ signal }) => getDashboard(signal),
  });
  const aging = useQuery({
    queryKey: ["account", "aging"],
    queryFn: ({ signal }) => getAging(signal),
  });
  const year = torontoToday().slice(0, 4);
  const pnl = useQuery({
    queryKey: ["report", "pnl", "monthly", `${year}-YTD`],
    queryFn: ({ signal }) => getMonthlyPnl(`${year}-YTD`, signal),
    enabled: canViewReports,
  });

  const d = dashboard.data;
  const months = pnl.data?.months ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base">
          Welcome back, <strong>{fullName(user)}</strong>
        </h3>
        <h1 className="text-2xl sm:text-3xl">Your Dashboard</h1>
      </div>

      {d && d.needsReview > 0 && (
        <AlertBanner
          message={`${d.needsReview} invoice${
            d.needsReview === 1 ? " needs" : "s need"
          } a look before going out: missing reference numbers, TMS code or rate, or terms that differ from the agreement.`}
          action={
            <BaseButton
              as={Link}
              to="/needs-review/"
              text="Review"
              varient="light"
              className="text-base-primary"
            />
          }
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white">
          <CardBody className="p-4">
            <ChartPanel
              allowed={canViewReports}
              isError={pnl.isError}
              onRetry={() => void pnl.refetch()}
            >
              <LineChart
                title={`Revenue vs carrier cost (CAD), ${pnl.data?.period.label ?? year}`}
                categories={months.map((m) => m.month)}
                series={[
                  { name: "Revenue", data: chartSeries(months, "revenue") },
                  { name: "Carrier cost", data: chartSeries(months, "carrierCost") },
                ]}
              />
            </ChartPanel>
          </CardBody>
        </Card>
        {dashboard.isError ? (
          <Card className="bg-white">
            <CardBody>
              <ErrorState
                message="We couldn't load the dashboard figures. Please try again."
                onAction={() => void dashboard.refetch()}
              />
            </CardBody>
          </Card>
        ) : (
          <KpiCards d={d} view={view} setView={setView} />
        )}
      </div>

      <div className="grid lg:grid-cols-2 grid-cols-1 gap-6">
        <div className="bg-white shadow-xs border p-4 rounded-xl flex flex-col gap-4">
          <SectionTitle icon={<PiReceipt />} title="Gross Margin by Month" />
          <ChartPanel
            allowed={canViewReports}
            isError={pnl.isError}
            onRetry={() => void pnl.refetch()}
          >
            <BarChart
              categories={months.map((m) => m.month)}
              series={[
                { name: "Gross margin (CAD)", data: chartSeries(months, "grossMargin") },
              ]}
            />
          </ChartPanel>
        </div>
        <div className="bg-white shadow-xs border p-4 rounded-xl flex flex-col gap-4">
          <SectionTitle
            icon={<LuClock />}
            title="Aging"
            action={
              <Link to="/reports/" className="text-sm text-[#8F9494]">
                Full report
              </Link>
            }
          />
          {aging.isError ? (
            <ErrorState
              message="We couldn't load the aging."
              onAction={() => void aging.refetch()}
            />
          ) : aging.isPending ? (
            <p className="text-sm text-content-5">Loading…</p>
          ) : (
            <AgingTable
              rows={[...(aging.data.receivable ?? []), ...(aging.data.payable ?? [])]}
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CycleCard
              label="Avg. payment cycle — shippers"
              days={d?.averagePaymentCycleDays.shipper}
            />
            <CycleCard
              label="Avg. payment cycle — carriers"
              days={d?.averagePaymentCycleDays.carrier}
            />
          </div>
        </div>
      </div>

      {(canViewShippers || canViewCarriers) && (
        <div className="bg-white shadow-xs border p-4 rounded-xl flex flex-col gap-4">
          <SectionTitle
            icon={<LuClock />}
            title="Average Payment Cycle by Party"
            action={
              <Link to="/statements/" className="text-sm text-[#8F9494]">
                Statements
              </Link>
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {canViewShippers && (
              <PaymentCycleList title="Shippers (days to pay us)" type={PartyType.Shipper} />
            )}
            {canViewCarriers && (
              <PaymentCycleList
                title="Carriers (days we take to pay)"
                type={PartyType.Carrier}
              />
            )}
          </div>
        </div>
      )}

      {canViewShippers && (
        <div className="bg-white shadow-xs border p-4 rounded-xl flex flex-col gap-4">
          <SectionTitle icon={<BsTruck />} title="Recent Shipper Invoices" />
          <RecentInvoices />
        </div>
      )}
    </div>
  );
}

// The outstanding totals and the four KPI cards. Until the figures load, and
// for a side the role may not see, a card shows "—", never "0".
function KpiCards({
  d,
  view,
  setView,
}: {
  d: DashboardSummary | undefined;
  view: TotalsView;
  setView: (view: TotalsView) => void;
}) {
  const receivable = d ? sideTotal(view, d.receivable, d.receivableInCad) : null;
  const payable = d ? sideTotal(view, d.payable, d.payableInCad) : null;
  const leftOut =
    view === "IN_CAD" && d
      ? [
          leftOutText("Receivable", d.receivableExcludedFromCad),
          leftOutText("Payable", d.payableExcludedFromCad),
        ].filter(Boolean)
      : [];
  const count = (value: number | null | undefined) =>
    value === null || value === undefined ? "—" : `${value}`;
  const overdue =
    d && (d.overdueCount.shipper !== null || d.overdueCount.carrier !== null)
      ? `${(d.overdueCount.shipper ?? 0) + (d.overdueCount.carrier ?? 0)}`
      : "—";

  const cards = [
    {
      icon: <LuClock className="text-[#F871A0]" />,
      iconBgClass: "bg-icon-lightRed",
      name: "Overdue Invoices",
      value: overdue,
      caption: `${count(d?.overdueCount.shipper)} shipper · ${count(d?.overdueCount.carrier)} carrier`,
      pageLink: "/shipper-invoices/",
    },
    {
      icon: <PiHandCoins className="text-[#45D483]" />,
      iconBgClass: "bg-icon-lightGreen",
      name: "Collected This Month",
      value: formatMoney(d?.collectedThisMonth?.CAD, Currency.CAD) ?? "—",
      caption: `+ ${formatMoney(d?.collectedThisMonth?.USD, Currency.USD) ?? "—"}`,
      pageLink: "/payments/",
    },
    {
      icon: <LuFileWarning className="text-[#BC8EF0]" />,
      iconBgClass: "bg-icon-lightPurple",
      name: "Needs Review",
      value: count(d?.needsReview),
      caption: "Invoices to check before they go out",
      pageLink: "/needs-review/",
    },
    {
      icon: <TbArrowsShuffle className="text-[#7EE7FC]" />,
      iconBgClass: "bg-[#E1F9FE]",
      name: "Unmatched Payments",
      value: count(d?.unmatchedPayments),
      caption: `${count(d?.disputed)} disputed invoice${d?.disputed === 1 ? "" : "s"}`,
      pageLink: "/payments/",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-rows-3 gap-4">
      <StatCard
        className="sm:col-span-2"
        card={{
          icon: <HiOutlineCurrencyDollar className="text-base-primary-200" />,
          iconBgClass: "bg-icon-lightDarkBlue",
          name: "Outstanding Receivable / Payable",
          value: `${receivable ?? "—"}  /  ${payable ?? "—"}`,
          caption: [totalsLabel[view], ...leftOut].join(" · "),
        }}
        footer={
          <RadioGroup
            orientation="horizontal"
            aria-label="Currency"
            className="justify-center text-xs"
            classNames={{ wrapper: "flex-wrap gap-x-4 gap-y-2" }}
            value={view}
            onValueChange={(value) => setView(value as TotalsView)}
            size="md"
          >
            <Radio value="CAD">
              <span className="text-base-primary">CAD</span>
            </Radio>
            <Radio value="USD">
              <span className="text-base-primary">USD</span>
            </Radio>
            <Radio value="IN_CAD">
              <span className="text-base-primary">Total in CAD</span>
            </Radio>
          </RadioGroup>
        }
      />
      {cards.map((card) => (
        <StatCard key={card.name} card={card} />
      ))}
    </div>
  );
}

// A chart the role may not see, or that failed to load, says so instead of
// drawing an empty chart that reads as zero.
function ChartPanel({
  allowed,
  isError,
  onRetry,
  children,
}: {
  allowed: boolean;
  isError: boolean;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  if (!allowed) {
    return (
      <p className="text-sm text-content-5">
        Your role doesn&apos;t include reports, so this chart is hidden.
      </p>
    );
  }
  if (isError) {
    return <ErrorState message="We couldn't load the chart." onAction={onRetry} />;
  }
  return <>{children}</>;
}

function CycleCard({ label, days }: { label: string; days: number | null | undefined }) {
  return (
    <div className="rounded-xl bg-content-12 p-3">
      <p className="text-xs text-[#8F9494] font-semibold">{label}</p>
      <p className="text-lg font-bold">
        {days === null || days === undefined ? "—" : `${days} days`}
      </p>
    </div>
  );
}

// Each party's average days from invoice date to full payment, over the
// last 12 months: the first parties by name that have paid something.
function PaymentCycleList({ title, type }: { title: string; type: PartyType }) {
  const params = { page: 1, limit: 100, type, isActive: true };
  const summaries = useQuery({
    queryKey: ["account", "summaries", params],
    queryFn: ({ signal }) => listAccountSummaries(params, signal),
  });
  const rows: PartyAccountSummary[] = (summaries.data?.items ?? [])
    .filter((row) => row.averagePaymentDays !== null)
    .slice(0, CYCLE_ROWS);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-[#8F9494] font-semibold">{title}</p>
      {summaries.isError ? (
        <ErrorState
          message="We couldn't load these."
          onAction={() => void summaries.refetch()}
        />
      ) : summaries.isPending ? (
        <p className="text-sm text-content-5">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">No paid invoices in the last 12 months.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {rows.map((row) => (
            <li key={row.partyId} className="flex justify-between gap-3">
              <span>{row.partyName}</span>
              <strong>{row.averagePaymentDays} days</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
