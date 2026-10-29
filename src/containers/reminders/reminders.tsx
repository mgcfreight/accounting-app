import { Card, Tab, Tabs } from "@heroui/react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { LuSend, LuSkipForward } from "react-icons/lu";
import { PiFileCsv, PiFilePdf } from "react-icons/pi";
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
import { RowAction } from "@/components/common/row-actions";
import { useCan } from "@/components/providers/user-provider";
import { useDebouncedValue, useServerPaging } from "@/hooks";
import {
  InvoiceDirection,
  Permission,
  ReminderChannel,
  ReminderKind,
  ReminderStatus,
} from "@/lib/enums";
import { downloadCsv, ExportTable, printTable } from "@/lib/export";
import { Reminder } from "@/lib/interfaces";
import { formatMoney } from "@/lib/money";
import { BaseTableColumn } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  ApiError,
  errorMessage,
  getReminderCounts,
  listReminders,
  ReminderListParams,
  sendReminder,
  skipReminder,
} from "@/services";

type View = "all" | ReminderStatus;
type Filters = { side: string; search: string };
type OpenModal = { modal: "send" | "skip"; reminder: Reminder };

const ALL = "ALL";
// An export reads every matching reminder, 100 at a time, up to this many.
const EXPORT_MAX_PAGES = 50;

// The API orders by remind-on date, latest first; nothing else sorts.
const columns: BaseTableColumn[] = [
  { key: "invoice", label: "Invoice" },
  { key: "party", label: "Party" },
  { key: "side", label: "Side" },
  { key: "dueDate", label: "Due Date" },
  { key: "remindOn", label: "Remind On" },
  { key: "balance", label: "Balance", align: "end" },
  { key: "channel", label: "Channel" },
  { key: "recipient", label: "Recipient" },
  { key: "status", label: "Status" },
  { key: "sentAt", label: "Sent / Note" },
  { key: "actions", label: "Actions", align: "center" },
];

const channelLabels: Record<ReminderChannel, string> = {
  [ReminderChannel.CustomerEmail]: "Email to shipper",
  [ReminderChannel.TeamAlert]: "Alert to accounts team",
};

const kindLabels: Record<ReminderKind, string> = {
  [ReminderKind.BeforeDue]: "Before due",
  [ReminderKind.Overdue]: "Overdue",
  [ReminderKind.InvoiceNotReceived]: "Bill not received",
};

const reminderStatus: Record<
  ReminderStatus,
  { label: string; tone: "secondary" | "success" | "neutral" }
> = {
  [ReminderStatus.Scheduled]: { label: "Scheduled", tone: "secondary" },
  [ReminderStatus.Sent]: { label: "Sent", tone: "success" },
  [ReminderStatus.Skipped]: { label: "Skipped", tone: "neutral" },
};

const isReceivable = (reminder: Reminder) =>
  reminder.direction === InvoiceDirection.Receivable;

const sideLabel = (reminder: Reminder) =>
  isReceivable(reminder) ? "Shipper" : "Carrier";

const invoiceLabel = (reminder: Reminder) =>
  reminder.invoiceNumber ?? "No number yet";

// Text for the exports: amounts and dates as the table shows them.
const exportTable = (rows: Reminder[], subtitle: string): ExportTable<Reminder> => ({
  title: "Payment Reminders",
  subtitle,
  rows,
  columns: [
    { label: "Invoice", value: invoiceLabel },
    { label: "Party", value: (r) => r.partyName },
    { label: "Side", value: sideLabel },
    { label: "Kind", value: (r) => kindLabels[r.kind] },
    { label: "Due date", value: (r) => formatDate(r.dueDate) ?? "" },
    { label: "Remind on", value: (r) => formatDate(r.remindOn) ?? "" },
    { label: "Balance", value: (r) => formatMoney(r.balance, r.currency) ?? "" },
    { label: "Channel", value: (r) => channelLabels[r.channel] },
    { label: "Recipient", value: (r) => r.recipient ?? "" },
    { label: "Status", value: (r) => reminderStatus[r.status].label },
    {
      label: "Sent / note",
      value: (r) => (r.sentAt ? formatDateTime(r.sentAt) ?? "" : r.note ?? ""),
    },
  ],
});

