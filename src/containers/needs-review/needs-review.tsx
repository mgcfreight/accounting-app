import { Card, Tab, Tabs } from "@heroui/react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { LuCircleCheck } from "react-icons/lu";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseInput,
  BaseSelect,
  BaseTable,
  BaseTextArea,
  ErrorState,
  FilterBar,
  FormModal,
  Money,
  PartyAvatar,
  RowActions,
  StatusChip,
} from "@/components/common";
import { SearchNormalSm } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
import { useDebouncedValue, useServerPaging } from "@/hooks";
import {
  CustomerInvoiceStatus,
  DisputeOutcome,
  DisputeStatus,
  InvoiceDirection,
  InvoiceKind,
  Permission,
  ReviewKind,
} from "@/lib/enums";
import { Dispute, ReviewItem } from "@/lib/interfaces";
import { mockReviewItems } from "@/lib/mock";
import { formatMoney } from "@/lib/money";
import { BaseTableColumn } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  ApiError,
  DisputeListParams,
  errorMessage,
  listCustomerInvoices,
  listDisputes,
  resolveDispute,
} from "@/services";
import { invoiceListHref } from "../invoices/invoice-view";

type View = "changes" | "disputes";
type Filters = { status: string; side: string; search: string };

const ALL = "ALL";

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

// The API lists disputes newest first; nothing else sorts.
const disputeColumns: BaseTableColumn[] = [
  { key: "invoice", label: "Invoice" },
  { key: "party", label: "Party" },
  { key: "side", label: "Side" },
  { key: "amount", label: "Disputed", align: "end" },
  { key: "reason", label: "Reason" },
  { key: "opened", label: "Opened" },
  { key: "status", label: "Status" },
  { key: "resolution", label: "Resolution" },
  { key: "actions", label: "Actions", align: "center" },
];

const statusOptions = [
  { key: DisputeStatus.Open, label: "Open", value: DisputeStatus.Open },
  { key: DisputeStatus.Resolved, label: "Resolved", value: DisputeStatus.Resolved },
  { key: ALL, label: "All disputes", value: ALL },
];

const outcomeLabels: Record<DisputeOutcome, string> = {
  [DisputeOutcome.CreditNote]: "Credit note",
  [DisputeOutcome.PaysInFull]: "Paid in full",
  [DisputeOutcome.WriteOff]: "Written off",
};

const isReceivable = (dispute: Dispute) =>
  dispute.direction === InvoiceDirection.Receivable;

const invoiceHref = (dispute: Dispute) =>
  `${invoiceListHref(dispute.direction)}view/?id=${encodeURIComponent(dispute.invoiceId)}`;

const invoiceLabel = (dispute: Dispute) =>
  dispute.invoiceNumber ?? "No number yet";

