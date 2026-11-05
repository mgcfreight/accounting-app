import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseCheckbox,
  BaseInput,
  BaseSwitch,
  BaseTable,
  FormModal,
  RowActions,
  StatusChip,
} from "@/components/common";
import { ChipTone } from "@/components/common/status-chip";
import { Add, EditSm } from "@/components/icons";
import { useServerPaging } from "@/hooks";
import { TaxRate } from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import { formatDate, torontoToday } from "@/lib/utils";
import { createTaxRate, errorMessage, listTaxRates } from "@/services";
import { TaxRateStatus, taxRateStatus } from "./tax-rate-status";

const columns: BaseTableColumn[] = [
  { key: "code", label: "Code" },
  { key: "jurisdiction", label: "Applies To" },
  { key: "name", label: "Name" },
  { key: "ratePercent", label: "Rate" },
  { key: "effectiveFrom", label: "From" },
  { key: "effectiveTo", label: "To" },
  { key: "status", label: "Status" },
  { key: "isRecoverable", label: "ITC" },
  { key: "actions", label: "Actions", align: "center" },
];

const statusChip: Record<TaxRateStatus, { label: string; tone: ChipTone }> = {
  current: { label: "Current", tone: "success" },
  scheduled: { label: "Scheduled", tone: "warning" },
  ended: { label: "Ended", tone: "neutral" },
};

type NewRate = {
  code: string;
  jurisdiction: string;
  name: string;
  ratePercent: string;
  effectiveFrom: string;
  isRecoverable: boolean;
};

const RATE_SHAPE = /^\d{1,3}(\.\d{1,3})?$/;
// Compares the text, not a float: "100", "100.0" and "100.000" are the max.
const isPercent = (value: string) =>
  RATE_SHAPE.test(value) && (/^\d{1,2}(\.\d+)?$/.test(value) || /^100(\.0+)?$/.test(value));

const blankRate: NewRate = {
  code: "",
  jurisdiction: "",
  name: "",
  ratePercent: "",
  effectiveFrom: "",
  isRecoverable: true,
};

