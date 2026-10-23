import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BaseTable, ErrorState, StatusChip } from "@/components/common";
import { useServerTable } from "@/hooks";
import { SessionEndReason, SessionStatus } from "@/lib/enums";
import { SessionView } from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { Page } from "@/services";

const columns: BaseTableColumn[] = [
  { key: "startedAt", label: "Signed In" },
  { key: "device", label: "Device" },
  { key: "ip", label: "IP Address" },
  { key: "lastSeenAt", label: "Last Active" },
  { key: "duration", label: "Duration" },
  { key: "status", label: "Status" },
];

const endReasons: Record<SessionEndReason, string> = {
  [SessionEndReason.Logout]: "Signed out",
  [SessionEndReason.Replaced]: "Signed in elsewhere",
  [SessionEndReason.PasswordReset]: "Password reset",
  [SessionEndReason.Revoked]: "Ended by an Admin",
  [SessionEndReason.TokenReuse]: "Ended: token reused",
  [SessionEndReason.Locked]: "Ended: locked out",
};

// "2h 15m", to about a minute (what the API measures to).
const formatDuration = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "Under a minute";
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};

const device = (session: SessionView) =>
  session.deviceName ??
  ([session.browser, session.os && `on ${session.os}`].filter(Boolean).join(" ") ||
    "Unknown device");

function SessionStatusChip({ session }: { session: SessionView }) {
  if (session.isCurrent) return <StatusChip text="This session" tone="success" />;
  if (session.status === SessionStatus.Active) return <StatusChip text="Active" tone="primary" />;
  if (session.status === SessionStatus.Expired) return <StatusChip text="Expired" tone="neutral" />;
  return (
    <StatusChip
      text={session.endReason ? endReasons[session.endReason] : "Ended"}
      tone={session.endReason === SessionEndReason.TokenReuse ? "danger" : "neutral"}
    />
  );
}

// A sign-in history, newest first and paged by the API: yours on the
// profile page, a user's in Users & Roles.
export default function SessionsTable({
  queryKey,
  fetchPage,
}: {
  queryKey: readonly unknown[];
  fetchPage: (
    query: { page: number; limit: number },
    signal?: AbortSignal
  ) => Promise<Page<SessionView>>;
}) {
  const table = useServerTable(JSON.stringify(queryKey));
  const query = { page: table.page, limit: table.limit };
  const sessions = useQuery({
    queryKey: [...queryKey, query],
    queryFn: ({ signal }) => fetchPage(query, signal),
    placeholderData: keepPreviousData,
  });
  const { meta, setMeta } = table.pager(sessions.data?.meta);

  if (sessions.isError) {
    return (
      <ErrorState
        message="We couldn't load the sign-in history. Please try again."
        onAction={() => void sessions.refetch()}
      />
    );
  }

  return (
    <BaseTable<SessionView>
      ariaLabel="Sign-in history"
      columns={columns}
      data={sessions.data?.items ?? []}
      loading={sessions.isPending}
      rowKey={(row) => row.id}
      meta={meta}
      setMeta={setMeta}
      bottomContent="Sign-ins"
      emptyContent="No sign-ins yet"
      renderCell={(session, key) => {
        switch (key) {
          case "startedAt":
            return <span className="whitespace-nowrap">{formatDateTime(session.startedAt)}</span>;
          case "device":
            return (
              <div>
                <p>{device(session)}</p>
                {session.deviceType && (
                  <p className="text-xs text-gray-500">{session.deviceType}</p>
                )}
              </div>
            );
          case "ip":
            return <span className="font-mono">{session.ipAddress ?? "—"}</span>;
          case "lastSeenAt":
            return <span className="whitespace-nowrap">{formatDateTime(session.lastSeenAt)}</span>;
          case "duration":
            return formatDuration(session.durationSeconds);
          case "status":
            return <SessionStatusChip session={session} />;
          default:
            return null;
        }
      }}
    />
  );
}
