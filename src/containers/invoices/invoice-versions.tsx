import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { Link, useNavigate } from "react-router";
import { BaseCardWrapper, Money, StatusChip } from "@/components/common";
import { DownArrowSm, EyeIcon, Pdf } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
import { formatDate } from "@/lib/utils";
import usePartyNames from "../parties/use-party-names";
import { canExportPdf, isPrintable, versionLabel } from "./invoice-pdf";
import {
  apiInvoiceHref,
  carrierIdsOf,
  invoiceNumberOf,
  InvoiceStatusCell,
  InvoiceTotal,
  InvoiceView,
  owesNothingYet,
  partyOf,
} from "./invoice-view";
import useInvoicePdf from "./use-invoice-pdf";

const actionClass =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-base-default px-2.5 py-1.5 text-xs text-base-primary hover:bg-content-12 disabled:opacity-50 disabled:cursor-not-allowed";

// "Version 1 of 2 ▾" beside the invoice number: jumps to another version.
export function VersionSwitcher({
  current,
  versions,
}: {
  current: InvoiceView;
  versions: InvoiceView[];
}) {
  const navigate = useNavigate();
  const latest = versions[versions.length - 1];
  return (
    <Dropdown>
      <DropdownTrigger>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-base-default px-2.5 py-1 text-xs text-base-primary hover:bg-content-12"
        >
          {versionLabel(current, versions.length)}
          <DownArrowSm className="h-3 w-3" />
        </button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Versions of this invoice"
        selectionMode="single"
        selectedKeys={[current.id]}
        onAction={(key) => {
          const version = versions.find((item) => item.id === key);
          if (version && version.id !== current.id) navigate(apiInvoiceHref(version));
        }}
      >
        {[...versions].reverse().map((version) => (
          <DropdownItem
            key={version.id}
            description={version.revisionReason ?? "First version"}
          >
            {versionLabel(version)} · {invoiceNumberOf(version) ?? "No number yet"}
            {version.id === latest.id ? " (latest)" : ""}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}

// Every version of an invoice, newest first: which one is the latest, which
// one is open, what each one totalled, and its page and PDF.
export default function InvoiceVersions({
  current,
  versions,
}: {
  // The version this page shows.
  current: InvoiceView;
  // Oldest first, as the API sends them.
  versions: InvoiceView[];
}) {
  const { can } = useCan();
  const printPdf = useInvoicePdf();
  const carriers = usePartyNames(carrierIdsOf(versions));
  const latest = versions[versions.length - 1];
  const newestFirst = [...versions].reverse();

  return (
    <BaseCardWrapper heading={`Versions (${versions.length})`}>
      <p className="text-sm text-content-5 mb-4">
        {versions.length > 1
          ? "Correcting an issued invoice makes a new version. Earlier versions are kept exactly as they were sent: open any of them or save it as a PDF."
          : "This invoice has one version. Correcting it after it's issued adds a new version here, and this one is kept as it was sent."}{" "}
        &ldquo;PDF&rdquo; opens the print window: choose &ldquo;Save as
        PDF&rdquo; as the printer to save the file.
      </p>
      <ol className="flex flex-col">
        {newestFirst.map((version, index) => {
          const previous = newestFirst[index + 1];
          const isOpen = version.id === current.id;
          // An awaited carrier bill's total is 0 until it arrives: not a
          // total to compare with.
          const totalChanged =
            previous &&
            !owesNothingYet(previous) &&
            (previous.total !== version.total ||
              previous.currency !== version.currency);
          const pdfAllowed = canExportPdf(version, can);
          return (
            <li
              key={version.id}
              className={`relative flex gap-3 pb-4 last:pb-0 ${
                index < newestFirst.length - 1
                  ? "before:absolute before:left-1.25 before:top-4 before:bottom-0 before:w-px before:bg-base-default"
                  : ""
              }`}
            >
              <span
                aria-hidden
                className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${
                  version.id === latest.id ? "bg-base-primary-500" : "bg-content-3"
                }`}
              />
              <div
                className={`flex flex-1 flex-wrap justify-between gap-3 rounded-md p-3 ${
                  isOpen ? "bg-content-12 ring-1 ring-base-primary-300" : ""
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <strong>{versionLabel(version)}</strong>
                    <span className="text-content-5">
                      {invoiceNumberOf(version) ?? "No number yet"}
                    </span>
                    {version.id === latest.id && (
                      <StatusChip text="Latest" tone="primary" />
                    )}
                    {isOpen && versions.length > 1 && (
                      <StatusChip text="Viewing" tone="neutral" />
                    )}
                    <InvoiceStatusCell invoice={version} />
                  </div>
                  <span className="text-xs text-content-5">
                    Made {formatDate(version.createdAt) ?? "—"}
                    {" · "}
                    {/* Rendered as text by React, so a reason can't inject markup. */}
                    {version.revisionReason ?? "First version"}
                  </span>
                  {(!isOpen || pdfAllowed) && (
                    <div className="flex flex-wrap gap-2">
                      {!isOpen && (
                        <Link to={apiInvoiceHref(version)} className={actionClass}>
                          <EyeIcon className="h-4 w-4" />
                          Open
                        </Link>
                      )}
                      {pdfAllowed && (
                        <button
                          type="button"
                          className={actionClass}
                          disabled={!isPrintable(version)}
                          title={
                            isPrintable(version)
                              ? undefined
                              : "Nothing to print until it's issued or the bill arrives."
                          }
                          onClick={() =>
                            void printPdf({
                              invoice: version,
                              partyName: partyOf(version, carriers).name,
                              versions,
                            })
                          }
                        >
                          <Pdf className="h-4 w-4" />
                          PDF
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 text-sm">
                  <InvoiceTotal invoice={version} />
                  {totalChanged && (
                    <span className="text-xs text-content-5">
                      was <Money amount={previous.total} currency={previous.currency} />
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </BaseCardWrapper>
  );
}
