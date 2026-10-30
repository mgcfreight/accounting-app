import { Card, Tab, Tabs } from "@heroui/react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { LuSend, LuSkipForward } from "react-icons/lu";
import { PiFileCsv, PiFilePdf } from "react-icons/pi";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseSelect,
  BaseTable,
  BaseTextArea,
  ClearFiltersButton,
  FilterBar,
  FormModal,
  Money,
  PartyAvatar,
  RowActions,
  StatusChip,
} from "@/components/common";
import { RowAction } from "@/components/common/row-actions";
import { useCan } from "@/components/providers/user-provider";
import { useClientTable } from "@/hooks";
import {
  InvoiceDirection,
  Permission,
  ReminderChannel,
  ReminderStatus,
} from "@/lib/enums";
import { downloadCsv, ExportTable, printTable } from "@/lib/export";
import { Reminder } from "@/lib/interfaces";
import { mockReminders, REMINDER_DAYS_BEFORE_DUE } from "@/lib/mock";
import { BaseTableColumn } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { moneyText } from "../reports/export-table";

type View = "all" | ReminderStatus;
type Filters = { side: string };
type OpenModal = { modal: "send" | "skip"; reminder: Reminder };

const ALL = "ALL";

const columns: BaseTableColumn[] = [
  { key: "invoice", label: "Invoice", sortable: true, sortKey: "invoiceNumber" },
  { key: "party", label: "Party", sortable: true, sortKey: "partyName" },
  { key: "side", label: "Side" },
  { key: "dueDate", label: "Due Date", sortable: true, sortType: "date" },
  { key: "remindOn", label: "Remind On", sortable: true, sortType: "date" },
  { key: "balance", label: "Balance", sortType: "money", align: "end" },
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

// Text for the exports: amounts and dates as the table shows them.
const exportTable = (rows: Reminder[], subtitle: string): ExportTable<Reminder> => ({
  title: "Payment Reminders",
  subtitle,
  rows,
  columns: [
    { label: "Invoice", value: (r) => r.invoiceNumber },
    { label: "Party", value: (r) => r.partyName },
    { label: "Side", value: sideLabel },
    { label: "Due date", value: (r) => formatDate(r.dueDate) ?? "" },
    { label: "Remind on", value: (r) => formatDate(r.remindOn) ?? "" },
    { label: "Balance", value: (r) => moneyText(r.balance, r.currency) },
    { label: "Channel", value: (r) => channelLabels[r.channel] },
    { label: "Recipient", value: (r) => r.recipient },
    { label: "Status", value: (r) => reminderStatus[r.status].label },
    {
      label: "Sent / note",
      value: (r) => (r.sentAt ? formatDateTime(r.sentAt) ?? "" : r.note ?? ""),
    },
  ],
});

// Payment reminders, 7 days before each due date (requirement 1): an email
// to the shipper's accounts department, or an alert to MGC's accounts team
// that a carrier bill falls due. Mock data: nothing is sent yet, and "Send
// now" and "Skip" are demos.
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
  const {
    control,
    reset,
    formState: { isDirty },
  } = useForm<Filters>({ defaultValues: { side: ALL } });
  const side = useWatch({ control, name: "side" });

  const visible = useMemo(
    () =>
      mockReminders.filter((reminder) =>
        isReceivable(reminder) ? canViewShipper : canViewCarrier
      ),
    [canViewShipper, canViewCarrier]
  );
  const count = (status: ReminderStatus) =>
    visible.filter((reminder) => reminder.status === status).length;

  const filtered = useMemo(
    () =>
      visible.filter(
        (reminder) =>
          (view === "all" || reminder.status === view) &&
          (side === ALL || reminder.direction === side)
      ),
    [visible, view, side]
  );

  const table = useClientTable(filtered, columns, {
    column: "remindOn",
    sortKey: "remindOn",
    direction: "desc",
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
  } · Demo data`;
  // Every row the filters show, across pages.
  const exportCsv = () => downloadCsv(exportTable(filtered, subtitle));
  const exportPdf = () => {
    if (!printTable(exportTable(filtered, subtitle))) {
      toast.error("The print window was blocked. Allow pop-ups for this site and try again.");
    }
  };

  const renderCell = (reminder: Reminder, key: string) => {
    switch (key) {
      case "invoice":
        return <span className="font-bold whitespace-nowrap">{reminder.invoiceNumber}</span>;
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
        return <span className="break-all">{reminder.recipient}</span>;
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
      <AlertBanner
        message={`Reminders go out ${REMINDER_DAYS_BEFORE_DUE} days before an invoice's due date: shippers get an email to their accounts department, and each carrier bill raises an alert to MGC's accounts team. Demo data — nothing is sent yet.`}
      />
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
        <Tab key="all" title={`All (${visible.length})`} />
        <Tab key={ReminderStatus.Scheduled} title={`Scheduled (${count(ReminderStatus.Scheduled)})`} />
        <Tab key={ReminderStatus.Sent} title={`Sent (${count(ReminderStatus.Sent)})`} />
        <Tab key={ReminderStatus.Skipped} title={`Skipped (${count(ReminderStatus.Skipped)})`} />
      </Tabs>
      <FilterBar>
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
        <ClearFiltersButton active={isDirty} onClear={() => reset()} />
        <div className="flex gap-2 sm:ml-auto">
          {can(Permission.ReportsExportCsv) && (
            <BaseButton
              text="Excel (CSV)"
              varient="bordered"
              className="text-base-primary rounded-xl px-3"
              startContent={<PiFileCsv className="text-lg" />}
              isDisabled={filtered.length === 0}
              onPress={exportCsv}
            />
          )}
          {can(Permission.ReportsExportPdf) && (
            <BaseButton
              text="PDF"
              varient="bordered"
              className="text-base-primary rounded-xl px-3"
              startContent={<PiFilePdf className="text-lg" />}
              isDisabled={filtered.length === 0}
              onPress={exportPdf}
            />
          )}
        </div>
      </FilterBar>
      <Card>
        <BaseTable
          ariaLabel="Payment reminders"
          columns={columns}
          data={table.pageRows}
          rowKey={(row) => row.id}
          renderCell={renderCell}
          meta={table.meta}
          setMeta={table.setMeta}
          sort={table.sort}
          onSortChange={table.onSortChange}
          bottomContent="Reminders"
          emptyContent="No reminders"
        />
      </Card>
      {open?.modal === "send" && <SendNowModal reminder={open.reminder} onClose={close} />}
      {open?.modal === "skip" && <SkipModal reminder={open.reminder} onClose={close} />}
    </div>
  );
}

function ReminderSummary({ reminder }: { reminder: Reminder }) {
  return (
    <p className="text-sm text-[#707070]">
      {reminder.invoiceNumber} · {reminder.partyName} · due{" "}
      {formatDate(reminder.dueDate)} · balance{" "}
      <Money amount={reminder.balance} currency={reminder.currency} />
    </p>
  );
}

function SendNowModal({ reminder, onClose }: { reminder: Reminder; onClose: () => void }) {
  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Send Reminder Now"
      confirmText="Send Now"
      onConfirm={() => {
        toast.info("Reminder sent — demo only, nothing was sent.");
        onClose();
      }}
    >
      <ReminderSummary reminder={reminder} />
      <p className="text-sm">
        {isReceivable(reminder)
          ? `Emails the reminder to ${reminder.recipient} now instead of on ${formatDate(reminder.remindOn)}.`
          : `Alerts the accounts team now instead of on ${formatDate(reminder.remindOn)}.`}
      </p>
    </FormModal>
  );
}

type SkipValues = { reason: string };

function SkipModal({ reminder, onClose }: { reminder: Reminder; onClose: () => void }) {
  const { control, handleSubmit } = useForm<SkipValues>({
    defaultValues: { reason: "" },
  });
  const submit = handleSubmit(() => {
    toast.info("Reminder skipped — demo only, nothing was saved.");
    onClose();
  });
  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Skip Reminder"
      confirmText="Skip Reminder"
      onConfirm={submit}
    >
      <ReminderSummary reminder={reminder} />
      <BaseTextArea
        name="reason"
        control={control}
        label="Reason"
        placeholder="e.g. Paying by cheque this week, agreed by phone"
        rules={{
          required: "Say why it is skipped",
          maxLength: { value: 255, message: "At most 255 characters" },
        }}
      />
    </FormModal>
  );
}
