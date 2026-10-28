import { Card } from "@heroui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  AlertBanner,
  BaseInput,
  BaseSelect,
  BaseTable,
  DetailRow,
  FilterBar,
  FormModal,
  PartyAvatar,
  RowActions,
  StatusChip,
} from "@/components/common";
import { EyeIcon } from "@/components/icons";
import { useCurrentUser } from "@/components/providers/user-provider";
import { useServerPaging } from "@/hooks";
import { AuditEvent } from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import { formatDateTime, fullName, torontoDayBounds } from "@/lib/utils";
import { errorMessage, listAuditEvents, listUsers } from "@/services";

type Filters = { actorId: string; action: string; targetType: string; from: string; to: string };

const ALL = "ALL";

// The actions the API records — its AuditAction enum, which rejects any other
// value as a filter. Keep in step with the backend's src/types/index.ts.
const ACTIONS = [
  "auth.signed_in",
  "auth.sign_in_failed",
  "auth.signed_out",
  "auth.2fa_code_rejected",
  "auth.account_locked",
  "auth.refresh_token_reused",
  "auth.password_changed",
  "auth.password_reset_requested",
  "auth.password_reset",
  "auth.2fa_enabled",
  "auth.2fa_disabled",
  "auth.2fa_email_code_sent",
  "auth.recovery_codes_regenerated",
  "user.created",
  "user.updated",
  "user.enabled",
  "user.disabled",
  "user.password_set",
  "user.2fa_reset",
  "session.revoked",
  "party.created",
  "party.agreement_created",
  "shipment.created",
  "customer_invoice.updated",
  "customer_invoice.issued",
  "customer_invoice.revised",
  "carrier_invoice.updated",
  "carrier_invoice.received",
  "carrier_invoice.approved",
  "carrier_invoice.revised",
  "settings.updated",
  "tax_rate.created",
  "charge_type.created",
  "charge_type.updated",
  "accounting_period.closed",
  "accounting_period.reopened",
  "role.created",
  "role.updated",
  "role.deleted",
];

// The API's AuditTargetType enum.
const TARGET_TYPES = [
  "user",
  "party",
  "shipment",
  "customer_invoice",
  "carrier_invoice",
  "setting",
  "tax_rate",
  "charge_type",
  "accounting_period",
  "role",
];

const option = (value: string, label = value) => ({ key: value, label, value });

// "auth.2fa_enabled" -> "2fa enabled"; the group shows as the chip's tone.
const actionLabel = (action: string) => action.split(".").slice(1).join(".").replace(/_/g, " ") || action;
const isFailure = (action: string) =>
  /failed|rejected|locked|reused/.test(action);

