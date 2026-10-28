import { Card } from "@heroui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  BaseInput,
  BaseSelect,
  BaseTable,
  ErrorState,
  FilterBar,
  PartyAvatar,
  RowActions,
  StatusChip,
} from "@/components/common";
import { EyeIcon, SearchNormalSm } from "@/components/icons";
import { useHeaderAction } from "@/components/providers/header-action-provider";
import { useDebouncedValue, useServerPaging } from "@/hooks";
import { PartyType } from "@/lib/enums";
import { PartyView } from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { listParties } from "@/services";
import { PartyFormModal } from "./party-modals";

type Filters = { search: string; active: string };

export const partyHref = (party: Pick<PartyView, "id" | "type">) =>
  `${party.type === PartyType.Shipper ? "/shippers" : "/carriers"}/view/?id=${encodeURIComponent(party.id)}`;

export const partyPlace = (party: PartyView) =>
  [party.city, party.province, party.country].filter(Boolean).join(", ");

const columns: BaseTableColumn[] = [
  { key: "name", label: "Name" },
  { key: "mgcId", label: "MGC Id" },
  { key: "gstHst", label: "GST/HST #" },
  { key: "currency", label: "Currency" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Added" },
  { key: "actions", label: "" },
];

const activeOptions = [
  { key: "ALL", label: "Active or not", value: "ALL" },
  { key: "true", label: "Active", value: "true" },
  { key: "false", label: "Inactive", value: "false" },
];

// Shippers and carriers share one design (§9 "Shippers / Carriers"), from
// the API's /party routes. Balances arrive with payments; until then the
// list shows who the party is.
export default function PartyList({ type }: { type: PartyType }) {
  const navigate = useNavigate();
  const isShipper = type === PartyType.Shipper;
  const [adding, setAdding] = useState(false);
  const { control } = useForm<Filters>({
    defaultValues: { search: "", active: "ALL" },
  });
  const search = useDebouncedValue(useWatch({ control, name: "search" }).trim());
  const active = useWatch({ control, name: "active" });

  // The header's "Add Shipper / Carrier" (routes.config: parties.create).
  useHeaderAction("add-party", () => setAdding(true));

  const paging = useServerPaging(JSON.stringify([type, search, active]));
  const params = {
    page: paging.page,
    limit: paging.limit,
    type,
    searchQuery: search.slice(0, 100),
    isActive: active && active !== "ALL" ? active === "true" : undefined,
  };
  const parties = useQuery({
    queryKey: ["parties", "list", params],
    queryFn: ({ signal }) => listParties(params, signal),
    placeholderData: keepPreviousData,
  });

  const renderCell = (party: PartyView, key: string) => {
    switch (key) {
      case "name":
        return (
          <PartyAvatar
            name={party.name}
            subtitle={partyPlace(party)}
            tone={isShipper ? "success" : "primary"}
          />
        );
      case "mgcId":
        return <span className="font-mono">{party.mgcId}</span>;
      case "gstHst":
        return party.gstHstNumber ?? <span className="text-gray-400">Not on file</span>;
      case "currency":
        return party.defaultCurrency;
      case "status":
        return party.isActive ? (
          <StatusChip text="Active" tone="success" />
        ) : (
          <StatusChip text="Inactive" tone="neutral" />
        );
      case "createdAt":
        return <span className="whitespace-nowrap">{formatDate(party.createdAt)}</span>;
      case "actions":
        return (
          <RowActions
            actions={[
              {
                key: "view",
                label: "View profile & agreements",
                icon: <EyeIcon />,
                onPress: () => navigate(partyHref(party)),
              },
            ]}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <FilterBar>
        <BaseInput
          name="search"
          control={control}
          className="max-w-sm"
          classNames={{ inputWrapper: "bg-[#FFFFFF66] h-12 border-1 rounded-lg" }}
          placeholder={`Search ${isShipper ? "shippers" : "carriers"} by name or MGC id`}
          endContent={<SearchNormalSm />}
        />
        <BaseSelect
          name="active"
          control={control}
          options={activeOptions}
          className="w-full sm:w-44"
          classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
          aria-label="Active"
          disallowEmptySelection
        />
      </FilterBar>
      <Card>
        {parties.isError ? (
          <ErrorState
            message={`We couldn't load the ${isShipper ? "shippers" : "carriers"}. Please try again.`}
            onAction={() => void parties.refetch()}
          />
        ) : (
          <BaseTable<PartyView>
            ariaLabel={isShipper ? "Shippers" : "Carriers"}
            columns={columns}
            data={parties.data?.items ?? []}
            loading={parties.isPending}
            refreshing={parties.isPlaceholderData}
            onRowClick={(row) => navigate(partyHref(row))}
            rowKey={(row) => row.id}
            renderCell={renderCell}
            meta={paging.tableMeta(parties.data?.meta)}
            setMeta={paging.setMeta}
            bottomContent={isShipper ? "Shippers" : "Carriers"}
            emptyContent={`No ${isShipper ? "shippers" : "carriers"} found`}
          />
        )}
      </Card>
      {adding && (
        <PartyFormModal
          type={type}
          onCreated={(party) => navigate(partyHref(party))}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
