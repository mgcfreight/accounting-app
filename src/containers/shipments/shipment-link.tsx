import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ArrowRight, CarrrierTruck } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
import { Permission } from "@/lib/enums";
import { getShipment } from "@/services";
import { shipmentHref } from "./shipment-list";

// A link to an invoice's shipment, labelled with its load number. Pass the
// invoice's `loadNumber` when the API sent one — in a table that's what
// keeps each row from reading its own shipment. Left undefined (an API that
// doesn't send it yet), the shipment is read under the shipment page's key
// (needs shipments.view). Its id stands in until the load number arrives,
// or if there's none. Without shipments.view the route guard would turn
// the user away, so it's shown as text instead.
//
// "pill" is the invoice page's top strip; "plain" a table cell.
export default function ShipmentLink({
  shipmentId,
  loadNumber: givenLoadNumber,
  variant = "plain",
}: {
  shipmentId: string | null;
  loadNumber?: string | null;
  variant?: "pill" | "plain";
}) {
  const { can } = useCan();
  const canView = can(Permission.ShipmentsView);
  const shipment = useQuery({
    queryKey: ["shipments", "detail", shipmentId],
    queryFn: ({ signal }) => getShipment(shipmentId!, signal),
    staleTime: 5 * 60_000,
    enabled: !!shipmentId && canView && givenLoadNumber === undefined,
  });

  if (!shipmentId) return <span className="text-gray-400">None</span>;
  const loadNumber =
    givenLoadNumber === undefined ? shipment.data?.loadNumber : givenLoadNumber;
  const label = loadNumber ? (
    variant === "pill" ? (
      `Load ${loadNumber}`
    ) : (
      loadNumber
    )
  ) : (
    <span className="font-mono text-sm">{shipmentId}</span>
  );
  if (!canView) return label;

  if (variant === "plain") {
    return (
      <Link
        to={shipmentHref({ id: shipmentId })}
        title="Open this shipment"
        className="font-bold text-base-primary-300 underline whitespace-nowrap"
      >
        {label}
      </Link>
    );
  }
  return (
    <Link
      to={shipmentHref({ id: shipmentId })}
      title="Open this shipment"
      className="group inline-flex items-center gap-2 rounded-full border border-base-primary-50 bg-base-primary-50/25 px-3 py-1 text-base-primary-600 no-underline transition-colors hover:border-base-primary-200 hover:bg-base-primary-50/50 focus-visible:outline-2 focus-visible:outline-base-primary-300"
    >
      <CarrrierTruck
        aria-hidden
        className="h-4 w-4 shrink-0 [&_path]:stroke-current"
      />
      {label}
      <ArrowRight
        aria-hidden
        className="h-3 w-3 shrink-0 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
