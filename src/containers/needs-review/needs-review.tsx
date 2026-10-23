import { Card } from "@heroui/react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseTable,
  Money,
  PartyAvatar,
  StatusChip,
} from "@/components/common";
import { useCan } from "@/components/providers/user-provider";
import { Permission, ReviewKind } from "@/lib/enums";
import { ReviewItem } from "@/lib/interfaces";
import { findInvoiceByNumber, mockReviewItems } from "@/lib/mock";
import { BaseTableColumn } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { invoiceHref } from "../invoices/invoice-cell";

const columns: BaseTableColumn[] = [
  { key: "kind", label: "Change" },
  { key: "shipment", label: "Shipment" },
  { key: "invoice", label: "Invoice" },
  { key: "party", label: "Shipper" },
  { key: "previous", label: "Amount Before" },
  { key: "next", label: "Amount Now" },
  { key: "detectedAt", label: "Detected" },
  { key: "actions", label: "" },
];

// Design §6.2 steps 4–5: MGC changes that touch issued invoices. The issued
// invoice is never edited; the accountant resolves each with a note.
export default function NeedsReview() {
  const resolve = (what: string) =>
    toast.info(`${what} — demo only, nothing was saved.`);
  // A credit or debit note is a new adjustment (create); keeping the fee or
  // dismissing resolves the invoice without one (edit).
  const { can } = useCan();
  const canNote = can(Permission.CustomerInvoicesCreate);
  const canResolve = can(Permission.CustomerInvoicesEdit);

  const renderCell = (item: ReviewItem, key: string) => {
    switch (key) {
      case "kind":
        return item.kind === ReviewKind.Cancellation ? (
          <StatusChip text="Cancelled in MGC" tone="danger" />
        ) : (
          <StatusChip text="Amount changed" tone="warning" />
        );
      case "shipment":
        return <span className="font-mono">{item.shipmentId}</span>;
      case "invoice": {
        // Linked only when the invoice exists here to open.
        const invoice = findInvoiceByNumber(item.invoiceNumber);
        return invoice ? (
          <Link
            to={invoiceHref(invoice)}
            className="font-bold text-base-primary-300 hover:underline"
          >
            {item.invoiceNumber}
          </Link>
        ) : (
          <span className="font-bold">{item.invoiceNumber}</span>
        );
      }
      case "party":
        return <PartyAvatar name={item.partyName} tone="success" />;
      case "previous":
        return <Money amount={item.previousAmount} currency={item.currency} />;
      case "next":
        return <Money amount={item.newAmount} currency={item.currency} className="font-semibold" />;
      case "detectedAt":
        return <span className="whitespace-nowrap">{formatDateTime(item.detectedAt)}</span>;
      case "actions":
        return item.kind === ReviewKind.Cancellation ? (
          <div className="flex gap-2">
            {canNote && <BaseButton text="Approve Credit Note" className="rounded-full px-3" onPress={() => resolve("Credit note approved")} />}
            {canResolve && <BaseButton text="Keep Cancellation Fee" varient="bordered" className="rounded-full px-3 text-base-primary" onPress={() => resolve("Cancellation fee kept")} />}
          </div>
        ) : (
          <div className="flex gap-2">
            {canNote && <BaseButton text="Issue Debit Note" className="rounded-full px-3" onPress={() => resolve("Debit note issued")} />}
            {canResolve && <BaseButton text="Dismiss" varient="bordered" className="rounded-full px-3 text-base-primary" onPress={() => resolve("Dismissed")} />}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <AlertBanner message="Issued invoices are never changed. Each change below is resolved with a credit or debit note, which is emailed with the invoice and logged in the audit trail." />
      <Card className="mt-4">
        <BaseTable
          ariaLabel="Needs review"
          columns={columns}
          data={mockReviewItems}
          rowKey={(row) => row.id}
          renderCell={renderCell}
          emptyContent="Nothing needs review"
        />
      </Card>
    </>
  );
}
