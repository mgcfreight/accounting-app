import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import {
  BaseCardWrapper,
  DetailRow,
  ErrorState,
  Money,
  PartyAvatar,
  StatusChip,
} from "@/components/common";
import { EyeIcon, Pdf } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
import { InvoiceDirection, InvoiceKind } from "@/lib/enums";
import { Paginated, PartyView, ShipmentView } from "@/lib/interfaces";
import { formatDate, formatDateTime } from "@/lib/utils";
import { listCarrierInvoices, listCustomerInvoices } from "@/services";
import { canExportPdf, isPrintable, versionLabel } from "../invoices/invoice-pdf";
import { fetchInvoiceVersions } from "../invoices/invoice-reads";
import {
  apiInvoiceHref,
  directionOf,
  invoiceNumberOf,
  InvoiceBalance,
  InvoiceStatusCell,
  InvoiceTotal,
  InvoiceView,
  isCustomerInvoice,
  isSuperseded,
  overdueDaysOf,
  owesNothingYet,
  partyOf,
} from "../invoices/invoice-view";
import useInvoicePdf from "../invoices/use-invoice-pdf";

// The shipment page's invoices, one card per invoice. A shipment has one
// invoice per side; correcting it makes a new version, and the list sends
// only the latest (superseded versions are left out). The card opens on the
// latest version and switches in place to any earlier one. Debit and credit
// notes raised against it are invoices of their own and get cards below.

const kindLabels: Record<InvoiceKind, string | null> = {
  [InvoiceKind.Standard]: null,
  [InvoiceKind.Adjustment]: "Debit note",
  [InvoiceKind.CreditNote]: "Credit note",
};

const buttonClass =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-base-default px-3 py-1.5 text-xs text-base-primary hover:bg-content-12 disabled:opacity-50 disabled:cursor-not-allowed";

export default function ShipmentInvoices({
  direction,
  shipment,
  parties,
  heading,
}: {
  direction: InvoiceDirection;
  shipment: ShipmentView;
  parties: Map<string, PartyView>;
  heading: string;
}) {
  const params = { page: 1, limit: 20, shipmentId: shipment.id };
  const invoices = useQuery({
    queryKey: ["invoices", direction, "shipment", params],
    queryFn: ({ signal }): Promise<Paginated<InvoiceView>> =>
      direction === InvoiceDirection.Receivable
        ? listCustomerInvoices(params, signal)
        : listCarrierInvoices(params, signal),
  });

  const items = invoices.data?.items ?? [];
  const main = items.filter((invoice) => invoice.kind === InvoiceKind.Standard);
  const notes = items.filter((invoice) => invoice.kind !== InvoiceKind.Standard);
  const side = direction === InvoiceDirection.Receivable ? "shipper" : "carrier";

  return (
    // Stretched by the page's grid to the other side's height; the content
    // fills it so the shipper and carrier cards line up.
    <BaseCardWrapper heading={heading} className="flex h-full flex-col">
      {invoices.isError ? (
        <ErrorState
          message="We couldn't load the invoices. Please try again."
          onAction={() => void invoices.refetch()}
        />
      ) : invoices.isPending ? (
        <CardSkeleton />
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-base-default px-4 py-8 text-center">
          <span className="text-sm font-semibold text-base-primary">
            No {side} invoice yet
          </span>
          <span className="text-xs text-content-5">
            It appears here once the shipment is invoiced.
          </span>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          {main.map((invoice) => (
            <InvoiceCard key={invoice.id} latest={invoice} parties={parties} fill />
          ))}
          {notes.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-base-primary">
                Debit and credit notes ({notes.length})
              </h2>
              {notes.map((invoice) => (
                <InvoiceCard key={invoice.id} latest={invoice} parties={parties} />
              ))}
            </div>
          )}
        </div>
      )}
    </BaseCardWrapper>
  );
}

