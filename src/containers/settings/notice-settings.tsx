import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseInput,
  ErrorState,
  TableSkeleton,
} from "@/components/common";
import { DownArrow } from "@/components/icons";
import { noticeTermsList, paymentTermsLabels } from "@/lib/constants";
import { NoticeSettings, NoticeTerms } from "@/lib/interfaces";
import { formatDateTime, fullName } from "@/lib/utils";
import { errorMessage, getNoticeSettings, saveNoticeSettings } from "@/services";

// Every term with a notice default, derived from PaymentTerms. The form and
// the save payload are built from this list, so a new term can't be shown
// but left out of either.
const TERMS = noticeTermsList;

// Text fields in the form; sent as whole numbers.
type Values = Record<NoticeTerms, string> & { carrierAlertDaysBefore: string };

const QUERY_KEY = ["settings", "notices"];

const byTerms = <T,>(value: (terms: NoticeTerms) => T) =>
  Object.fromEntries(TERMS.map((terms) => [terms, value(terms)])) as Record<
    NoticeTerms,
    T
  >;

const toForm = (settings: NoticeSettings): Values => ({
  ...byTerms((terms) => String(settings.defaultNoticeDays[terms])),
  carrierAlertDaysBefore:
    settings.carrierAlertDaysBefore === null
      ? ""
      : String(settings.carrierAlertDaysBefore),
});

const wholeDays = (max: number) => (value: string) =>
  (/^\d+$/.test(value) && +value <= max) || `A whole number from 0 to ${max}`;

// Default billing-period notice days by payment terms (v5 sets 2/4/7/7 for
// Net 7 to Net 60; Net 90's 7 was added in #29; COD and PREPAID get no
// notice), and the default for the carrier "payment due soon" alert to the
// accounts team. Each customer's or carrier's agreement can set its own.
// Saved only: nothing sends notices yet.
// The Settings page asks before leaving with unsaved edits; this section
// reports them through `onDirtyChange`.
export default function NoticeSettingsSection({
  onDirtyChange,
}: {
  onDirtyChange: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: QUERY_KEY,
    queryFn: ({ signal }) => getNoticeSettings(signal),
  });
  // `values`: the form follows the saved settings whenever they (re)load.
  const {
    control,
    handleSubmit,
    reset,
    formState: { dirtyFields },
  } = useForm<Values>({
    mode: "onTouched",
    values: settings.data && toForm(settings.data),
  });
  const isDirty = Object.keys(dirtyFields).length > 0;
  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  const save = useMutation({
    mutationFn: (values: Values) =>
      saveNoticeSettings({
        defaultNoticeDays: byTerms((terms) =>
          Number.parseInt(values[terms], 10)
        ),
        carrierAlertDaysBefore: values.carrierAlertDaysBefore.trim()
          ? Number.parseInt(values.carrierAlertDaysBefore, 10)
          : null,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(QUERY_KEY, saved);
      // Reset here, not through `values`: that resets only when the saved
      // settings differ from the last ones, so an edit the API normalises
      // back (07 → 7) would leave the form dirty.
      reset(toForm(saved));
      toast.success("Notice settings saved.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (settings.isPending) return <TableSkeleton />;
  if (settings.isError) {
    return (
      <ErrorState
        message={errorMessage(settings.error)}
        onAction={() => void settings.refetch()}
      />
    );
  }

  const { updatedAt, updatedBy, carrierAlertDaysBefore } = settings.data;

  return (
    <form
      className="border-t-1 grid grid-cols-1 md:grid-cols-2 gap-6 py-6"
      onSubmit={handleSubmit((values) => save.mutate(values))}
      noValidate
    >
      <div className="md:col-span-2">
        <AlertBanner message="These defaults are saved, but nothing sends notices or alerts yet." />
      </div>
      <div className="flex flex-col gap-4">
        <h3 className="text-base-primary font-semibold">
          Billing-period notice (days before the period ends)
        </h3>
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          {TERMS.map((terms) => (
            <BaseInput
              key={terms}
              name={terms}
              control={control}
              type="number"
              label={paymentTermsLabels[terms]}
              rules={{ required: "Enter days", validate: wholeDays(30) }}
            />
          ))}
        </div>
        <p className="text-xs text-content-5">
          COD and prepaid shippers get no notice.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <h3 className="text-base-primary font-semibold">
          Carrier &quot;payment due soon&quot; alert
        </h3>
        <BaseInput
          name="carrierAlertDaysBefore"
          control={control}
          type="number"
          label="Days before the due date"
          className="max-w-xs"
          description="Sent to the accounts team. Leave empty until MGC decides the default."
          rules={{
            validate: (value) => !value.trim() || wholeDays(60)(value.trim()),
          }}
        />
        {carrierAlertDaysBefore === null && (
          <p className="text-xs text-content-5">Not set yet.</p>
        )}
      </div>
      <div className="md:col-span-2 border-t-1 border-dashed pt-6 flex flex-wrap justify-between gap-4 items-center">
        <p className="text-xs text-content-5">
          {updatedAt
            ? `Last saved ${formatDateTime(updatedAt)}${updatedBy ? ` by ${fullName(updatedBy)}` : ""}.`
            : "Showing the default values; not saved yet."}
        </p>
        <BaseButton
          type="submit"
          text="Save"
          startContent={<DownArrow />}
          className="rounded-xl! px-6"
          isLoading={save.isPending}
        />
      </div>
    </form>
  );
}
