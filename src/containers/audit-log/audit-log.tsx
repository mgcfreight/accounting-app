import { Card } from "@heroui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  BaseButton,
  BaseInput,
  BaseSelect,
  BaseTable,
  ErrorState,
  FilterBar,
  FormModal,
  PartyAvatar,
  RowActions,
  StatusChip,
} from "@/components/common";
import { EyeIcon, SearchNormalSm } from "@/components/icons";
import { useDebouncedValue, useServerTable } from "@/hooks";
import { auditActionLabels } from "@/lib/constants";
import { AuditAction, AuditTargetType } from "@/lib/enums";
import { AuditDetails, AuditEventView } from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import { formatDateTime, fullName, humanize } from "@/lib/utils";
import { getAuditEvents } from "@/services";

type Filters = { action: string; targetId: string };

// Narrowing to one user or one sign-in, picked from a row.
type Scope = { kind: "actor" | "session"; id: string; label: string };

const columns: BaseTableColumn[] = [
  { key: "at", label: "Time" },
  { key: "user", label: "User" },
  { key: "action", label: "Action" },
  { key: "record", label: "Record" },
  { key: "ip", label: "IP Address" },
  { key: "details", label: "Details" },
  { key: "actions", label: "" },
];

const actionOptions = [
  { key: "ALL", label: "All actions", value: "ALL" },
  ...Object.values(AuditAction).map((action) => ({
    key: action,
    label: auditActionLabels[action],
    value: action,
  })),
];

// Where a record opens. Parties aren't linked: the event doesn't say whether
// it's a shipper or a carrier.
const recordHref = (event: AuditEventView) => {
  if (!event.targetId) return null;
  const id = encodeURIComponent(event.targetId);
  switch (event.targetType) {
    case AuditTargetType.CustomerInvoice:
      return `/shipper-invoices/view/?id=${id}`;
    case AuditTargetType.CarrierInvoice:
      return `/carrier-invoices/view/?id=${id}`;
    default:
      return null;
  }
};

// `{ role: { from, to } }` reads "role: Viewer → Accountant".
const summarize = (details: AuditDetails | null) =>
  Object.entries(details ?? {})
    .map(([field, value]) => {
      if (value !== null && typeof value === "object") {
        return "from" in value || "to" in value
          ? `${field}: ${String(value.from ?? "—")} → ${String(value.to ?? "—")}`
          : `${field}: ${JSON.stringify(value)}`;
      }
      return `${field}: ${String(value)}`;
    })
    .join(", ");

