import { Card } from "@heroui/react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { LuRefreshCw } from "react-icons/lu";
import { PiClockClockwise, PiWarningCircle } from "react-icons/pi";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseSelect,
  BaseTable,
  ErrorState,
  FilterBar,
  StatCard,
  StatusChip,
  SyncStatusChip,
} from "@/components/common";
import { useServerPaging } from "@/hooks";
import { SyncInboxStatus } from "@/lib/enums";
import { SyncEvent, SyncRun } from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import {
  errorMessage,
  getSyncStatus,
  listSyncEvents,
  retrySyncEvent,
  runSync,
} from "@/services";

const ALL = "ALL";

const statusFilter = [
  { key: SyncInboxStatus.Failed, label: "Held", value: SyncInboxStatus.Failed },
  { key: ALL, label: "All events", value: ALL },
  { key: SyncInboxStatus.Applied, label: "Applied", value: SyncInboxStatus.Applied },
  { key: SyncInboxStatus.Received, label: "Waiting", value: SyncInboxStatus.Received },
  { key: SyncInboxStatus.Skipped, label: "Skipped", value: SyncInboxStatus.Skipped },
];

// The TMS record each event type is about (the sync contract's event types).
const eventTypeLabels: Record<string, string> = {
  "party.upserted": "Shipper or carrier",
  "party.deleted": "Shipper or carrier removed",
  "shipment.upserted": "Shipment",
  "shipment.deleted": "Shipment removed",
  "invoice.upserted": "TMS invoice",
  "invoice.deleted": "TMS invoice removed",
};

const columns: BaseTableColumn[] = [
  { key: "receivedAt", label: "Received" },
  { key: "type", label: "Change" },
  { key: "aggregateId", label: "TMS Id" },
  { key: "status", label: "Status" },
  { key: "attempts", label: "Tries" },
  { key: "error", label: "Reason" },
  { key: "actions", label: "" },
];

const runSummary = (run: SyncRun) =>
  `${run.pulled} pulled, ${run.applied} applied, ${run.failed} held, ${run.skipped} skipped`;

