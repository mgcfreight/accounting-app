import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useState } from "react";
import { Link } from "react-router";
import {
  BaseButton,
  BaseCardWrapper,
  DetailRow,
  ErrorState,
  Money,
  PartyAvatar,
  StatusChip,
} from "@/components/common";
import { DownArrowSm, Pdf } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
import { useFileDownload } from "@/hooks";
import { InvoiceDirection, InvoiceKind } from "@/lib/enums";
import { Paginated, PartyView, ShipmentView } from "@/lib/interfaces";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  downloadInvoicePdf,
  listCarrierInvoices,
  listCustomerInvoices,
} from "@/services";
import {
  canExportPdf,
  isPrintable,
  versionLabel,
} from "../invoices/invoice-pdf";
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

// The shipment page's invoices, one card per invoice. A shipment has one
// invoice per side; correcting it makes a new version, and the list sends
// only the latest (superseded versions are left out). A card opens collapsed
// on a summary of the latest version; expanded, it shows the details, switches
// in place to any earlier version, and links to the invoice's page. Debit and
// credit notes raised against it are invoices of their own and get cards below.

const kindLabels: Record<InvoiceKind, string | null> = {
  [InvoiceKind.Standard]: null,
  [InvoiceKind.Adjustment]: "Debit note",
  [InvoiceKind.CreditNote]: "Credit note",
};

