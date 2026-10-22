import { Card } from "@heroui/react";
import { useNavigate } from "react-router";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  BaseInput,
  BaseSelect,
  BaseTable,
  FilterBar,
  Money,
  PartyAvatar,
  RowActions,
} from "@/components/common";
import { EyeIcon, SearchNormalSm, Send } from "@/components/icons";
import { useClientTable } from "@/hooks";
import { currencyOptions } from "@/lib/constants";
import { PartyType } from "@/lib/enums";
import { Party } from "@/lib/interfaces";
import { mockCarriers, mockShippers } from "@/lib/mock";
import { isZeroMoney } from "@/lib/money";
import { BaseTableColumn } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type Filters = { search: string; currency: string; balance: string };

export const partyHref = (party: Party) =>
  `${party.type === PartyType.Shipper ? "/shippers" : "/carriers"}/view/?id=${encodeURIComponent(party.id)}`;

const columns: BaseTableColumn[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "billing", label: "Billing Email" },
  { key: "terms", label: "Terms", sortable: true, sortKey: "termsDays", sortType: "number" },
  { key: "shipments", label: "Shipments", sortable: true, sortKey: "shipmentCount", sortType: "number" },
  { key: "balance", label: "Balance", sortable: true, sortType: "money" },
  { key: "overdue", label: "Overdue", sortable: true, sortType: "money" },
  { key: "lastPayment", label: "Last Payment", sortable: true, sortKey: "lastPaymentOn", sortType: "date" },
  { key: "actions", label: "" },
];

const balanceOptions = [
  { key: "ALL", label: "All balances", value: "ALL" },
  { key: "OPEN", label: "Open balance", value: "OPEN" },
  { key: "OVERDUE", label: "Has overdue", value: "OVERDUE" },
];

const filterCurrencyOptions = [
  { key: "ALL", label: "All currencies", value: "ALL" },
  ...currencyOptions,
];

// Shippers and carriers share one design (§9 "Shippers / Carriers").
export default function PartyList({ type }: { type: PartyType }) {
  const navigate = useNavigate();
  const isShipper = type === PartyType.Shipper;
  const { control } = useForm<Filters>({
    defaultValues: { search: "", currency: "ALL", balance: "ALL" },
  });
  const search = useWatch({ control, name: "search" }).trim().toLowerCase();
  const currency = useWatch({ control, name: "currency" });
  const balance = useWatch({ control, name: "balance" });

  const source = isShipper ? mockShippers : mockCarriers;
  const filtered = useMemo(
    () =>
      source.filter((party) => {
        if (currency && currency !== "ALL" && party.currency !== currency) return false;
        if (balance === "OPEN" && isZeroMoney(party.balance)) return false;
        if (balance === "OVERDUE" && isZeroMoney(party.overdue)) return false;
        if (!search) return true;
        return [party.name, ...party.billingEmails].some((value) =>
          value.toLowerCase().includes(search)
        );
      }),
    [source, search, currency, balance]
  );

  const table = useClientTable(filtered, columns, {
    column: "name",
    sortKey: "name",
    direction: "asc",
  });

  const renderCell = (party: Party, key: string) => {
    switch (key) {
      case "name":
        return (
          <PartyAvatar
            name={party.name}
            subtitle={`${party.address.city}, ${party.address.province} · ${party.currency}`}
            tone={isShipper ? "success" : "primary"}
          />
        );
      case "billing":
        return party.billingEmails[0];
      case "terms":
        return `Net ${party.termsDays}`;
      case "shipments":
        return party.shipmentCount;
      case "balance":
        return <Money amount={party.balance} currency={party.currency} className="font-semibold" />;
      case "overdue":
        return isZeroMoney(party.overdue) ? (
          <span className="text-gray-400">—</span>
        ) : (
          <Money amount={party.overdue} currency={party.currency} className="text-base-danger" />
        );
      case "lastPayment":
        return party.lastPaymentOn ? (
          <span className="whitespace-nowrap">{formatDate(party.lastPaymentOn)}</span>
        ) : (
          <span className="text-gray-400">None yet</span>
        );
      case "actions":
        return (
          <RowActions
            actions={[
              {
                key: "view",
                label: "View balance & profile",
                icon: <EyeIcon />,
                onPress: () => navigate(partyHref(party)),
              },
              {
                key: "statement",
                label: "Send statement now",
                icon: <Send />,
                onPress: () =>
                  toast.info(`Statement to ${party.name} — demo only, nothing was sent.`),
              },
            ]}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <FilterBar>
        <BaseInput
          name="search"
          control={control}
          className="max-w-sm"
          classNames={{ inputWrapper: "bg-[#FFFFFF66] h-12 border-1 rounded-lg" }}
          placeholder={`Search ${isShipper ? "shippers" : "carriers"} by name or email`}
          endContent={<SearchNormalSm />}
        />
        <BaseSelect
          name="currency"
          control={control}
          options={filterCurrencyOptions}
          className="w-full sm:w-44"
          classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
          aria-label="Currency"
          disallowEmptySelection
        />
        <BaseSelect
          name="balance"
          control={control}
          options={balanceOptions}
          className="w-full sm:w-44"
          classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
          aria-label="Balance"
          disallowEmptySelection
        />
      </FilterBar>
      <Card className="mt-4">
        <BaseTable
          ariaLabel={isShipper ? "Shippers" : "Carriers"}
          columns={columns}
          data={table.pageRows}
          rowKey={(row) => row.id}
          renderCell={renderCell}
          meta={table.meta}
          setMeta={table.setMeta}
          sort={table.sort}
          onSortChange={table.onSortChange}
          bottomContent={isShipper ? "Shippers" : "Carriers"}
        />
      </Card>
    </>
  );
}