// Every reminder the filters match, across pages, for an export.
const allReminders = async (
  filters: Omit<ReminderListParams, "page" | "limit">
) => {
  const rows: Reminder[] = [];
  for (let page = 1; page <= EXPORT_MAX_PAGES; page += 1) {
    const result = await listReminders({ ...filters, page, limit: 100 });
    rows.push(...result.items);
    if (page >= result.meta.totalPages) return rows;
  }
  throw new Error("Too many reminders to export at once. Narrow the filters and try again.");
};

// Payment reminders (requirement 1): an email to the shipper's contacts
// before an invoice falls due, and again once it is overdue, or an alert to
// MGC's accounts team that a carrier bill falls due. The days are set in
// Settings. Listed, filtered and paged by the API.
export default function Reminders() {
  const [view, setView] = useState<View>("all");
  const [open, setOpen] = useState<OpenModal | null>(null);
  const { can } = useCan();
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
  const { control } = useForm<Filters>({ defaultValues: { side: ALL, search: "" } });
  const side = useWatch({ control, name: "side" });
  const search = useDebouncedValue(useWatch({ control, name: "search" }).trim());

  const counts = useQuery({
    queryKey: ["reminders", "counts"],
    queryFn: ({ signal }) => getReminderCounts(signal),
  });
  const countText = (count: number | undefined) =>
    count === undefined ? "" : ` (${count})`;
  const total = counts.data
    ? counts.data.scheduled + counts.data.sent + counts.data.skipped
    : undefined;

  const filters = {
    status: view === "all" ? undefined : view,
    direction: side && side !== ALL ? (side as InvoiceDirection) : undefined,
    searchQuery: search.slice(0, 100),
  };
  const paging = useServerPaging(JSON.stringify(filters));
  const params: ReminderListParams = { page: paging.page, limit: paging.limit, ...filters };
  const reminders = useQuery({
    queryKey: ["reminders", "list", params],
    queryFn: ({ signal }) => listReminders(params, signal),
    placeholderData: keepPreviousData,
  });

  // Sending a shipper's email is "send email"; a carrier alert goes to staff,
  // so it takes edit on carrier invoices, as skipping does on either side.
  const canSend = (reminder: Reminder) =>
    can(
      isReceivable(reminder)
        ? Permission.CustomerInvoicesSendEmail
        : Permission.CarrierInvoicesEdit
    );
  const canSkip = (reminder: Reminder) =>
    can(
      isReceivable(reminder)
        ? Permission.CustomerInvoicesEdit
        : Permission.CarrierInvoicesEdit
    );

  const subtitle = `${view === "all" ? "All" : reminderStatus[view].label} · ${
    sideOptions.find((option) => option.key === side)?.label ?? "Both sides"
  }${filters.searchQuery ? ` · "${filters.searchQuery}"` : ""}`;
  const exportRows = useMutation({
    mutationFn: () => allReminders(filters),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const exportCsv = () =>
    exportRows.mutate(undefined, {
      onSuccess: (rows) => downloadCsv(exportTable(rows, subtitle)),
    });
  const exportPdf = () =>
    exportRows.mutate(undefined, {
      onSuccess: (rows) => {
        if (!printTable(exportTable(rows, subtitle))) {
          toast.error("The print window was blocked. Allow pop-ups for this site and try again.");
        }
      },
    });
  const noRows = reminders.data?.meta.totalItems === 0;

  const renderCell = (reminder: Reminder, key: string) => {
    switch (key) {
      case "invoice":
        return (
          <div className="flex flex-col">
            <span className="font-bold whitespace-nowrap">{invoiceLabel(reminder)}</span>
            {reminder.kind !== ReminderKind.BeforeDue && (
              <span className="text-gray-500 whitespace-nowrap">{kindLabels[reminder.kind]}</span>
            )}
          </div>
        );
      case "party":
        return (
          <PartyAvatar
            name={reminder.partyName}
            tone={isReceivable(reminder) ? "success" : "primary"}
          />
        );
      case "side":
        return isReceivable(reminder) ? (
          <StatusChip text="Shipper" tone="success" />
        ) : (
          <StatusChip text="Carrier" tone="primary" />
        );
      case "dueDate":
        return <span className="whitespace-nowrap">{formatDate(reminder.dueDate)}</span>;
      case "remindOn":
        return <span className="whitespace-nowrap">{formatDate(reminder.remindOn)}</span>;
      case "balance":
        return <Money amount={reminder.balance} currency={reminder.currency} className="font-semibold" />;
      case "channel":
        return <span className="whitespace-nowrap">{channelLabels[reminder.channel]}</span>;
      case "recipient":
        return reminder.recipient ? (
          <span className="break-all">{reminder.recipient}</span>
        ) : (
          <span className="text-gray-400">Nobody to send to</span>
        );
      case "status":
        return (
          <StatusChip
            text={reminderStatus[reminder.status].label}
            tone={reminderStatus[reminder.status].tone}
          />
        );
      case "sentAt":
        return reminder.sentAt ? (
          <span className="whitespace-nowrap">{formatDateTime(reminder.sentAt)}</span>
        ) : reminder.note ? (
          <span className="block max-w-48 text-gray-500">{reminder.note}</span>
        ) : (
          <span className="text-gray-400">—</span>
        );
      case "actions": {
        if (reminder.status !== ReminderStatus.Scheduled) return null;
        const actions: RowAction[] = [
          ...(canSend(reminder)
            ? [{ key: "send", label: "Send now", icon: <LuSend />, onPress: () => setOpen({ modal: "send", reminder }) }]
            : []),
          ...(canSkip(reminder)
            ? [{ key: "skip", label: "Skip", icon: <LuSkipForward />, onPress: () => setOpen({ modal: "skip", reminder }) }]
            : []),
        ];
        return actions.length ? <RowActions actions={actions} /> : null;
      }
      default:
        return null;
    }
  };

  const close = () => setOpen(null);

  return (
    <div className="flex flex-col gap-6">
      <AlertBanner message="Reminders go out ahead of each due date, on the days set in Settings: shippers get an email, again once the invoice is overdue, and each carrier bill raises an alert to MGC's accounts team." />
      <Tabs
        aria-label="Reminders view"
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
        <Tab key="all" title={`All${countText(total)}`} />
        <Tab key={ReminderStatus.Scheduled} title={`Scheduled${countText(counts.data?.scheduled)}`} />
        <Tab key={ReminderStatus.Sent} title={`Sent${countText(counts.data?.sent)}`} />
        <Tab key={ReminderStatus.Skipped} title={`Skipped${countText(counts.data?.skipped)}`} />
      </Tabs>
      <FilterBar>
        <BaseInput
          name="search"
          control={control}
          className="max-w-sm"
          classNames={{ inputWrapper: "bg-[#FFFFFF66] h-12 border-1 rounded-lg" }}
          placeholder="Search by invoice # or party"
          endContent={<SearchNormalSm />}
        />
        {sideOptions.length > 2 && (
          <BaseSelect
            name="side"
            control={control}
            options={sideOptions}
            className="w-full sm:w-48"
            classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
            aria-label="Side"
            disallowEmptySelection
          />
        )}
        <div className="flex gap-2 sm:ml-auto">
          {can(Permission.ReportsExportCsv) && (
            <BaseButton
              text="Excel (CSV)"
              varient="bordered"
              className="text-base-primary rounded-xl px-3"
              startContent={<PiFileCsv className="text-lg" />}
              isDisabled={noRows || exportRows.isPending}
              onPress={exportCsv}
            />
          )}
          {can(Permission.ReportsExportPdf) && (
            <BaseButton
              text="PDF"
              varient="bordered"
              className="text-base-primary rounded-xl px-3"
              startContent={<PiFilePdf className="text-lg" />}
              isDisabled={noRows || exportRows.isPending}
              onPress={exportPdf}
            />
          )}
        </div>
      </FilterBar>
      <Card>
        {reminders.isError ? (
          <ErrorState
            message="We couldn't load the reminders. Please try again."
            onAction={() => void reminders.refetch()}
          />
        ) : (
          <BaseTable<Reminder>
            ariaLabel="Payment reminders"
            columns={columns}
            data={reminders.data?.items ?? []}
            loading={reminders.isPending}
            refreshing={reminders.isPlaceholderData}
            rowKey={(row) => row.id}
            renderCell={renderCell}
            meta={paging.tableMeta(reminders.data?.meta)}
            setMeta={paging.setMeta}
            bottomContent="Reminders"
            emptyContent="No reminders match these filters"
          />
        )}
      </Card>
      {open?.modal === "send" && <SendNowModal reminder={open.reminder} onClose={close} />}
      {open?.modal === "skip" && <SkipModal reminder={open.reminder} onClose={close} />}
    </div>
  );
}

function ReminderSummary({ reminder }: { reminder: Reminder }) {
  return (
    <p className="text-sm text-[#707070]">
      {invoiceLabel(reminder)} · {reminder.partyName} · due{" "}
      {formatDate(reminder.dueDate)} · balance{" "}
      <Money amount={reminder.balance} currency={reminder.currency} />
    </p>
  );
}

// Refetch the reminders after a change; on a 409 (it was sent or skipped
// meanwhile, or email is off) refetch so the screen shows what is true now.
const useReminderMutation = <T,>(
  action: (values: T) => Promise<Reminder>,
  onDone: (reminder: Reminder) => void,
  onClose: () => void
) => {
  const queryClient = useQueryClient();
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ["reminders"] });
  return useMutation({
    mutationFn: action,
    onSuccess: (reminder) => {
      onDone(reminder);
      refresh();
      onClose();
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      if (error instanceof ApiError && error.status === 409) refresh();
    },
  });
};