export default function ShipmentInvoices({
  direction,
  shipment,
  parties,
  heading,
  onExpandedChange,
}: {
  direction: InvoiceDirection;
  shipment: ShipmentView;
  parties: Map<string, PartyView>;
  heading: string;
  // Told whether any main invoice card on this side is open, so the page can
  // match this side's height to the other's when both are in the same state.
  onExpandedChange?: (expanded: boolean) => void;
}) {
  // Which main cards are open, by invoice id. A side can have more than one
  // (a voided invoice and its replacement), so closing one must not report
  // the side as closed while another is still open.
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());
  const setCardOpen = useCallback((id: string, open: boolean) => {
    setOpenIds((prev) => {
      if (prev.has(id) === open) return prev;
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

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
  const notes = items.filter(
    (invoice) => invoice.kind !== InvoiceKind.Standard
  );
  const side =
    direction === InvoiceDirection.Receivable ? "shipper" : "carrier";
  // Derived from the cards still listed, so a card that leaves the list on a
  // refetch (its invoice replaced by a new version) stops counting as open.
  const anyOpen = main.some((invoice) => openIds.has(invoice.id));
  useEffect(() => {
    onExpandedChange?.(anyOpen);
  }, [anyOpen, onExpandedChange]);

  return (
    // The page's grid stretches this to the other side's height only while
    // both cards are open or both closed. No h-full: in a grid it would fill
    // the row even when the page asks it not to stretch.
    <BaseCardWrapper heading={heading} className="flex flex-col">
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
            <InvoiceCard
              key={invoice.id}
              latest={invoice}
              parties={parties}
              onExpandedChange={(open) => setCardOpen(invoice.id, open)}
              fill
            />
          ))}
          {notes.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-base-primary">
                Debit and credit notes ({notes.length})
              </h2>
              {notes.map((invoice) => (
                <InvoiceCard
                  key={invoice.id}
                  latest={invoice}
                  parties={parties}
                />
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
  onExpandedChange,
  fill = false,
}: {
  // The invoice as the list sent it: always its latest version.
  latest: InvoiceView;
  parties: Map<string, PartyView>;
  onExpandedChange?: (expanded: boolean) => void;
  // Grow to fill the section when the page stretches it to the other
  // side's height (both cards open, or both closed).
  fill?: boolean;
}) {
  const { can } = useCan();
  // The API's PDF of the version shown, as the invoice page downloads it.
  const pdf = useFileDownload((target: InvoiceView) =>
    downloadInvoicePdf(
      directionOf(target),
      target.id,
      `${invoiceNumberOf(target) ?? "invoice"}.pdf`
    )
  );
  const detailsId = useId();
  const direction = directionOf(latest);
  const revised = latest.revision > 0;
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState(latest.id);

  // Every version, oldest first. Only a revised invoice has more than one,
  // and the switcher is only in the expanded card, so it's fetched then,
  // under the invoice page's key.
  const versions = useQuery({
    queryKey: ["invoices", direction, "versions", latest.id],
    queryFn: ({ signal }) => fetchInvoiceVersions(direction, latest.id, signal),
    enabled: revised && expanded,
  });

  const all = versions.data ?? [latest];
  const shown = all.find((version) => version.id === selectedId) ?? latest;
  const isLatest = shown.id === latest.id;
  const previous = all.find((version) => version.id === shown.parentInvoiceId);
  const replacedBy = all.find(
    (version) => version.parentInvoiceId === shown.id
  );
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

  // Collapsing goes back to the latest version, so the summary of a
  // collapsed card always describes what is owed now.
  const toggle = () => {
    if (expanded) setSelectedId(latest.id);
    setExpanded(!expanded);
    onExpandedChange?.(!expanded);
  };

  return (
    <article
      className={`flex flex-col rounded-lg border border-base-default border-l-4 transition-shadow hover:shadow-sm ${accent} ${
        expanded ? "shadow-sm" : ""
      } ${fill ? "flex-1" : ""}`}
    >
      {/* A click anywhere on the summary expands or collapses the card,
          except on the invoice number, which opens the invoice. A link can't
          sit inside a button, so the toggle is a button laid over the whole
          summary, behind its content; the content lets clicks through to it
          (pointer-events-none) and only the link takes them itself. */}
      <div className={`relative flex flex-col ${expanded ? "" : "flex-1"}`}>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={`${expanded ? "Hide" : "Show"} details of invoice ${
            number ?? "with no number yet"
          }`}
          onClick={toggle}
          className="absolute inset-0 rounded-lg hover:bg-content-12/60 focus-visible:outline-2 focus-visible:outline-base-primary-300"
        />
        <div className="pointer-events-none relative flex flex-1 flex-col gap-3 p-4">
          {/* One row at every width: on a narrow card the status chips stack
              in their own column on the right, beside the arrow, rather than
              the whole group dropping under the number. */}
          <div className="flex w-full items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={apiInvoiceHref(shown)}
                  title="Open this invoice"
                  className={`pointer-events-auto min-w-0 break-all text-lg underline hover:opacity-80 ${
                    number ? "font-bold text-base-primary-300" : "text-gray-500"
                  }`}
                >
                  {number ? `#${number}` : "No number yet"}
                </Link>
                {kind && <StatusChip text={kind} tone="neutral" />}
                {revised && (
                  <StatusChip
                    text={
                      isLatest
                        ? `${versionLabel(latest)} · latest`
                        : versionLabel(shown)
                    }
                    tone="secondary"
                  />
                )}
              </div>
              <PartyAvatar
                name={party.name}
                tone={isCustomerInvoice(shown) ? "success" : "primary"}
              />
            </div>
            <div className="flex min-w-0 max-w-[55%] items-start justify-end gap-3 [&>div]:justify-end">
              <InvoiceStatusCell invoice={shown} />
              <DownArrowSm
                aria-hidden
                className={`mt-1 h-3 w-3 shrink-0 transition-transform ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-4 rounded-md bg-content-12 p-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-content-5">Total</span>
              <span className="text-base font-semibold">
                <InvoiceTotal invoice={shown} />
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-content-5">Balance due</span>
              <span
                className={`text-base ${overdue ? "text-base-danger" : ""}`}
              >
                <InvoiceBalance invoice={shown} />
              </span>
            </div>
          </div>

          <span aria-hidden className="mt-auto text-xs text-content-5">
            {expanded ? "Hide details" : "Show details"}
          </span>
        </div>
      </div>

      {expanded && (
        <div
          id={detailsId}
          className="flex flex-1 flex-col gap-4 border-t border-base-default p-4"
        >
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
                {shown.supersededAt &&
                  ` on ${formatDateTime(shown.supersededAt)}`}
                . It owes nothing itself: what it owed moved to the new version.
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

          <div className="flex flex-col gap-2">
            <DetailRow
              label={isCustomerInvoice(shown) ? "Shipper" : "Carrier"}
              value={
                <Link
                  to={party.href}
                  className="text-base-primary-300 underline"
                >
                  {party.name}
                </Link>
              }
            />
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
            {totalChanged && (
              <DetailRow
                label={`Total in ${versionLabel(previous)}`}
                value={
                  <Money amount={previous.total} currency={previous.currency} />
                }
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
            {/* The invoice page's button style: BaseButton, rounded-xl. */}
            {pdfAllowed && (
              <BaseButton
                text="PDF"
                varient="bordered"
                className="rounded-xl px-4 text-base-primary"
                startContent={<Pdf className="h-4 w-4" />}
                isDisabled={!isPrintable(shown)}
                isLoading={pdf.isPending && pdf.variables?.id === shown.id}
                title={
                  isPrintable(shown)
                    ? undefined
                    : "Nothing to print until it's issued or the bill arrives."
                }
                onPress={() => pdf.mutate(shown)}
              />
            )}
            {/* No icon: the eye is drawn in the button's own blue. */}
            <BaseButton
              as={Link}
              to={apiInvoiceHref(shown)}
              text={
                isLatest
                  ? "View invoice"
                  : `View ${versionLabel(shown).toLowerCase()}`
              }
              className="rounded-xl px-4"
            />
          </div>
        </div>
      )}
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
    return <p className="text-xs text-content-5">Loading earlier versions…</p>;
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
      className="flex animate-pulse flex-col gap-4 rounded-lg border border-base-default p-4"
    >
      <div className="h-6 w-1/3 rounded bg-content-3" />
      <div className="h-8 w-1/2 rounded bg-content-3" />
      <div className="h-16 rounded bg-content-3" />
    </div>
  );
}
