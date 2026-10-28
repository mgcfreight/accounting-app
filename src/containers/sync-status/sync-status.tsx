import { Card } from "@heroui/react";
import { useState } from "react";
import { LuRefreshCw } from "react-icons/lu";
import { PiCalendarCheck, PiClockClockwise } from "react-icons/pi";
import { toast } from "sonner";
import {
  BaseButton,
  BaseCardWrapper,
  BaseTable,
  StatCard,
  SyncStatusChip,
} from "@/components/common";
import { SyncResource, SyncRun } from "@/lib/interfaces";
import { mockSyncResources, mockSyncRuns, mockSyncSummary } from "@/lib/mock";
import { BaseTableColumn } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const resourceColumns: BaseTableColumn[] = [
  { key: "resource", label: "Resource" },
  { key: "checkpoint", label: "Changes Up To" },
  { key: "recordsLastRun", label: "Records Last Run" },
];

const runColumns: BaseTableColumn[] = [
  { key: "id", label: "Run" },
  { key: "startedAt", label: "Started" },
  { key: "status", label: "Status" },
  { key: "records", label: "Records" },
  { key: "error", label: "Error" },
];

// Design §6.2: the sync pulls from MGC every 10 minutes; "Sync now" runs one
// immediately.
export default function SyncStatus() {
  const [syncing, setSyncing] = useState(false);
  const s = mockSyncSummary;

  const syncNow = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      toast.info("Sync now — demo only. The sync job runs in the Accounts API.");
    }, 800);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          card={{
            icon: <PiClockClockwise className="text-[#45D483]" />,
            iconBgClass: "bg-icon-lightGreen",
            name: "Last Run",
            value: formatDateTime(s.lastRunAt) ?? "—",
            caption: `${s.consecutiveFailures} failures in a row`,
          }}
          footer={<SyncStatusChip status={s.lastStatus} />}
        />
        <StatCard
          card={{
            icon: <LuRefreshCw className="text-base-primary-200" />,
            iconBgClass: "bg-icon-lightDarkBlue",
            name: "Next Run",
            value: formatDateTime(s.nextRunAt) ?? "—",
            caption: "Every 10 minutes",
          }}
          footer={
            <BaseButton
              text="Sync Now"
              className="rounded-full px-5 w-fit"
              isLoading={syncing}
              onPress={syncNow}
            />
          }
        />
        <StatCard
          card={{
            icon: <PiCalendarCheck className="text-[#BC8EF0]" />,
            iconBgClass: "bg-icon-lightPurple",
            name: "Nightly Check",
            value: formatDateTime(s.nightlyCheckAt) ?? "—",
            caption: s.nightlyCheckResult,
          }}
        />
      </div>

      <BaseCardWrapper heading="Checkpoints">
        <BaseTable<SyncResource>
          ariaLabel="Sync checkpoints"
          columns={resourceColumns}
          data={mockSyncResources}
          rowKey={(row) => row.resource}
          renderCell={(row, key) =>
            key === "checkpoint" ? (
              <span className="whitespace-nowrap">{formatDateTime(row.checkpoint)}</span>
            ) : (
              String(row[key as keyof SyncResource])
            )
          }
        />
      </BaseCardWrapper>

      <Card>
        <div className="p-4 pb-0">
          <h1 className="text-base-primary-300 text-xl">Recent Runs</h1>
        </div>
        <BaseTable<SyncRun>
          ariaLabel="Sync runs"
          columns={runColumns}
          data={mockSyncRuns}
          rowKey={(row) => row.id}
          renderCell={(row, key) => {
            switch (key) {
              case "startedAt":
                return <span className="whitespace-nowrap">{formatDateTime(row.startedAt)}</span>;
              case "status":
                return <SyncStatusChip status={row.status} />;
              case "error":
                // A minimum width, so on a phone the table scrolls rather
                // than squeezing the message to a word per line.
                return row.error ? (
                  <span className="block min-w-48 text-base-danger">{row.error}</span>
                ) : (
                  <span className="text-gray-400">—</span>
                );
              default:
                return String(row[key as keyof SyncRun] ?? "");
            }
          }}
        />
      </Card>
    </div>
  );
}