// The TMS sync (Admin only, routes.config). The API pulls TMS changes every
// minute while the sync is on; "Sync Now" runs one immediately. A change it
// can't apply is held with its reason and tried again on each run; "Retry"
// tries one now, after its cause is fixed (for example, a missing shipper).
export default function SyncStatus() {
  const queryClient = useQueryClient();
  const { control } = useForm({
    defaultValues: { status: SyncInboxStatus.Failed as string },
  });
  const status = useWatch({ control, name: "status" });
  const paging = useServerPaging(status);

  const sync = useQuery({
    queryKey: ["sync", "status"],
    queryFn: ({ signal }) => getSyncStatus(signal),
    // The scheduled run moves these figures without anyone here acting.
    refetchInterval: 30_000,
  });
  const params = {
    page: paging.page,
    limit: paging.limit,
    status: status !== ALL ? (status as SyncInboxStatus) : undefined,
  };
  const events = useQuery({
    queryKey: ["sync", "events", params],
    queryFn: ({ signal }) => listSyncEvents(params, signal),
    placeholderData: keepPreviousData,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["sync"] });

  const syncNow = useMutation({
    mutationFn: runSync,
    onSuccess: (run) => {
      if (run.error) toast.error(`The sync stopped early: ${run.error}`);
      else toast.success(`Sync finished: ${runSummary(run)}.`);
      void refresh();
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      void refresh();
    },
  });

  const retry = useMutation({
    mutationFn: (event: SyncEvent) => retrySyncEvent(event.eventId),
    onSuccess: (event) => {
      if (event.status === SyncInboxStatus.Failed)
        toast.error(`Still held: ${event.error ?? "no reason given"}`);
      else toast.success("The change was applied.");
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (sync.isError) {
    return (
      <ErrorState
        message={`We couldn't load the sync status: ${errorMessage(sync.error)}`}
        onAction={() => void sync.refetch()}
      />
    );
  }

  const s = sync.data;
  const lastRun = s?.lastRun ?? null;

  const renderCell = (event: SyncEvent, key: string) => {
    switch (key) {
      case "receivedAt":
        return <span className="whitespace-nowrap">{formatDateTime(event.receivedAt)}</span>;
      case "type":
        return eventTypeLabels[event.type] ?? event.type;
      case "aggregateId":
        return <span className="font-mono">{event.aggregateId}</span>;
      case "status":
        return <SyncStatusChip status={event.status} />;
      case "attempts":
        return event.attempts;
      case "error":
        // A minimum width, so on a phone the table scrolls rather than
        // squeezing the reason to a word per line.
        return event.error ? (
          <span className="block min-w-64 text-base-danger">{event.error}</span>
        ) : (
          <span className="text-gray-400">—</span>
        );
      case "actions":
        return event.status === SyncInboxStatus.Failed ? (
          <BaseButton
            text="Retry"
            varient="bordered"
            className="rounded-full px-3 text-base-primary"
            isLoading={retry.isPending && retry.variables?.eventId === event.eventId}
            isDisabled={retry.isPending}
            onPress={() => retry.mutate(event)}
          />
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-5">
      {s && !s.enabled && (
        <AlertBanner message="The TMS sync is turned off on this server, so nothing new comes in from the TMS. An administrator turns it on with MGC_SYNC_ENABLED and the TMS keys." />
      )}
      {lastRun?.error && (
        <AlertBanner message={`The last sync stopped early: ${lastRun.error}`} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          card={{
            icon: <PiClockClockwise className="text-[#45D483]" />,
            iconBgClass: "bg-icon-lightGreen",
            name: "Last Run",
            value: (lastRun && formatDateTime(lastRun.finishedAt)) ?? "—",
            caption: lastRun
              ? runSummary(lastRun)
              : "No run since the API server started",
          }}
          footer={
            s?.running ? (
              <StatusChip text="Running" tone="secondary" />
            ) : lastRun ? (
              lastRun.error ? (
                <StatusChip text="Stopped early" tone="danger" />
              ) : (
                <StatusChip text="Completed" tone="success" />
              )
            ) : undefined
          }
        />
        <StatCard
          card={{
            icon: <LuRefreshCw className="text-base-primary-200" />,
            iconBgClass: "bg-icon-lightDarkBlue",
            name: "TMS Changes Read Up To",
            value: (s && formatDateTime(s.cursorUpdatedAt)) ?? "—",
            caption: s?.enabled ? "Checked every minute" : "Sync is off",
          }}
          footer={
            <BaseButton
              text="Sync Now"
              className="rounded-full px-5 w-fit"
              isLoading={syncNow.isPending}
              isDisabled={!s?.enabled || s.running}
              onPress={() => syncNow.mutate()}
            />
          }
        />
        <StatCard
          card={{
            icon: <PiWarningCircle className="text-[#F5A524]" />,
            iconBgClass: "bg-icon-lightPurple",
            name: "Held Changes",
            value: s ? String(s.inbox[SyncInboxStatus.Failed]) : "—",
            caption: s
              ? `${s.inbox[SyncInboxStatus.Applied]} applied, ${s.inbox[SyncInboxStatus.Received]} waiting, ${s.inbox[SyncInboxStatus.Skipped]} skipped`
              : undefined,
          }}
          footer={
            s && (s.outbox.pending > 0 || s.outbox.rejected > 0) ? (
              <p className="text-xs text-[#8F9494]">
                To the TMS: {s.outbox.pending} waiting, {s.outbox.rejected} refused
              </p>
            ) : undefined
          }
        />
      </div>

      <FilterBar>
        <BaseSelect
          name="status"
          control={control}
          options={statusFilter}
          className="w-full sm:w-44"
          classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
          aria-label="Status"
          disallowEmptySelection
        />
      </FilterBar>
      <Card>
        {events.isError ? (
          <ErrorState
            message={`We couldn't load the sync events: ${errorMessage(events.error)}`}
            onAction={() => void events.refetch()}
          />
        ) : (
          <BaseTable<SyncEvent>
            ariaLabel="TMS sync events"
            columns={columns}
            data={events.data?.items ?? []}
            loading={events.isPending}
            rowKey={(row) => row.eventId}
            renderCell={renderCell}
            meta={paging.tableMeta(events.data?.meta)}
            setMeta={paging.setMeta}
            bottomContent="Events"
            emptyContent={
              status === SyncInboxStatus.Failed ? "Nothing is held" : "No events"
            }
          />
        )}
      </Card>
    </div>
  );
}
