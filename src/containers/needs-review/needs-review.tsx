import { Card, Tab, Tabs } from "@heroui/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { LuCircleCheck } from "react-icons/lu";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseSelect,
  BaseTable,
  BaseTextArea,
  FormModal,
  Money,
  PartyAvatar,
  RowActions,
  StatusChip,
} from "@/components/common";
import { useCan } from "@/components/providers/user-provider";
import {
  DisputeStatus,
  InvoiceDirection,
  Permission,
  ReviewKind,
} from "@/lib/enums";
import { Dispute, ReviewItem } from "@/lib/interfaces";
import { mockDisputes, mockReviewItems } from "@/lib/mock";
import { BaseTableColumn } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

type View = "changes" | "disputes";

const columns: BaseTableColumn[] = [
  { key: "kind", label: "Change" },
  { key: "shipment", label: "Shipment" },
  { key: "invoice", label: "Invoice" },
  { key: "party", label: "Shipper" },
  { key: "previous", label: "Amount Before", align: "end" },
  { key: "next", label: "Amount Now", align: "end" },
  { key: "detectedAt", label: "Detected" },
  { key: "actions", label: "Actions" },
];

const disputeColumns: BaseTableColumn[] = [
  { key: "invoice", label: "Invoice" },
  { key: "party", label: "Party" },
  { key: "side", label: "Side" },
  { key: "amount", label: "Disputed" },
  { key: "reason", label: "Reason" },
  { key: "opened", label: "Opened" },
  { key: "status", label: "Status" },
  { key: "resolution", label: "Resolution" },
  { key: "actions", label: "Actions", align: "center" },
];

const isReceivable = (dispute: Dispute) =>
  dispute.direction === InvoiceDirection.Receivable;

