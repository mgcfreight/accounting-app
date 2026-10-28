import { Card } from "@heroui/react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseSelect,
  BaseTable,
  FilterBar,
  FormModal,
  PartyAvatar,
  RowActions,
  StatusChip,
} from "@/components/common";
import { ChipTone } from "@/components/common/status-chip";
import {
  useCurrentUser,
  useUser,
} from "@/components/providers/user-provider";
import { useServerPaging } from "@/hooks";
import { LOGIN_PATH } from "@/lib/constants";
import { SessionStatus } from "@/lib/enums";
import { UserSession } from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import {
  formatDateTime,
  formatDuration,
  fullName,
  humanize,
} from "@/lib/utils";
import {
  endSession,
  errorMessage,
  listSessions,
  listUsers,
} from "@/services";

type Filters = { userId: string; status: string };

const ALL = "ALL";
// Users have 14-character ids; anything else in ?userId= is ignored.
const USER_ID_SHAPE = /^[A-Za-z0-9_]{14}$/;

const statusTone: Record<SessionStatus, ChipTone> = {
  [SessionStatus.Active]: "success",
  [SessionStatus.Ended]: "neutral",
  [SessionStatus.Expired]: "warning",
};

const statusFilter = [
  { key: ALL, label: "All statuses", value: ALL },
  ...Object.values(SessionStatus).map((status) => ({
    key: status,
    label: humanize(status),
    value: status,
  })),
];

const device = (session: UserSession) =>
  [session.browser, session.os, session.deviceName ?? session.deviceType]
    .filter(Boolean)
    .join(" · ") || "Unknown device";

