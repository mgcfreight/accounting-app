import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseInput,
  BaseTable,
  FormModal,
  RowActions,
  StatusChip,
} from "@/components/common";
import { useServerPaging } from "@/hooks";
import { AccountingPeriod } from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import { formatDateTime, fullName } from "@/lib/utils";
import {
  closeAccountingPeriod,
  errorMessage,
  listAccountingPeriods,
  reopenAccountingPeriod,
} from "@/services";

const columns: BaseTableColumn[] = [
  { key: "period", label: "Month" },
  { key: "status", label: "Status" },
  { key: "closed", label: "Closed" },
  { key: "actions", label: "" },
];

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// "2026-09" -> "September 2026". Built from the parts, not a Date, so no time
// zone can shift it.
const monthLabel = (period: string) => {
  const [year, month] = period.split("-").map(Number);
  const name = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return `${name} ${year}`;
};

type Pending = { action: "close" | "reopen"; period: string };

// Month-end close (accounting_periods, v5). Admin only. A closed month can't
// be changed; a month with no row here is open. Only a month that has ended
// can be closed. Note: invoice and payment screens don't check closed months
// yet — that comes with their API work.
export default function AccountingPeriods() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending | null>(null);
  const paging = useServerPaging("", 12);
  const periods = useQuery({
    queryKey: ["accounting-periods", { page: paging.page, limit: paging.limit }],
    queryFn: ({ signal }) =>
      listAccountingPeriods({ page: paging.page, limit: paging.limit }, signal),
    placeholderData: keepPreviousData,
  });
  const { control, handleSubmit, reset } = useForm<{ period: string }>({
    mode: "onTouched",
    defaultValues: { period: "" },
  });

  const act = useMutation({
    mutationFn: ({ action, period }: Pending) =>
      action === "close"
        ? closeAccountingPeriod(period)
        : reopenAccountingPeriod(period),
    onSuccess: (row, { action }) => {
      toast.success(
        `${monthLabel(row.period)} ${action === "close" ? "closed" : "reopened"}.`
      );
      setPending(null);
      reset();
      void queryClient.invalidateQueries({ queryKey: ["accounting-periods"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="border-t-1 py-6 flex flex-col gap-4">
      <form
        noValidate
        className="flex flex-wrap items-start gap-4"
        onSubmit={handleSubmit(({ period }) =>
          setPending({ action: "close", period })
        )}
      >
        <BaseInput
          name="period"
          control={control}
          type="month"
          label="Month to close"
          className="max-w-xs"
          rules={{
            required: "Choose a month",
            pattern: { value: MONTH, message: "Choose a month" },
          }}
        />
        <BaseButton type="submit" text="Close Month" className="px-6 h-14" />
      </form>
      {periods.isError && (
        <AlertBanner
          message={`Couldn't load accounting periods: ${errorMessage(periods.error)}`}
          action={
            <button
              type="button"
              className="underline text-sm"
              onClick={() => void periods.refetch()}
            >
              Retry
            </button>
          }
        />
      )}
      <BaseTable<AccountingPeriod>
        ariaLabel="Accounting periods"
        columns={columns}
        data={periods.isError ? [] : (periods.data?.items ?? [])}
        loading={periods.isPending}
        rowKey={(row) => row.id}
        meta={paging.tableMeta(periods.data?.meta)}
        setMeta={paging.setMeta}
        bottomContent="Months"
        emptyContent={
          periods.isError
            ? "Couldn't load accounting periods."
            : "No month has been closed yet."
        }
        renderCell={(row, key) => {
          switch (key) {
            case "period":
              return (
                <span className="font-semibold">{monthLabel(row.period)}</span>
              );
            case "status":
              return row.status === "CLOSED" ? (
                <StatusChip text="Closed" tone="secondary" />
              ) : (
                <StatusChip text="Open" tone="success" />
              );
            case "closed":
              return row.closedAt
                ? `${formatDateTime(row.closedAt)}${row.closedBy ? ` by ${fullName(row.closedBy)}` : ""}`
                : "—";
            case "actions":
              return (
                <RowActions
                  actions={[
                    row.status === "CLOSED"
                      ? {
                          key: "reopen",
                          label: "Reopen",
                          danger: true,
                          onPress: () =>
                            setPending({ action: "reopen", period: row.period }),
                        }
                      : {
                          key: "close",
                          label: "Close",
                          onPress: () =>
                            setPending({ action: "close", period: row.period }),
                        },
                  ]}
                />
              );
            default:
              return null;
          }
        }}
      />
      {pending && (
        <FormModal
          isOpen
          onOpenChange={(open) => !open && setPending(null)}
          title={`${pending.action === "close" ? "Close" : "Reopen"} ${monthLabel(pending.period)}`}
          confirmText={pending.action === "close" ? "Close Month" : "Reopen Month"}
          isConfirming={act.isPending}
          onConfirm={() => act.mutate(pending)}
        >
          <p className="text-sm">
            {pending.action === "close"
              ? "Nothing dated in this month can be changed once it is closed. This is recorded in the audit report."
              : "Reopening lets records dated in this month be changed again. This is recorded in the audit report."}
          </p>
        </FormModal>
      )}
    </div>
  );
}