// Design §6.2 steps 4–5: MGC changes that touch issued invoices. The issued
// invoice is never edited; the accountant resolves each with a note. And the
// invoices a shipper or carrier disputes (requirement 3). Mock data: every
// action is a demo.
export default function NeedsReview() {
  const [view, setView] = useState<View>("changes");
  const [resolving, setResolving] = useState<Dispute | null>(null);
  const resolve = (what: string) =>
    toast.info(`${what} — demo only, nothing was saved.`);
  // A credit or debit note is a new adjustment (create); keeping the fee or
  // dismissing resolves the invoice without one (edit).
  const { can } = useCan();
  const canNote = can(Permission.CustomerInvoicesCreate);
  const canResolve = can(Permission.CustomerInvoicesEdit);

  // Each side's disputes only for those who may view that side's invoices.
  const disputes = mockDisputes.filter((dispute) =>
    can(
      isReceivable(dispute)
        ? Permission.CustomerInvoicesView
        : Permission.CarrierInvoicesView
    )
  );
  const openDisputes = disputes.filter(
    (dispute) => dispute.status === DisputeStatus.Open
  ).length;

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
      // Demo invoices aren't in the API, so their numbers aren't links: the
      // invoice page would find nothing.
      case "invoice":
        return <span className="font-bold">{item.invoiceNumber}</span>;
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

  const renderDispute = (dispute: Dispute, key: string) => {
    switch (key) {
      case "invoice":
        return <span className="font-bold">{dispute.invoiceNumber}</span>;
      case "party":
        return (
          <PartyAvatar
            name={dispute.partyName}
            tone={isReceivable(dispute) ? "success" : "primary"}
          />
        );
      case "side":
        return isReceivable(dispute) ? (
          <StatusChip text="Shipper" tone="success" />
        ) : (
          <StatusChip text="Carrier" tone="primary" />
        );
      case "amount":
        return <Money amount={dispute.disputedAmount} currency={dispute.currency} className="font-semibold" />;
      case "reason":
        return <span className="block max-w-56">{dispute.reason}</span>;
      case "opened":
        return (
          <span className="whitespace-nowrap">
            {formatDate(dispute.openedOn)}
            <span className="block text-gray-500">{dispute.openedBy}</span>
          </span>
        );
      case "status":
        return dispute.status === DisputeStatus.Open ? (
          <StatusChip text="Open" tone="warning" />
        ) : (
          <StatusChip text="Resolved" tone="success" />
        );
      case "resolution":
        return dispute.resolution ? (
          <span className="block max-w-56">
            {dispute.resolution}
            {dispute.resolvedOn && (
              <span className="block text-gray-500">{formatDate(dispute.resolvedOn)}</span>
            )}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        );
      case "actions": {
        const canEdit = can(
          isReceivable(dispute)
            ? Permission.CustomerInvoicesEdit
            : Permission.CarrierInvoicesEdit
        );
        if (dispute.status !== DisputeStatus.Open || !canEdit) return null;
        return (
          <RowActions
            actions={[{ key: "resolve", label: "Resolve", icon: <LuCircleCheck />, onPress: () => setResolving(dispute) }]}
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        aria-label="Needs review view"
        color="primary"
        variant="underlined"
        selectedKey={view}
        onSelectionChange={(key) => setView(key as View)}
        // As on Payments: capped, so the tab list scrolls on a phone.
        classNames={{
          base: "max-w-full",
          cursor: "bg-base-primary",
        }}
      >
        <Tab key="changes" title={`MGC changes (${mockReviewItems.length})`} />
        <Tab
          key="disputes"
          title={
            <div className="flex items-center gap-2">
              Disputes
              <StatusChip text={`${openDisputes}`} tone="warning" className="px-2 py-0" />
            </div>
          }
        />
      </Tabs>
      {view === "changes" ? (
        <>
          <AlertBanner message="Issued invoices are never changed. Each change below is resolved with a credit or debit note, which is emailed with the invoice and logged in the audit trail." />
          <Card>
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
      ) : (
        <>
          <AlertBanner message="While a dispute is open, its amount shows in the aging report's Disputed column and payment reminders for the invoice are paused. Demo data: resolving saves nothing." />
          <Card>
            <BaseTable
              ariaLabel="Disputes"
              columns={disputeColumns}
              data={disputes}
              rowKey={(row) => row.id}
              renderCell={renderDispute}
              emptyContent="No disputes"
            />
          </Card>
        </>
      )}
      {resolving && (
        <ResolveDisputeModal dispute={resolving} onClose={() => setResolving(null)} />
      )}
    </div>
  );
}

type ResolveValues = { outcome: string; note: string };

const outcomeOptions = (dispute: Dispute) => [
  { key: "CREDIT_NOTE", label: "Issue a credit note", value: "CREDIT_NOTE" },
  {
    key: "PAYS_IN_FULL",
    label: isReceivable(dispute)
      ? "Shipper pays in full"
      : "MGC pays the carrier in full",
    value: "PAYS_IN_FULL",
  },
  { key: "WRITE_OFF", label: "Write off the disputed amount", value: "WRITE_OFF" },
];

function ResolveDisputeModal({
  dispute,
  onClose,
}: {
  dispute: Dispute;
  onClose: () => void;
}) {
  const { control, handleSubmit } = useForm<ResolveValues>({
    defaultValues: { outcome: "", note: "" },
  });

  const submit = handleSubmit(() => {
    toast.info("Dispute resolved — demo only, nothing was saved.");
    onClose();
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Resolve Dispute"
      confirmText="Resolve"
      onConfirm={submit}
      size="xl"
    >
      <p className="text-sm text-[#707070]">
        {dispute.invoiceNumber} · {dispute.partyName} · disputed{" "}
        <Money amount={dispute.disputedAmount} currency={dispute.currency} />
      </p>
      <p className="text-sm">{dispute.reason}</p>
      <BaseSelect
        name="outcome"
        control={control}
        label="Outcome"
        options={outcomeOptions(dispute)}
        rules={{ required: "Choose how it was resolved" }}
      />
      <BaseTextArea
        name="note"
        control={control}
        label="Note"
        placeholder="What was agreed, and with whom"
        rules={{
          required: "Say how it was resolved",
          maxLength: { value: 500, message: "At most 500 characters" },
        }}
      />
    </FormModal>
  );
}
