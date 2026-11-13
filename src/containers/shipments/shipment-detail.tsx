import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { ReactNode, useState } from "react";
import {
  BaseCardWrapper,
  ErrorState,
  InfoStrip,
  Money,
  StatusChip,
  TableSkeleton,
} from "@/components/common";
import { ArrowRight } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
import { listReturnHref } from "@/hooks";
import { paymentTermsLabels } from "@/lib/constants";
import { InvoiceDirection, Permission, ShipmentSource } from "@/lib/enums";
import { formatDate, formatDateTime } from "@/lib/utils";
import { ApiError, errorMessage, getShipment } from "@/services";
import { referencesOf } from "../invoices/invoice-view";
import { partyHref } from "../parties/party-list";
import usePartyNames from "../parties/use-party-names";
import ShipmentInvoices from "./shipment-invoice-cards";
import { place } from "./shipment-list";

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <p>
    <strong>{label}:</strong> {children}
  </p>
);

// One shipment, its route and references, and the invoices it made.
export default function ShipmentDetail() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const { can } = useCan();
  // Whether any invoice card on each side is open. The two sides are matched
  // in height only while both have one open or both are all closed.
  const [shipperOpen, setShipperOpen] = useState(false);
  const [carrierOpen, setCarrierOpen] = useState(false);

  const shipment = useQuery({
    queryKey: ["shipments", "detail", id],
    queryFn: ({ signal }) => getShipment(id!, signal),
    enabled: !!id,
  });
  const parties = usePartyNames([
    shipment.data?.shipperPartyId,
    shipment.data?.carrierPartyId,
  ]);

  if (!id) return <ErrorState title="Shipment not found" message="None was chosen." />;
  if (shipment.isPending) return <TableSkeleton />;
  if (shipment.isError) {
    const notFound =
      shipment.error instanceof ApiError &&
      (shipment.error.status === 404 || shipment.error.status === 400);
    return notFound ? (
      <ErrorState title="Shipment not found" message={`There is no shipment ${id}.`} />
    ) : (
      <ErrorState
        message={errorMessage(shipment.error)}
        onAction={() => void shipment.refetch()}
      />
    );
  }

  const data = shipment.data;
  const references = referencesOf(data);
  const partyLink = (partyId: string) => {
    const party = parties.get(partyId);
    return party ? (
      <Link to={partyHref(party)} className="text-base-primary-300 underline">
        {party.name}
      </Link>
    ) : (
      <span className="font-mono">{partyId}</span>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex items-center gap-4">
        <Link to={listReturnHref("/shipments/")} className="text-base text-[#71717A] underline">
          Shipments
        </Link>
        <ArrowRight />
        <span className="text-base-primary-600 text-sm">Load {data.loadNumber}</span>
      </div>

      <InfoStrip
        items={[
          { label: "Load #", value: data.loadNumber },
          { label: "MGC Shipment", value: data.mgcShipmentId },
          { label: "TMS Status", value: data.tmsStatus },
          { label: "TMS Terms", value: paymentTermsLabels[data.tmsPaymentTerms] },
          {
            label: "Source",
            value:
              data.source === ShipmentSource.Api ? (
                <StatusChip text="MGC sync" tone="primary" />
              ) : (
                <StatusChip text="Entered" tone="neutral" />
              ),
          },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BaseCardWrapper heading="Parties & Totals">
          <div className="text-sm text-[#343A40] space-y-1">
            <Field label="Shipper">{partyLink(data.shipperPartyId)}</Field>
            <Field label="Carrier">
              {data.carrierPartyId ? partyLink(data.carrierPartyId) : "None booked"}
            </Field>
            <Field label="Sell">
              <Money amount={data.sellTotal} currency={data.sellCurrency} />
            </Field>
            <Field label="Buy">
              {data.buyCurrency ? (
                <Money amount={data.buyTotal} currency={data.buyCurrency} />
              ) : (
                "—"
              )}
            </Field>
            <p className="text-xs text-content-5 pt-2">
              Before tax, as the invoices were made.
            </p>
          </div>
        </BaseCardWrapper>
        <BaseCardWrapper heading="Route">
          <div className="text-sm text-[#343A40] space-y-1">
            <Field label="From">
              {place(data.originCity, data.originProvince)}
              {data.originCountry && `, ${data.originCountry}`}
            </Field>
            <Field label="To">
              {place(data.destinationCity, data.destinationProvince)}
              {data.destinationCountry && `, ${data.destinationCountry}`}
            </Field>
            <Field label="Pickup">{formatDate(data.pickupDate ?? undefined) ?? "—"}</Field>
            <Field label="Delivery">
              {formatDate(data.deliveryDate ?? undefined) ?? "—"}
            </Field>
            <Field label="Created in TMS">{formatDateTime(data.mgcCreatedAt)}</Field>
          </div>
        </BaseCardWrapper>
      </div>

      <BaseCardWrapper heading="References">
        <div className="text-sm text-[#343A40] space-y-1">
          <Field label="Invoice number">{data.invoiceSequence ?? "Not taken"}</Field>
          <Field label="TMS shipper invoice code">
            {data.tmsCustomerInvoiceCode ?? "Not set"}
          </Field>
          {data.carrierPartyId && (
            <Field label="TMS carrier invoice code">
              {data.tmsCarrierInvoiceCode ?? "Not set"}
            </Field>
          )}
          <Field label="Reference numbers">
            {references.length > 0
              ? references.map((ref) => `${ref.label} ${ref.value}`).join(" · ")
              : "None"}
          </Field>
        </div>
      </BaseCardWrapper>

      {/* Each side only for those who may read its invoices. */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${
          shipperOpen === carrierOpen ? "" : "items-start"
        }`}
      >
        {can(Permission.CustomerInvoicesView) && (
          <ShipmentInvoices
            direction={InvoiceDirection.Receivable}
            shipment={data}
            parties={parties}
            heading="Shipper Invoice"
            onExpandedChange={setShipperOpen}
          />
        )}
        {data.carrierPartyId && can(Permission.CarrierInvoicesView) && (
          <ShipmentInvoices
            direction={InvoiceDirection.Payable}
            shipment={data}
            parties={parties}
            heading="Carrier Invoice"
            onExpandedChange={setCarrierOpen}
          />
        )}
      </div>
    </div>
  );
}
