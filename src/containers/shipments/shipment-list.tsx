import { Card } from "@heroui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import {
  BaseInput,
  BaseTable,
  ErrorState,
  FilterBar,
  Money,
  RowActions,
  StatusChip,
} from "@/components/common";
import { EyeIcon, SearchNormalSm } from "@/components/icons";
import { useHeaderAction } from "@/components/providers/header-action-provider";
import { useDebouncedValue, useServerPaging } from "@/hooks";
import { ShipmentSource } from "@/lib/enums";
import { ShipmentView } from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { listShipments } from "@/services";
import { partyHref } from "../parties/party-list";
import usePartyNames from "../parties/use-party-names";

export const shipmentHref = (shipment: Pick<ShipmentView, "id">) =>
  `/shipments/view/?id=${encodeURIComponent(shipment.id)}`;

// "Toronto, ON".
export const place = (city: string | null, province: string | null) =>
  [city, province].filter(Boolean).join(", ") || "—";

const columns: BaseTableColumn[] = [
  { key: "load", label: "Load #" },
  { key: "shipper", label: "Shipper" },
  { key: "carrier", label: "Carrier" },
  { key: "lane", label: "Lane" },
  { key: "pickupDate", label: "Pickup" },
  { key: "sell", label: "Sell" },
  { key: "buy", label: "Buy" },
  { key: "source", label: "Source" },
  { key: "actions", label: "Actions", align: "center" },
];

// Shipments from the TMS (§9), from the API's /shipment routes. Entering
// one makes its customer and carrier invoices.
export default function ShipmentList() {
  const navigate = useNavigate();
  const { control } = useForm({ defaultValues: { search: "" } });
  const search = useDebouncedValue(useWatch({ control, name: "search" }).trim());

  // The header's "New Shipment" (routes.config: shipments.create).
  useHeaderAction("new-shipment", () => navigate("/shipments/new/"));

  const paging = useServerPaging(search);
  const params = {
    page: paging.page,
    limit: paging.limit,
    searchQuery: search.slice(0, 64),
  };
  const shipments = useQuery({
    queryKey: ["shipments", "list", params],
    queryFn: ({ signal }) => listShipments(params, signal),
    placeholderData: keepPreviousData,
  });
  const items = shipments.data?.items ?? [];
  const parties = usePartyNames(
    items.flatMap((item) => [item.shipperPartyId, item.carrierPartyId])
  );

  const partyLink = (id: string | null) => {
    if (!id) return <span className="text-gray-400">None booked</span>;
    const party = parties.get(id);
    return party ? (
      <Link to={partyHref(party)} className="hover:underline">
        {party.name}
      </Link>
    ) : (
      <span className="font-mono text-gray-500">{id}</span>
    );
  };

  const renderCell = (shipment: ShipmentView, key: string) => {
    switch (key) {
      case "load":
        return (
          <Link
            to={shipmentHref(shipment)}
            className="font-bold text-base-primary-300 hover:underline whitespace-nowrap"
          >
            {shipment.loadNumber}
          </Link>
        );
      case "shipper":
        return partyLink(shipment.shipperPartyId);
      case "carrier":
        return partyLink(shipment.carrierPartyId);
      case "lane":
        return (
          <div className="w-40">
            <h6 className="uppercase font-bold">
              {place(shipment.originCity, shipment.originProvince)}
            </h6>
            <p className="text-gray-500">
              to {place(shipment.destinationCity, shipment.destinationProvince)}
            </p>
          </div>
        );
      case "pickupDate":
        return (
          <span className="whitespace-nowrap">
            {formatDate(shipment.pickupDate ?? undefined) ?? "—"}
          </span>
        );
      case "sell":
        return <Money amount={shipment.sellTotal} currency={shipment.sellCurrency} />;
      case "buy":
        return shipment.buyCurrency ? (
          <Money amount={shipment.buyTotal} currency={shipment.buyCurrency} />
        ) : (
          <span className="text-gray-400">—</span>
        );
      case "source":
        return shipment.source === ShipmentSource.Api ? (
          <StatusChip text="MGC sync" tone="primary" />
        ) : (
          <StatusChip text="Entered" tone="neutral" />
        );
      case "actions":
        return (
          <RowActions
            actions={[
              {
                key: "view",
                label: "View shipment & invoices",
                icon: <EyeIcon />,
                onPress: () => navigate(shipmentHref(shipment)),
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
          placeholder="Exact load #, MGC id, BOL, PO, PRO…"
          endContent={<SearchNormalSm />}
        />
      </FilterBar>
      <Card>
        {shipments.isError ? (
          <ErrorState
            message="We couldn't load the shipments. Please try again."
            onAction={() => void shipments.refetch()}
          />
        ) : (
          <BaseTable<ShipmentView>
            ariaLabel="Shipments"
            columns={columns}
            data={items}
            loading={shipments.isPending}
            refreshing={shipments.isPlaceholderData}
            rowKey={(row) => row.id}
            renderCell={renderCell}
            meta={paging.tableMeta(shipments.data?.meta)}
            setMeta={paging.setMeta}
            bottomContent="Shipments"
            emptyContent="No shipments found"
          />
        )}
      </Card>
    </div>
  );
}
