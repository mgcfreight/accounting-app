import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseInput,
  BaseSwitch,
  BaseTable,
  FormModal,
  RowActions,
  StatusChip,
} from "@/components/common";
import { Add, EditSm } from "@/components/icons";
import { useServerPaging } from "@/hooks";
import { TaxRate } from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { createTaxRate, errorMessage, listTaxRates } from "@/services";

const columns: BaseTableColumn[] = [
  { key: "code", label: "Code" },
  { key: "jurisdiction", label: "Applies To" },
  { key: "name", label: "Name" },
  { key: "ratePercent", label: "Rate" },
  { key: "effectiveFrom", label: "From" },
  { key: "effectiveTo", label: "To" },
  { key: "isRecoverable", label: "ITC" },
  { key: "actions", label: "" },
];

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

  const { control, handleSubmit, reset } = useForm<NewRate>({ mode: "onTouched", defaultValues: blankRate });
  const code = useWatch({ control, name: "code" });

  const open = (from?: TaxRate) => {
    reset(
      from
        ? { ...blankRate, code: from.code, jurisdiction: from.jurisdiction, name: from.name, isRecoverable: from.isRecoverable }
        : blankRate
    );
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

  const existing = rates.data?.items.find(
    (rate) => rate.code === code.trim().toUpperCase() && !rate.effectiveTo
  );

  return (
    <div className="border-t-1 py-6">
      <AlertBanner message="Verify every rate with MGC's accountant before go-live. Whether provincial PST applies to freight is still to be confirmed." />
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} />
          Show ended rates
        </label>
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
              return row.effectiveTo ? formatDate(row.effectiveTo) : <StatusChip text="Current" tone="success" />;
            case "isRecoverable":
              return row.isRecoverable ? "Yes" : "No";
            case "actions":
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
          title="Add Tax Rate"
          confirmText="Save Rate"
          isConfirming={create.isPending}
          onConfirm={handleSubmit((values) => create.mutate(values))}
        >
          <div className="grid grid-cols-2 gap-4">
            <BaseInput
              name="code"
              control={control}
              label="Code"
              placeholder="HST-ON"
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
              rules={{ required: "Choose a start date" }}
            />
          </div>
          <BaseSwitch name="isRecoverable" control={control}>
            Recoverable as an input tax credit on carrier bills
          </BaseSwitch>
          {existing && (
            <p className="text-xs text-content-6">
              The current {existing.code} rate ({existing.ratePercent}% from {formatDate(existing.effectiveFrom)}) will end the
              day before this one starts. The new start date must be after {formatDate(existing.effectiveFrom)}.
            </p>
          )}
        </FormModal>
      )}
    </div>
  );
}