// Who did what, and when (audit_events). The API decides whose: an Admin sees
// every event, any other role only the ones they made. Read-only.
export default function AuditLog() {
  const me = useCurrentUser();
  const isAdmin = me.isAdmin;
  const [open, setOpen] = useState<AuditEvent | null>(null);
  const { control } = useForm<Filters>({
    defaultValues: { actorId: ALL, action: ALL, targetType: ALL, from: "", to: "" },
  });
  const filters = useWatch({ control }) as Filters;
  const paging = useServerPaging(JSON.stringify(filters));

  const users = useQuery({
    queryKey: ["users", "picker"],
    queryFn: ({ signal }) =>
      listUsers({ page: 1, limit: 100, sortBy: "name", order: "ASC" }, signal),
    enabled: isAdmin,
  });

  const pick = (value: string | undefined) => (value && value !== ALL ? value : undefined);
  const params = {
    page: paging.page,
    limit: paging.limit,
    actorId: isAdmin ? pick(filters.actorId) : undefined,
    action: pick(filters.action),
    targetType: pick(filters.targetType),
    from: filters.from ? torontoDayBounds(filters.from).start : undefined,
    to: filters.to ? torontoDayBounds(filters.to).end : undefined,
  };
  const events = useQuery({
    queryKey: ["audit", params],
    queryFn: ({ signal }) => listAuditEvents(params, signal),
    placeholderData: keepPreviousData,
  });

  const columns: BaseTableColumn[] = [
    { key: "createdAt", label: "Time" },
    ...(isAdmin ? [{ key: "actor", label: "User" }] : []),
    { key: "action", label: "Action" },
    { key: "target", label: "Record" },
    { key: "ipAddress", label: "IP Address" },
    { key: "actions", label: "Actions", align: "center" },
  ];

  const renderCell = (event: AuditEvent, key: string) => {
    switch (key) {
      case "createdAt":
        return <span className="whitespace-nowrap">{formatDateTime(event.createdAt)}</span>;
      case "actor":
        return event.actor ? (
          <PartyAvatar name={fullName(event.actor)} subtitle={event.actor.email} />
        ) : (
          <span className="text-gray-500">System / unknown</span>
        );
      case "action":
        return (
          <div className="flex flex-col items-start gap-1">
            <StatusChip text={actionLabel(event.action)} tone={isFailure(event.action) ? "danger" : "neutral"} />
            <span className="font-mono text-gray-500">{event.action}</span>
          </div>
        );
      case "target":
        return event.targetType ? (
          <div>
            <p className="font-semibold">{event.targetType.replace(/_/g, " ")}</p>
            <p className="font-mono text-gray-500">{event.targetId ?? "—"}</p>
          </div>
        ) : (
          "—"
        );
      case "ipAddress":
        return <span className="font-mono">{event.ipAddress ?? "—"}</span>;
      case "actions":
        return (
          <RowActions
            actions={[{ key: "view", label: "View details", icon: <EyeIcon />, onPress: () => setOpen(event) }]}
          />
        );
      default:
        return null;
    }
  };

  const filterSelect = { classNames: { trigger: "bg-white border-none h-12 rounded-lg" }, disallowEmptySelection: true };
  const dateInput = { classNames: { inputWrapper: "bg-white h-12 border-none rounded-lg" }, className: "w-full sm:w-44" };

  return (
    <div className="flex flex-col gap-6">
      <FilterBar>
        {isAdmin && (
          <BaseSelect
            name="actorId"
            control={control}
            options={[option(ALL, "All users"), ...(users.data?.items ?? []).map((u) => option(u.id, fullName(u)))]}
            className="w-full sm:w-52"
            aria-label="User"
            isLoading={users.isPending}
            {...filterSelect}
          />
        )}
        <BaseSelect
          name="action"
          control={control}
          options={[option(ALL, "All actions"), ...ACTIONS.map((a) => option(a))]}
          className="w-full sm:w-60"
          aria-label="Action"
          {...filterSelect}
        />
        <BaseSelect
          name="targetType"
          control={control}
          options={[option(ALL, "All records"), ...TARGET_TYPES.map((t) => option(t, t.replace(/_/g, " ")))]}
          className="w-full sm:w-44"
          aria-label="Record type"
          {...filterSelect}
        />
        <BaseInput name="from" control={control} type="date" aria-label="From date" {...dateInput} />
        <BaseInput name="to" control={control} type="date" aria-label="To date" {...dateInput} />
        {!isAdmin && <p className="text-sm text-content-6">Showing your own activity.</p>}
      </FilterBar>
      {events.isError && (
        <AlertBanner
          message={`Couldn't load the audit report: ${errorMessage(events.error)}`}
          action={<button type="button" className="underline text-sm" onClick={() => void events.refetch()}>Retry</button>}
        />
      )}
      <Card>
        <BaseTable<AuditEvent>
          ariaLabel="Audit report"
          columns={columns}
          data={events.isError ? [] : (events.data?.items ?? [])}
          loading={events.isPending}
          refreshing={events.isPlaceholderData}
          onRowClick={setOpen}
          rowKey={(row) => row.id}
          renderCell={renderCell}
          meta={paging.tableMeta(events.data?.meta)}
          setMeta={paging.setMeta}
          bottomContent="Events"
          emptyContent={events.isError ? "Couldn't load events." : "No events match."}
        />
      </Card>
      {open && (
        <FormModal
          isOpen
          onOpenChange={(isOpen) => !isOpen && setOpen(null)}
          title={open.action}
          size="2xl"
        >
          <div className="flex flex-col gap-2">
            <DetailRow label="Time" value={formatDateTime(open.createdAt)} />
            <DetailRow label="User" value={open.actor ? `${fullName(open.actor)} (${open.actor.email})` : "System / unknown"} />
            <DetailRow label="Record" value={open.targetType ? `${open.targetType} ${open.targetId ?? ""}` : "—"} />
            <DetailRow label="Session" value={<span className="font-mono">{open.sessionId ?? "—"}</span>} />
            <DetailRow label="IP address" value={<span className="font-mono">{open.ipAddress ?? "—"}</span>} />
            <DetailRow label="Browser" value={<span className="break-all">{open.userAgent ?? "—"}</span>} />
          </div>
          <p className="text-xs font-semibold uppercase text-base-primary mt-2">Details</p>
          {/* Rendered as text by React, so values cannot inject markup. */}
          <pre className="bg-content-2 rounded-lg p-3 text-xs overflow-auto">
            {open.details ? JSON.stringify(open.details, null, 2) : "—"}
          </pre>
        </FormModal>
      )}
    </div>
  );
}
