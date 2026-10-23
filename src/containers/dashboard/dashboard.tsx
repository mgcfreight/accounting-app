import { Card, CardBody, Radio, RadioGroup } from "@heroui/react";
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
  LineChart,
  SectionTitle,
  StatCard,
} from "@/components/common";
import { useCurrentUser } from "@/components/providers/user-provider";
import { Currency } from "@/lib/enums";
import {
  mockAging,
  mockDashboard,
  mockMarginChart,
  mockShipperInvoices,
} from "@/lib/mock";
import { formatMoney } from "@/lib/money";
import { fullName } from "@/lib/utils";
import RecentInvoices from "./recent-invoices";

type TotalsView = "CAD" | "USD" | "IN_CAD";

const totalsLabel: Record<TotalsView, string> = {
  CAD: "CAD invoices",
  USD: "USD invoices",
  IN_CAD: "All, in CAD at invoice-date rates",
};

// mokal-app's admin dashboard layout: welcome header, chart beside a grid of
// KPI cards, two panels, then a recent-items table. Figures are design §9/§10.
export default function Dashboard() {
  const user = useCurrentUser();
  const [view, setView] = useState<TotalsView>("CAD");
  const d = mockDashboard;

  const receivable =
    view === "IN_CAD"
      ? formatMoney(d.receivableInCad, Currency.CAD)
      : formatMoney(d.receivable[view], view as Currency);
  const payable =
    view === "IN_CAD"
      ? formatMoney(d.payableInCad, Currency.CAD)
      : formatMoney(d.payable[view], view as Currency);

  const cards = [
    {
      icon: <LuClock className="text-[#F871A0]" />,
      iconBgClass: "bg-icon-lightRed",
      name: "Overdue Invoices",
      value: `${d.overdueCount.shipper + d.overdueCount.carrier}`,
      caption: `${d.overdueCount.shipper} shipper · ${d.overdueCount.carrier} carrier`,
      pageLink: "/shipper-invoices/",
    },
    {
      icon: <PiHandCoins className="text-[#45D483]" />,
      iconBgClass: "bg-icon-lightGreen",
      name: "Collected This Month",
      value: formatMoney(d.collectedThisMonth.CAD, Currency.CAD) ?? "—",
      caption: `+ ${formatMoney(d.collectedThisMonth.USD, Currency.USD) ?? "—"}`,
      pageLink: "/payments/",
    },
    {
      icon: <LuFileWarning className="text-[#BC8EF0]" />,
      iconBgClass: "bg-icon-lightPurple",
      name: "Needs Review",
      value: `${d.needsReview}`,
      caption: "MGC changes to issued invoices",
      pageLink: "/needs-review/",
    },
    {
      icon: <TbArrowsShuffle className="text-[#7EE7FC]" />,
      iconBgClass: "bg-[#E1F9FE]",
      name: "Unmatched Payments",
      value: `${d.unmatchedPayments}`,
      caption: `${d.disputed} disputed invoice`,
      pageLink: "/payments/",
    },
  ];

  return (
    <div className="flex flex-col h-full gap-2">
      <div>
        <h3 className="text-base">
          Welcome in <strong>{fullName(user)}</strong>
        </h3>
        <h1 className="text-2xl sm:text-3xl">Your Dashboard</h1>
      </div>

      {d.needsReview > 0 && (
        <AlertBanner
          message={`${d.needsReview} changes from MGC touch invoices that were already issued. Issue a credit or debit note to resolve them.`}
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

      <div className="flex flex-col gap-4 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2 mb-6">
          <Card className="bg-white p-2">
            <CardBody>
              <LineChart
                title="Revenue vs carrier cost (CAD)"
                categories={mockMarginChart.categories}
                series={[
                  { name: "Revenue", data: mockMarginChart.revenue },
                  { name: "Carrier cost", data: mockMarginChart.carrierCost },
                ]}
              />
            </CardBody>
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-rows-3 gap-4">
            <StatCard
              className="sm:col-span-2"
              card={{
                icon: <HiOutlineCurrencyDollar className="text-base-primary-200" />,
                iconBgClass: "bg-icon-lightDarkBlue",
                name: "Outstanding Receivable / Payable",
                value: `${receivable ?? "—"}  /  ${payable ?? "—"}`,
                caption: totalsLabel[view],
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
        </div>

        <div className="grid lg:grid-cols-2 grid-cols-1 gap-8">
          <div className="bg-white shadow-xs border p-4 rounded-xl flex flex-col gap-4">
            <SectionTitle icon={<PiReceipt />} title="Gross Margin by Month" />
            <BarChart
              categories={mockMarginChart.categories}
              series={[
                { name: "Gross margin (CAD)", data: mockMarginChart.grossMargin },
              ]}
            />
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
            <AgingTable rows={[...mockAging.receivable, ...mockAging.payable]} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="rounded-xl bg-content-12 p-3">
                <p className="text-xs text-[#8F9494] font-semibold">
                  Avg. payment cycle — shippers
                </p>
                <p className="text-lg font-bold">
                  {d.averagePaymentCycleDays.shipper} days
                </p>
              </div>
              <div className="rounded-xl bg-content-12 p-3">
                <p className="text-xs text-[#8F9494] font-semibold">
                  Avg. payment cycle — carriers
                </p>
                <p className="text-lg font-bold">
                  {d.averagePaymentCycleDays.carrier} days
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl shadow-xs border">
          <div className="flex items-center mb-2">
            <BsTruck className="text-base-primary-200 text-xl" />
            <div className="capitalize text-base-primary-900 text-xl sm:text-2xl ml-3">
              <strong>Recent Shipper Invoices</strong>
            </div>
          </div>
          <RecentInvoices invoices={mockShipperInvoices.slice(0, 5)} />
        </div>
      </div>
    </div>
  );
}