function SendNowModal({ reminder, onClose }: { reminder: Reminder; onClose: () => void }) {
  const send = useReminderMutation(
    () => sendReminder(reminder.direction, reminder.id),
    (sent) =>
      sent.status === ReminderStatus.Sent
        ? toast.success(`Reminder for ${invoiceLabel(sent)} sent.`)
        : toast.info(`Not sent: ${sent.note ?? "the reminder is no longer needed"}. It was skipped.`),
    onClose
  );
  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Send Reminder Now"
      confirmText="Send Now"
      onConfirm={() => send.mutate(undefined)}
      isConfirming={send.isPending}
    >
      <ReminderSummary reminder={reminder} />
      <p className="text-sm">
        {isReceivable(reminder)
          ? `Emails the reminder${reminder.recipient ? ` to ${reminder.recipient}` : ""} now instead of on ${formatDate(reminder.remindOn)}.`
          : `Alerts the accounts team now instead of on ${formatDate(reminder.remindOn)}.`}{" "}
        If the invoice has been paid or voided meanwhile, it is skipped instead.
      </p>
    </FormModal>
  );
}

type SkipValues = { reason: string };

function SkipModal({ reminder, onClose }: { reminder: Reminder; onClose: () => void }) {
  const { control, handleSubmit } = useForm<SkipValues>({
    defaultValues: { reason: "" },
  });
  const skip = useReminderMutation(
    (reason: string) => skipReminder(reminder.direction, reminder.id, reason),
    (skipped) => toast.success(`Reminder for ${invoiceLabel(skipped)} skipped.`),
    onClose
  );
  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Skip Reminder"
      confirmText="Skip Reminder"
      onConfirm={handleSubmit((values) => skip.mutate(values.reason.trim()))}
      isConfirming={skip.isPending}
    >
      <ReminderSummary reminder={reminder} />
      <BaseTextArea
        name="reason"
        control={control}
        label="Reason"
        placeholder="e.g. Paying by cheque this week, agreed by phone"
        rules={{
          validate: (value) => {
            const length = value.trim().length;
            if (length === 0) return "Say why it is skipped";
            return length <= 255 || "At most 255 characters";
          },
        }}
      />
    </FormModal>
  );
}