// Design §11: the append-only history, read-only, from GET /audit/events
// (Admin only). Newest first, filtered and paged by the API.
export default function AuditLog() {
  const [open, setOpen] = useState<AuditEventView | null>(null);
  const [scope, setScope] = useState<Scope | null>(null);
  const { control } = useForm<Filters>({
    defaultValues: { action: "ALL", targetId: "" },
  });
  const action = useWatch({ control, name: "action" });
  const targetId = useDebouncedValue(useWatch({ control, name: "targetId" }).trim());

  const table = useServerTable(JSON.stringify([action, targetId, scope?.id]));
  const query = {
    page: table.page,
    limit: table.limit,
    ...(action !== "ALL" && { action: action as AuditAction }),
    ...(targetId && { targetId: targetId.slice(0, 64) }),
    ...(scope?.kind === "actor" && { actorId: scope.id }),
    ...(scope?.kind === "session" && { sessionId: scope.id }),
  };
  const events = useQuery({
    queryKey: ["audit", query],
    queryFn: ({ signal }) => getAuditEvents(query, signal),
    placeholderData: keepPreviousData,
  });
  const { meta, setMeta } = table.pager(events.data?.meta);

  const renderCell = (event: AuditEventView, key: string) => {
    switch (key) {
      case "at":
        return <span className="whitespace-nowrap">{formatDateTime(event.createdAt)}</span>;
      case "user":
        return event.actor ? (
          <PartyAvatar name={fullName(event.actor)} subtitle={event.actor.email} />
        ) : (
          <span className="text-gray-400">No signed-in user</span>
        );
      case "action":
        return <StatusChip text={auditActionLabels[event.action]} tone="neutral" />;
      case "record": {
        if (!event.targetType) return <span className="text-gray-400">—</span>;
        const href = recordHref(event);
        return (
          <div>
            <p className="font-semibold">{humanize(event.targetType)}</p>
            {href ? (
              <Link to={href} className="font-mono text-base-primary-300 hover:underline">
                {event.targetId}
              </Link>
            ) : (
              <p className="font-mono text-gray-500">{event.targetId}</p>
            )}
          </div>
        );
      }
      case "ip":
        return <span className="font-mono">{event.ipAddress ?? "—"}</span>;
      case "details":
        return <span className="line-clamp-2 max-w-md">{summarize(event.details)}</span>;
      case "actions":
        return (
          <RowActions
            actions={[
              { key: "view", label: "View details", icon: <EyeIcon />, onPress: () => setOpen(event) },
              ...(event.actor
                ? [{
                    key: "actor",
                    label: "Show this user's activity",
                    onPress: () =>
                      setScope({ kind: "actor", id: event.actor!.id, label: fullName(event.actor!) }),
                  }]
                : []),
              ...(event.sessionId
                ? [{
                    key: "session",
                    label: "Show this sign-in's activity",
                    onPress: () =>
                      setScope({ kind: "session", id: event.sessionId!, label: `sign-in ${event.sessionId}` }),
                  }]
                : []),
            ]}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <FilterBar>
        <BaseInput
          name="targetId"
          control={control}
          className="max-w-sm"
          classNames={{ inputWrapper: "bg-[#FFFFFF66] h-12 border-1 rounded-lg" }}
          placeholder="Record id (exact), e.g. usr_4fK9qZ0aB1"
          endContent={<SearchNormalSm />}
        />
        <BaseSelect
          name="action"
          control={control}
          options={actionOptions}
          className="w-full sm:w-60"
          classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
          aria-label="Action"
          disallowEmptySelection
        />
        {scope && (
          <div className="flex items-center gap-2">
            <StatusChip text={`Only ${scope.label}`} tone="primary" />
            <BaseButton
              text="Clear"
              varient="light"
              className="text-base-primary px-2 min-w-0"
              onPress={() => setScope(null)}
            />
          </div>
        )}
      </FilterBar>
      <Card className="mt-4">
        {events.isError ? (
          <ErrorState
            message="We couldn't load the audit log. Please try again."
            onAction={() => void events.refetch()}
          />
        ) : (
          <BaseTable<AuditEventView>
            ariaLabel="Audit log"
            columns={columns}
            data={events.data?.items ?? []}
            loading={events.isPending}
            rowKey={(row) => row.id}
            renderCell={renderCell}
            meta={meta}
            setMeta={setMeta}
            bottomContent="Entries"
            emptyContent="No entries match these filters"
          />
        )}
      </Card>
      {open && (
        <FormModal
          isOpen
          onOpenChange={(isOpen) => !isOpen && setOpen(null)}
          title={auditActionLabels[open.action]}
          confirmText="Close"
          onConfirm={() => setOpen(null)}
          size="2xl"
        >
          <div className="text-sm text-[#343A40] space-y-1">
            <p>
              <strong>When:</strong> {formatDateTime(open.createdAt)}
            </p>
            <p>
              <strong>Who:</strong>{" "}
              {open.actor ? `${fullName(open.actor)} (${open.actor.email})` : "No signed-in user"}
            </p>
            {open.targetType && (
              <p>
                <strong>Record:</strong> {humanize(open.targetType)} {open.targetId}
              </p>
            )}
            <p>
              <strong>Sign-in:</strong> {open.sessionId ?? "—"}
            </p>
            <p>
              <strong>IP address:</strong> {open.ipAddress ?? "—"}
            </p>
            <p className="break-all">
              <strong>Browser:</strong> {open.userAgent ?? "—"}
            </p>
          </div>
          <p className="text-xs font-semibold uppercase text-base-primary">Details</p>
          {/* Rendered as text by React, so field values cannot inject markup. */}
          <pre className="bg-content-2 rounded-lg p-3 text-xs overflow-auto">
            {open.details ? JSON.stringify(open.details, null, 2) : "—"}
          </pre>
        </FormModal>
      )}
    </>
  );
}