// Sign-in sessions. The API decides whose: an Admin gets everyone's (and can
// pick one user), any other role only their own. Only one session per user
// is active at a time; a new sign-in ends the last one as "Replaced".
export default function SessionReport() {
  const me = useCurrentUser();
  const { signOut } = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = me.isAdmin;
  const [searchParams] = useSearchParams();
  const linkedUser = searchParams.get("userId") ?? "";
  const { control } = useForm<Filters>({
    defaultValues: {
      userId: isAdmin && USER_ID_SHAPE.test(linkedUser) ? linkedUser : ALL,
      status: ALL,
    },
  });
  const userId = useWatch({ control, name: "userId" });
  const status = useWatch({ control, name: "status" });
  const paging = useServerPaging(JSON.stringify([userId, status]));

  // The user picker, for Admins only (other roles can't list users).
  const users = useQuery({
    queryKey: ["users", "picker"],
    queryFn: ({ signal }) =>
      listUsers({ page: 1, limit: 100, sortBy: "name", order: "ASC" }, signal),
    enabled: isAdmin,
  });

  const params = {
    page: paging.page,
    limit: paging.limit,
    userId: isAdmin && userId !== ALL ? userId : undefined,
    status: status !== ALL ? (status as SessionStatus) : undefined,
  };
  const sessions = useQuery({
    queryKey: ["sessions", params],
    queryFn: ({ signal }) => listSessions(params, signal),
    placeholderData: keepPreviousData,
  });

  // Ending your own current session signs you out here too.
  const [ending, setEnding] = useState<UserSession | null>(null);
  const end = useMutation({
    mutationFn: (session: UserSession) => endSession(session.id),
    onSuccess: async (message, session) => {
      setEnding(null);
      if (session.isCurrent) {
        await signOut();
        navigate(LOGIN_PATH);
        return;
      }
      toast.success(message);
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const columns: BaseTableColumn[] = [
    ...(isAdmin ? [{ key: "user", label: "User" }] : []),
    { key: "device", label: "Device" },
    { key: "ipAddress", label: "IP Address" },
    { key: "startedAt", label: "Signed In" },
    { key: "lastSeenAt", label: "Last Active" },
    { key: "end", label: "Ended / Expires" },
    { key: "duration", label: "Duration" },
    { key: "status", label: "Status" },
    { key: "actions", label: "" },
  ];

  const renderCell = (row: UserSession, key: string) => {
    switch (key) {
      case "user":
        return row.user ? (
          <PartyAvatar name={fullName(row.user)} subtitle={row.user.email} />
        ) : (
          <span className="text-gray-500">Unknown user</span>
        );
      case "device":
        return (
          <div>
            <p className="font-semibold">{device(row)}</p>
            {row.isCurrent && (
              <p className="text-base-primary-300">This device</p>
            )}
          </div>
        );
      case "ipAddress":
        return <span className="font-mono">{row.ipAddress ?? "—"}</span>;
      case "startedAt":
        return (
          <span className="whitespace-nowrap">
            {formatDateTime(row.startedAt)}
          </span>
        );
      case "lastSeenAt":
        return (
          <span className="whitespace-nowrap">
            {formatDateTime(row.lastSeenAt)}
          </span>
        );
      case "end":
        return (
          <span className="whitespace-nowrap">
            {formatDateTime(row.endedAt ?? row.expiresAt)}
          </span>
        );
      case "duration":
        return formatDuration(row.durationSeconds);
      case "status":
        return (
          <div className="flex flex-col items-start gap-1">
            <StatusChip
              text={humanize(row.status)}
              tone={statusTone[row.status]}
            />
            {row.endReason && (
              <span className="text-gray-500">{humanize(row.endReason)}</span>
            )}
          </div>
        );
      case "actions":
        return row.status === SessionStatus.Active ? (
          <RowActions
            actions={[
              {
                key: "end",
                label: row.isCurrent ? "End (signs you out)" : "End session",
                danger: true,
                onPress: () => setEnding(row),
              },
            ]}
          />
        ) : null;
      default:
        return null;
    }
  };

  const userOptions = [
    { key: ALL, label: "All users", value: ALL },
    ...(users.data?.items ?? []).map((user) => ({
      key: user.id,
      label: fullName(user),
      value: user.id,
    })),
  ];
  // A user linked from the Users page who isn't in the first 100 still shows.
  if (userId !== ALL && !userOptions.some((option) => option.key === userId)) {
    userOptions.push({ key: userId, label: "Selected user", value: userId });
  }

  return (
    <div className="flex flex-col gap-6">
      <FilterBar>
        {isAdmin && (
          <BaseSelect
            name="userId"
            control={control}
            options={userOptions}
            className="w-full sm:w-56"
            classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
            aria-label="User"
            disallowEmptySelection
            isLoading={users.isPending}
          />
        )}
        <BaseSelect
          name="status"
          control={control}
          options={statusFilter}
          className="w-full sm:w-44"
          classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
          aria-label="Status"
          disallowEmptySelection
        />
        {!isAdmin && (
          <p className="text-sm text-content-6">Showing your own sign-ins.</p>
        )}
      </FilterBar>
      {sessions.isError && (
        <AlertBanner
          message={`Couldn't load sessions: ${errorMessage(sessions.error)}`}
          action={
            <button
              type="button"
              className="underline text-sm"
              onClick={() => void sessions.refetch()}
            >
              Retry
            </button>
          }
        />
      )}
      <Card>
        <BaseTable<UserSession>
          ariaLabel="Sessions"
          columns={columns}
          data={sessions.isError ? [] : (sessions.data?.items ?? [])}
          loading={sessions.isPending}
          refreshing={sessions.isPlaceholderData}
          rowKey={(row) => row.id}
          renderCell={renderCell}
          meta={paging.tableMeta(sessions.data?.meta)}
          setMeta={paging.setMeta}
          bottomContent="Sessions"
          emptyContent={
            sessions.isError ? "Couldn't load sessions." : "No sessions."
          }
        />
      </Card>
      {ending && (
        <FormModal
          isOpen
          onOpenChange={(open) => !open && setEnding(null)}
          title="End Session"
          confirmText="End Session"
          isConfirming={end.isPending}
          onConfirm={() => end.mutate(ending)}
        >
          <p className="text-sm">
            {ending.isCurrent
              ? "This is your current session: you'll be signed out now."
              : `${ending.user ? fullName(ending.user) : "This user"} will be signed out of ${device(ending)} and must sign in again.`}
          </p>
        </FormModal>
      )}
    </div>
  );
}
