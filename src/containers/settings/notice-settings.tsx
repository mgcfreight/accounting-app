import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseInput,
  ErrorState,
  LeavePageModal,
  TableSkeleton,
} from "@/components/common";
import { DownArrow } from "@/components/icons";
import { useUnsavedChanges } from "@/hooks";
import { NoticeSettings, NoticeTerms } from "@/lib/interfaces";
import { formatDateTime, fullName } from "@/lib/utils";
import { errorMessage, getNoticeSettings, saveNoticeSettings } from "@/services";

const TERMS: NoticeTerms[] = ["NET_7", "NET_15", "NET_30", "NET_60"];

// Text fields in the form; sent as whole numbers.
type Values = Record<NoticeTerms, string> & { carrierAlertDaysBefore: string };

const QUERY_KEY = ["settings", "notices"];

const toForm = (settings: NoticeSettings): Values => ({
  NET_7: String(settings.defaultNoticeDays.NET_7),
  NET_15: String(settings.defaultNoticeDays.NET_15),
  NET_30: String(settings.defaultNoticeDays.NET_30),
  NET_60: String(settings.defaultNoticeDays.NET_60),
  carrierAlertDaysBefore:
    settings.carrierAlertDaysBefore === null
      ? ""
      : String(settings.carrierAlertDaysBefore),
});

const wholeDays = (max: number) => (value: string) =>
  (/^\d+$/.test(value) && +value <= max) || `A whole number from 0 to ${max}`;

// Default billing-period notice days by payment terms (v5: 2/4/7/7; COD and
// PREPAID get no notice), and the default for the carrier "payment due soon"
// alert to the accounts team. Each customer's or carrier's agreement can set
// its own. Saved only: nothing sends notices yet.
export default function NoticeSettingsSection() {
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
  const leaving = useUnsavedChanges(Object.keys(dirtyFields).length > 0);

  const save = useMutation({
    mutationFn: (values: Values) =>
      saveNoticeSettings({
        defaultNoticeDays: {
          NET_7: Number.parseInt(values.NET_7, 10),
          NET_15: Number.parseInt(values.NET_15, 10),
          NET_30: Number.parseInt(values.NET_30, 10),
          NET_60: Number.parseInt(values.NET_60, 10),
        },
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
              label={terms.replace("_", " ")}
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
            : "Showing the v5 defaults; not saved yet."}
        </p>
        <BaseButton
          type="submit"
          text="Save"
          startContent={<DownArrow />}
          className="rounded-xl! px-6"
          isLoading={save.isPending}
        />
      </div>
      <LeavePageModal
        isOpen={leaving.blocked}
        onStay={leaving.stay}
        onLeave={leaving.leave}
      />
    </form>
  );
}