function InvoiceCard({
  latest,
  parties,
  fill = false,
}: {
  // The invoice as the list sent it: always its latest version.
  latest: InvoiceView;
  parties: Map<string, PartyView>;
  // Grow to fill the section, so both sides' main cards match in height.
  fill?: boolean;
}) {
  const { can } = useCan();
  const printPdf = useInvoicePdf();
  const direction = directionOf(latest);
  const revised = latest.revision > 0;

  // Every version, oldest first. Only a revised invoice has more than one,
  // so only it is fetched, under the invoice page's key.
  const versions = useQuery({
    queryKey: ["invoices", direction, "versions", latest.id],
    queryFn: ({ signal }) => fetchInvoiceVersions(direction, latest.id, signal),
    enabled: revised,
  });
  const [selectedId, setSelectedId] = useState(latest.id);

  const all = versions.data ?? [latest];
  const shown = all.find((version) => version.id === selectedId) ?? latest;
  const isLatest = shown.id === latest.id;
  const previous = all.find((version) => version.id === shown.parentInvoiceId);
  const replacedBy = all.find((version) => version.parentInvoiceId === shown.id);
  // An awaited carrier bill's total is 0 until it arrives: not a total to
  // compare with. Compared as text, never as numbers.
  const totalChanged =
    previous &&
    !owesNothingYet(previous) &&
    (previous.total !== shown.total || previous.currency !== shown.currency);

  const number = invoiceNumberOf(shown);
  const party = partyOf(shown, parties);
  const kind = kindLabels[shown.kind];
  const overdue = overdueDaysOf(shown) > 0;
  const pdfAllowed = canExportPdf(shown, can);
  const accent = overdue
    ? "border-l-base-danger"
    : isCustomerInvoice(shown)
      ? "border-l-base-success"
      : "border-l-base-primary-500";

  return (
    <article
      className={`flex flex-col gap-4 rounded-lg border border-base-default border-l-4 p-4 transition-shadow hover:shadow-sm ${accent} ${
        fill ? "flex-1" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={apiInvoiceHref(shown)}
              className={`text-lg underline ${
                number ? "font-bold text-base-primary-300" : "text-gray-500"
              }`}
            >
              {number ? `#${number}` : "No number yet"}
            </Link>
            {kind && <StatusChip text={kind} tone="neutral" />}
          </div>
          <Link to={party.href} className="underline">
            <PartyAvatar
              name={party.name}
              tone={isCustomerInvoice(shown) ? "success" : "primary"}
            />
          </Link>
        </div>
        <InvoiceStatusCell invoice={shown} />
      </div>

      {revised && (
        <VersionSwitcher
          latest={latest}
          versions={versions.data}
          selectedId={shown.id}
          onSelect={setSelectedId}
          failed={versions.isError}
          onRetry={() => void versions.refetch()}
        />
      )}

      {!isLatest && isSuperseded(shown) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-base-warning/10 px-3 py-2 text-xs text-base-primary">
          <span>
            You&apos;re viewing {versionLabel(shown)}, replaced
            {replacedBy ? ` by ${versionLabel(replacedBy)}` : ""}
            {shown.supersededAt && ` on ${formatDateTime(shown.supersededAt)}`}. It
            owes nothing itself: what it owed moved to the new version.
          </span>
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => setSelectedId(latest.id)}
          >
            Back to latest
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 rounded-md bg-content-12 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-content-5">Total</span>
          <span className="text-base font-semibold">
            <InvoiceTotal invoice={shown} />
          </span>
          {totalChanged && (
            <span className="text-xs text-content-5">
              was <Money amount={previous.total} currency={previous.currency} /> in{" "}
              {versionLabel(previous)}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-content-5">Balance due</span>
          <span className={`text-base ${overdue ? "text-base-danger" : ""}`}>
            <InvoiceBalance invoice={shown} />
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <DetailRow
          label="Invoice date"
          value={formatDate(shown.invoiceDate ?? undefined) ?? "—"}
        />
        <DetailRow
          label="Due date"
          value={formatDate(shown.dueDate ?? undefined) ?? "—"}
        />
        {!isCustomerInvoice(shown) && (
          <DetailRow
            label="Carrier bill #"
            value={shown.carrierInvoiceNumber ?? "Awaiting bill"}
          />
        )}
        {shown.revision > 0 && (
          <DetailRow
            label="Why it changed"
            // Rendered as text by React, so a reason can't inject markup.
            value={shown.revisionReason ?? "No reason given"}
          />
        )}
      </div>

      <div className="mt-auto flex flex-wrap justify-end gap-2">
        {pdfAllowed && (
          <button
            type="button"
            className={buttonClass}
            disabled={!isPrintable(shown)}
            title={
              isPrintable(shown)
                ? "Opens the print window: choose “Save as PDF” as the printer."
                : "Nothing to print until it's issued or the bill arrives."
            }
            onClick={() =>
              void printPdf({
                invoice: shown,
                partyName: party.name,
                versions: versions.data,
              })
            }
          >
            <Pdf className="h-4 w-4" />
            PDF
          </button>
        )}
        <Link
          to={apiInvoiceHref(shown)}
          className={`${buttonClass} border-base-primary-300 text-base-primary-300`}
        >
          <EyeIcon className="h-4 w-4" />
          {isLatest ? "View invoice" : `View ${versionLabel(shown).toLowerCase()}`}
        </Link>
      </div>
    </article>
  );
}

// "Version 1 | Version 2 (latest)": switches the card between versions.
function VersionSwitcher({
  latest,
  versions,
  selectedId,
  onSelect,
  failed,
  onRetry,
}: {
  latest: InvoiceView;
  // Oldest first; undefined until loaded.
  versions?: InvoiceView[];
  selectedId: string;
  onSelect: (id: string) => void;
  failed: boolean;
  onRetry: () => void;
}) {
  if (failed) {
    return (
      <p className="text-xs text-base-danger">
        Couldn&apos;t load the earlier versions.{" "}
        <button type="button" className="underline" onClick={onRetry}>
          Try again
        </button>
      </p>
    );
  }
  if (!versions) {
    return (
      <div className="flex items-center gap-2 text-xs text-content-5">
        <StatusChip text={`${versionLabel(latest)} · latest`} tone="secondary" />
        Loading earlier versions…
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-content-5">
        {versions.length} versions — choose one to see it here
      </span>
      <div
        role="group"
        aria-label="Versions of this invoice"
        className="inline-flex w-fit flex-wrap overflow-hidden rounded-md border border-base-default"
      >
        {versions.map((version) => {
          const selected = version.id === selectedId;
          return (
            <button
              key={version.id}
              type="button"
              aria-pressed={selected}
              title={version.revisionReason ?? "First version"}
              onClick={() => onSelect(version.id)}
              className={`border-r border-base-default px-3 py-1.5 text-xs last:border-r-0 ${
                selected
                  ? "bg-base-primary-500 text-white"
                  : "text-base-primary hover:bg-content-12"
              }`}
            >
              {versionLabel(version)}
              {version.id === latest.id && " (latest)"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div
      aria-busy
      aria-label="Loading invoices"
      className="flex flex-1 animate-pulse flex-col gap-4 rounded-lg border border-base-default p-4"
    >
      <div className="h-6 w-1/3 rounded bg-content-3" />
      <div className="h-8 w-1/2 rounded bg-content-3" />
      <div className="h-16 rounded bg-content-3" />
      <div className="h-4 rounded bg-content-3" />
      <div className="h-4 rounded bg-content-3" />
    </div>
  );
}