// The tax table (tax_rates). Rates are never edited in place: a new rate for
// a code ends the current one the day before it starts, so invoices keep the
// rate they were issued with. A start date may be in the past.
export default function TaxRates() {
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [adding, setAdding] = useState(false);
  const paging = useServerPaging(String(showHistory), 20);
  const rates = useQuery({
    queryKey: ["tax-rates", { page: paging.page, limit: paging.limit, current: !showHistory }],
    queryFn: ({ signal }) =>
      listTaxRates({ page: paging.page, limit: paging.limit, current: !showHistory }, signal),
    placeholderData: keepPreviousData,
  });

  const {
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { isDirty },
  } = useForm<NewRate>({ mode: "onTouched", defaultValues: blankRate });
  const code = useWatch({ control, name: "code" });
  // The open row "New rate from a date" was chosen on: the new rate replaces
  // it, so its code and province can't be changed (an edited code would
  // quietly create a new tax code instead).
  const [replacing, setReplacing] = useState<TaxRate | null>(null);
  // A new rate goes live for every invoice from its start date, so saving
  // takes two steps: the form, then a review of what will change.
  const [reviewing, setReviewing] = useState(false);

  const open = (from?: TaxRate) => {
    reset(
      from
        ? { ...blankRate, code: from.code, jurisdiction: from.jurisdiction, name: from.name, isRecoverable: from.isRecoverable }
        : blankRate
    );
    setReplacing(from ?? null);
    setReviewing(false);
    setAdding(true);
  };

  const create = useMutation({
    mutationFn: (values: NewRate) =>
      createTaxRate({
        ...values,
        code: values.code.trim().toUpperCase(),
        jurisdiction: values.jurisdiction.trim().toUpperCase(),
        name: values.name.trim(),
        ratePercent: values.ratePercent.trim(),
      }),
    onSuccess: (rate) => {
      toast.success(`${rate.code} ${rate.ratePercent}% from ${formatDate(rate.effectiveFrom)} saved.`);
      void queryClient.invalidateQueries({ queryKey: ["tax-rates"] });
      setAdding(false);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const today = torontoToday();
  // The code's open row: the one the API ends when a new rate is added. It is
  // the latest rate for the code, but may not have started yet. Known for
  // certain when the modal opened from it; otherwise looked for on the page
  // shown, so a code whose open row is on another page isn't warned about.
  const existing =
    replacing ??
    rates.data?.items.find(
      (rate) => rate.code === code.trim().toUpperCase() && !rate.effectiveTo
    );
  const review = reviewing ? getValues() : null;

  return (
    <div className="border-t-1 py-6 flex flex-col gap-4">
      <AlertBanner message="Verify every rate with MGC's accountant before go-live. Whether provincial PST applies to freight is still to be confirmed." />
      <div className="flex flex-wrap justify-between items-center gap-4">
        <BaseCheckbox
          isSelected={showHistory}
          onValueChange={setShowHistory}
          classNames={{ label: "text-sm" }}
        >
          Show ended rates
        </BaseCheckbox>
        <BaseButton text="Add Tax Rate" className="rounded-full px-6" startContent={<Add />} onPress={() => open()} />
      </div>
      {rates.isError && (
        <AlertBanner
          message={`Couldn't load tax rates: ${errorMessage(rates.error)}`}
          action={<button type="button" className="underline text-sm" onClick={() => void rates.refetch()}>Retry</button>}
        />
      )}
      <BaseTable<TaxRate>
        ariaLabel="Tax rates"
        columns={columns}
        data={rates.isError ? [] : (rates.data?.items ?? [])}
        loading={rates.isPending}
        refreshing={rates.isPlaceholderData}
        rowKey={(row) => row.id}
        meta={paging.tableMeta(rates.data?.meta)}
        setMeta={paging.setMeta}
        bottomContent="Rates"
        emptyContent={rates.isError ? "Couldn't load tax rates." : "No tax rates yet."}
        renderCell={(row, key) => {
          switch (key) {
            case "code":
              return <span className="font-bold text-base-primary-300">{row.code}</span>;
            case "ratePercent":
              // Shown exactly as stored ("13.000%"), never re-rounded.
              return `${row.ratePercent}%`;
            case "effectiveFrom":
              return formatDate(row.effectiveFrom);
            case "effectiveTo":
              return row.effectiveTo ? formatDate(row.effectiveTo) : "—";
            case "status": {
              const chip = statusChip[taxRateStatus(row, today)];
              return <StatusChip text={chip.label} tone={chip.tone} />;
            }
            case "isRecoverable":
              return row.isRecoverable ? "Yes" : "No";
            case "actions":
              // Only on the open row: a new rate always ends that one, even
              // when it is scheduled and an earlier row is in force.
              return row.effectiveTo ? null : (
                <RowActions
                  actions={[{ key: "new-rate", label: "New rate from a date", icon: <EditSm />, onPress: () => open(row) }]}
                />
              );
            default:
              return String(row[key as keyof TaxRate] ?? "");
          }
        }}
      />
      {adding && (
        <FormModal
          isOpen
          onOpenChange={setAdding}
          title={review ? "Check the New Rate" : "Add Tax Rate"}
          confirmText={review ? "Confirm and Save" : "Review"}
          isConfirming={create.isPending}
          isDirty={isDirty}
          onConfirm={handleSubmit((values) =>
            reviewing ? create.mutate(values) : setReviewing(true)
          )}
        >
          {review ? (
            <div className="flex flex-col gap-3 text-sm">
              <p>You&apos;re about to save:</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-content-10 bg-content-12 p-4">
                <dt className="text-content-5">Code</dt>
                <dd className="font-semibold">{review.code.trim().toUpperCase()}</dd>
                <dt className="text-content-5">Province</dt>
                <dd>{review.jurisdiction.trim().toUpperCase()}</dd>
                <dt className="text-content-5">Name</dt>
                <dd>{review.name.trim()}</dd>
                <dt className="text-content-5">Rate</dt>
                <dd className="font-semibold">{review.ratePercent.trim()}%</dd>
                <dt className="text-content-5">Starts on</dt>
                <dd className="font-semibold">{formatDate(review.effectiveFrom)}</dd>
                <dt className="text-content-5">Recoverable</dt>
                <dd>{review.isRecoverable ? "Yes" : "No"}</dd>
              </dl>
              {existing ? (
                <p>
                  The {existing.code} rate of {existing.ratePercent}% (from{" "}
                  {formatDate(existing.effectiveFrom)}) will end the day before.
                </p>
              ) : (
                <p>This starts a new tax code.</p>
              )}
              {review.effectiveFrom < today && (
                <p role="alert" className="text-base-danger">
                  The start date, {formatDate(review.effectiveFrom)}, is in the
                  past. Check that&apos;s intended before saving.
                </p>
              )}
              <button
                type="button"
                className="self-start text-base-primary underline"
                disabled={create.isPending}
                onClick={() => setReviewing(false)}
              >
                Change something
              </button>
            </div>
          ) : (
          <>
          <div className="grid grid-cols-2 gap-4">
            <BaseInput
              name="code"
              control={control}
              label="Code"
              placeholder="HST-ON"
              isReadOnly={!!replacing}
              description={replacing ? "Replacing this code's rate." : undefined}
              rules={{
                required: "Enter a code",
                validate: (v) => (/^[A-Za-z]{2,4}-[A-Za-z]{2,8}$/.test(String(v).trim()) && String(v).trim().length <= 16) || "Like HST-ON or QST-QC",
              }}
            />
            <BaseInput
              name="jurisdiction"
              control={control}
              label="Province or OUTSIDE"
              placeholder="ON"
              isReadOnly={!!replacing}
              rules={{
                required: "Enter a province code or OUTSIDE",
                validate: (v) => /^([A-Za-z]{2}|OUTSIDE)$/i.test(String(v).trim()) || "2 letters (ON) or OUTSIDE",
              }}
            />
          </div>
          <BaseInput
            name="name"
            control={control}
            label="Name"
            placeholder="Ontario HST"
            rules={{
              required: "Enter a name",
              validate: (v) => (String(v).trim().length >= 2 && String(v).trim().length <= 100) || "2-100 characters",
            }}
          />
          <div className="grid grid-cols-2 gap-4">
            <BaseInput
              name="ratePercent"
              control={control}
              label="Rate (%)"
              placeholder="13.000"
              inputMode="decimal"
              rules={{
                required: "Enter the rate",
                validate: (v) => isPercent(String(v).trim()) || "0 to 100, up to 3 decimals",
              }}
            />
            <BaseInput
              name="effectiveFrom"
              control={control}
              type="date"
              label="Starts on"
              rules={{
                required: "Choose a start date",
                // Dates are YYYY-MM-DD, so they compare as strings.
                validate: (v) =>
                  !existing ||
                  String(v) > existing.effectiveFrom ||
                  `After ${formatDate(existing.effectiveFrom)}, when the current rate started`,
              }}
            />
          </div>
          <BaseSwitch name="isRecoverable" control={control}>
            Recoverable as an input tax credit on carrier bills
          </BaseSwitch>
          {existing && (
            <p className="text-xs text-content-6">
              The {taxRateStatus(existing, today) === "scheduled" ? "scheduled" : "current"} {existing.code} rate ({existing.ratePercent}% from {formatDate(existing.effectiveFrom)}) will end the
              day before this one starts. The new start date must be after {formatDate(existing.effectiveFrom)}.
            </p>
          )}
          </>
          )}
        </FormModal>
      )}
    </div>
  );
}