// Design §6.2 steps 4–5: MGC changes that touch issued invoices, resolved
// with a note. They arrive with the TMS sync, so that tab is still demo
// data. And the invoices a shipper or carrier disputes (requirement 3),
// listed and resolved through the API.
export default function NeedsReview() {
  const [view, setView] = useState<View>("disputes");
  const [resolving, setResolving] = useState<Dispute | null>(null);
  const resolve = (what: string) =>
    toast.info(`${what} — demo only, nothing was saved.`);
  // A credit or debit note is a new adjustment (create); keeping the fee or
  // dismissing resolves the invoice without one (edit).
  const { can } = useCan();
  const canNote = can(Permission.CustomerInvoicesCreate);
  const canResolveChange = can(Permission.CustomerInvoicesEdit);
  const canViewShipper = can(Permission.CustomerInvoicesView);
  const canViewCarrier = can(Permission.CarrierInvoicesView);

  // Only the sides the role may view, and a side filter only when both.
  const sideOptions = [
    { key: ALL, label: "Both sides", value: ALL },
    ...(canViewShipper
      ? [{ key: InvoiceDirection.Receivable, label: "Shippers", value: InvoiceDirection.Receivable }]
      : []),
    ...(canViewCarrier
      ? [{ key: InvoiceDirection.Payable, label: "Carriers", value: InvoiceDirection.Payable }]
      : []),
  ];
  const { control } = useForm<Filters>({
    defaultValues: { status: DisputeStatus.Open, side: ALL, search: "" },
  });
  const status = useWatch({ control, name: "status" });
  const side = useWatch({ control, name: "side" });
  const search = useDebouncedValue(useWatch({ control, name: "search" }).trim());

  const openCount = useQuery({
    queryKey: ["disputes", "count", DisputeStatus.Open],
    queryFn: ({ signal }) =>
      listDisputes({ page: 1, limit: 1, status: DisputeStatus.Open }, signal),
    select: (page) => page.meta.totalItems,
  });

  const filters = {
    status: status && status !== ALL ? (status as DisputeStatus) : undefined,
    direction: side && side !== ALL ? (side as InvoiceDirection) : undefined,
    searchQuery: search.slice(0, 100),
  };
  const paging = useServerPaging(JSON.stringify(filters));
  const params: DisputeListParams = { page: paging.page, limit: paging.limit, ...filters };
  const disputes = useQuery({
    queryKey: ["disputes", "list", params],
    queryFn: ({ signal }) => listDisputes(params, signal),
    placeholderData: keepPreviousData,
    enabled: view === "disputes",
  });

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
            {canResolveChange && <BaseButton text="Keep Cancellation Fee" varient="bordered" className="rounded-full px-3 text-base-primary" onPress={() => resolve("Cancellation fee kept")} />}
          </div>
        ) : (
          <div className="flex gap-2">
            {canNote && <BaseButton text="Issue Debit Note" className="rounded-full px-3" onPress={() => resolve("Debit note issued")} />}
            {canResolveChange && <BaseButton text="Dismiss" varient="bordered" className="rounded-full px-3 text-base-primary" onPress={() => resolve("Dismissed")} />}
          </div>
        );
      default:
        return null;
    }
  };

  const renderDispute = (dispute: Dispute, key: string) => {
    switch (key) {
      case "invoice":
        return (
          <Link to={invoiceHref(dispute)} className="font-bold text-base-primary-300 whitespace-nowrap">
            {invoiceLabel(dispute)}
          </Link>
        );
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
        return (
          <div className="flex flex-col items-end">
            <Money amount={dispute.disputedAmount} currency={dispute.currency} className="font-semibold" />
            <span className="text-gray-500 whitespace-nowrap">
              owes {formatMoney(dispute.invoiceBalance, dispute.currency) ?? "—"}
            </span>
          </div>
        );
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
        return dispute.status === DisputeStatus.Resolved ? (
          <span className="block max-w-56">
            {dispute.outcome && (
              <span className="block font-semibold">
                {outcomeLabels[dispute.outcome]}
                {dispute.creditNoteNumber ? ` · ${dispute.creditNoteNumber}` : ""}
              </span>
            )}
            {dispute.resolution}
            {dispute.resolvedOn && (
              <span className="block text-gray-500">
                {formatDate(dispute.resolvedOn)}
                {dispute.resolvedBy ? ` · ${dispute.resolvedBy}` : ""}
              </span>
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
        <Tab
          key="disputes"
          title={
            <div className="flex items-center gap-2">
              Disputes
              {openCount.data !== undefined && (
                <StatusChip text={`${openCount.data}`} tone="warning" className="px-2 py-0" />
              )}
            </div>
          }
        />
        <Tab key="changes" title={`MGC changes (${mockReviewItems.length})`} />
      </Tabs>
      {view === "changes" ? (
        <>
          <AlertBanner message="Issued invoices are never changed. Each change below is resolved with a credit or debit note, which is emailed with the invoice and logged in the audit trail. Demo data: these arrive with the TMS sync." />
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
          <AlertBanner message="While a dispute is open, its amount shows in the aging report's Disputed column and payment reminders for the invoice are paused. Flag an invoice as disputed from its page." />
          <FilterBar>
            <BaseInput
              name="search"
              control={control}
              className="max-w-sm"
              classNames={{ inputWrapper: "bg-[#FFFFFF66] h-12 border-1 rounded-lg" }}
              placeholder="Search by invoice # or party"
              endContent={<SearchNormalSm />}
            />
            <BaseSelect
              name="status"
              control={control}
              options={statusOptions}
              className="w-full sm:w-44"
              classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
              aria-label="Status"
              disallowEmptySelection
            />
            {sideOptions.length > 2 && (
              <BaseSelect
                name="side"
                control={control}
                options={sideOptions}
                className="w-full sm:w-44"
                classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
                aria-label="Side"
                disallowEmptySelection
              />
            )}
          </FilterBar>
          <Card>
            {disputes.isError ? (
              <ErrorState
                message="We couldn't load the disputes. Please try again."
                onAction={() => void disputes.refetch()}
              />
            ) : (
              <BaseTable<Dispute>
                ariaLabel="Disputes"
                columns={disputeColumns}
                data={disputes.data?.items ?? []}
                loading={disputes.isPending}
                refreshing={disputes.isPlaceholderData}
                rowKey={(row) => row.id}
                renderCell={renderDispute}
                meta={paging.tableMeta(disputes.data?.meta)}
                setMeta={paging.setMeta}
                bottomContent="Disputes"
                emptyContent="No disputes match these filters"
              />
            )}
          </Card>
        </>
      )}
      {resolving && (
        <ResolveDisputeModal dispute={resolving} onClose={() => setResolving(null)} />
      )}
    </div>
  );
}

type ResolveValues = { outcome: string; note: string; creditNoteId: string };

const NO_CREDIT_NOTE = "NONE";

// The shipper's issued credit notes in the dispute's currency, newest
// first, to say which one settled it.
const useCreditNotes = (dispute: Dispute, enabled: boolean) =>
  useQuery({
    queryKey: ["invoices", "AR", "credit-notes", dispute.partyId],
    queryFn: ({ signal }) =>
      listCustomerInvoices(
        {
          page: 1,
          limit: 100,
          customerId: dispute.partyId,
          status: CustomerInvoiceStatus.Issued,
        },
        signal
      ),
    enabled,
    select: (page) =>
      page.items.filter(
        (invoice) =>
          invoice.kind === InvoiceKind.CreditNote &&
          invoice.currency === dispute.currency
      ),
  });

function ResolveDisputeModal({
  dispute,
  onClose,
}: {
  dispute: Dispute;
  onClose: () => void;
}) {
  const { can } = useCan();
  const shipper = isReceivable(dispute);
  // Only a shipper's dispute can be written off, by whoever may write off.
  const canWriteOff = shipper && can(Permission.CustomerInvoicesWriteOff);
  const outcomeOptions = [
    { key: DisputeOutcome.CreditNote, label: "Settled by a credit note", value: DisputeOutcome.CreditNote },
    {
      key: DisputeOutcome.PaysInFull,
      label: shipper ? "Shipper pays in full" : "MGC pays the carrier in full",
      value: DisputeOutcome.PaysInFull,
    },
    ...(canWriteOff
      ? [{ key: DisputeOutcome.WriteOff, label: "Write off the disputed amount", value: DisputeOutcome.WriteOff }]
      : []),
  ];
  const { control, handleSubmit } = useForm<ResolveValues>({
    defaultValues: { outcome: "", note: "", creditNoteId: NO_CREDIT_NOTE },
  });
  const outcome = useWatch({ control, name: "outcome" });
  const pickCreditNote = shipper && outcome === DisputeOutcome.CreditNote;
  const creditNotes = useCreditNotes(dispute, pickCreditNote);
  const creditNoteOptions = [
    { key: NO_CREDIT_NOTE, label: "Not named", value: NO_CREDIT_NOTE },
    ...(creditNotes.data ?? []).map((note) => ({
      key: note.id,
      label: `${note.invoiceNumber ?? "No number"} · ${formatMoney(note.total, note.currency) ?? "—"} · ${formatDate(note.invoiceDate ?? undefined) ?? ""}`,
      value: note.id,
    })),
  ];

  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["disputes"] });
    void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    void queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };
  const save = useMutation({
    mutationFn: (values: ResolveValues) =>
      resolveDispute(dispute.direction, dispute.id, {
        outcome: values.outcome as DisputeOutcome,
        note: values.note.trim(),
        creditNoteId:
          pickCreditNote && values.creditNoteId !== NO_CREDIT_NOTE
            ? values.creditNoteId
            : undefined,
      }),
    onSuccess: (resolved) => {
      toast.success(`Dispute on ${invoiceLabel(resolved)} resolved.`);
      refresh();
      onClose();
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      if (error instanceof ApiError && error.status === 409) refresh();
    },
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Resolve Dispute"
      confirmText="Resolve"
      onConfirm={handleSubmit((values) => save.mutate(values))}
      isConfirming={save.isPending}
      size="xl"
    >
      <p className="text-sm text-[#707070]">
        {invoiceLabel(dispute)} · {dispute.partyName} · disputed{" "}
        <Money amount={dispute.disputedAmount} currency={dispute.currency} /> · owes{" "}
        <Money amount={dispute.invoiceBalance} currency={dispute.currency} />
      </p>
      <p className="text-sm">{dispute.reason}</p>
      <BaseSelect
        name="outcome"
        control={control}
        label="Outcome"
        options={outcomeOptions}
        rules={{ required: "Choose how it was resolved" }}
      />
      {pickCreditNote && (
        <BaseSelect
          name="creditNoteId"
          control={control}
          label="Credit note"
          options={creditNoteOptions}
          description={
            creditNotes.isPending
              ? "Looking up the shipper's credit notes…"
              : creditNotes.isError
                ? "Couldn't load the credit notes; you can resolve without naming one."
                : "The issued credit note that settled it, if there is one."
          }
          disallowEmptySelection
        />
      )}
      {outcome === DisputeOutcome.WriteOff && (
        <p className="text-xs text-content-5">
          Writes off as much of the disputed amount as the invoice still owes,
          as bad debt. It shows in the reports and on the shipper&apos;s
          statement.
        </p>
      )}
      <BaseTextArea
        name="note"
        control={control}
        label="Note"
        placeholder="What was agreed, and with whom"
        rules={{
          validate: (value: string) => {
            const length = value.trim().length;
            if (length < 3) return "Say how it was resolved (at least 3 characters)";
            return length <= 500 || "At most 500 characters";
          },
        }}
      />
    </FormModal>
  );
}
