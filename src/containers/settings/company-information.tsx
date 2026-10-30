import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  BaseButton,
  BaseInput,
  ErrorState,
  LeavePageModal,
  TableSkeleton,
} from "@/components/common";
import { DownArrow } from "@/components/icons";
import { useUnsavedChanges } from "@/hooks";
import { EMAIL_SHAPE } from "@/lib/constants";
import { CompanySettings } from "@/lib/interfaces";
import { formatDateTime, fullName } from "@/lib/utils";
import { errorMessage, getCompanySettings, saveCompanySettings } from "@/services";

type Company = Record<
  | "legalName"
  | "gstHstNumber"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "province"
  | "postalCode"
  | "country"
  | "accountsNotificationEmail",
  string
>;

const toForm = (settings: CompanySettings): Company => ({
  legalName: settings.legalName ?? "",
  gstHstNumber: settings.gstHstNumber ?? "",
  addressLine1: settings.addressLine1 ?? "",
  addressLine2: settings.addressLine2 ?? "",
  city: settings.city ?? "",
  province: settings.province ?? "",
  postalCode: settings.postalCode ?? "",
  country: settings.country ?? "",
  accountsNotificationEmail: settings.accountsNotificationEmail ?? "",
});

// An empty field is saved as null, never as "".
const orNull = (value: string) => value.trim() || null;

export const SETTINGS_QUERY = { company: ["settings", "company"] } as const;

// Printed on every invoice PDF and email (settings key `company`). Until an
// Admin saves it, every field is empty — the API invents nothing.
export default function CompanyInformation() {
  const queryClient = useQueryClient();
  const company = useQuery({
    queryKey: SETTINGS_QUERY.company,
    queryFn: ({ signal }) => getCompanySettings(signal),
  });
  // `values`: the form follows the saved settings whenever they (re)load.
  const {
    control,
    handleSubmit,
    reset,
    formState: { dirtyFields },
  } = useForm<Company>({
    mode: "all",
    values: company.data && toForm(company.data),
  });
  const leaving = useUnsavedChanges(Object.keys(dirtyFields).length > 0);

  const save = useMutation({
    mutationFn: (values: Company) =>
      saveCompanySettings({
        legalName: values.legalName.trim(),
        gstHstNumber: orNull(values.gstHstNumber),
        addressLine1: orNull(values.addressLine1),
        addressLine2: orNull(values.addressLine2),
        city: orNull(values.city),
        province: orNull(values.province.toUpperCase()),
        postalCode: orNull(values.postalCode.toUpperCase()),
        country: orNull(values.country.toUpperCase()),
        accountsNotificationEmail: orNull(values.accountsNotificationEmail),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(SETTINGS_QUERY.company, saved);
      // Reset here, not through `values`: that resets only when the saved
      // settings differ from the last ones, so an edit the API normalises
      // back (on → ON) would leave the form dirty.
      reset(toForm(saved));
      toast.success("Company information saved.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (company.isPending) return <TableSkeleton />;
  if (company.isError) {
    return <ErrorState message={errorMessage(company.error)} onAction={() => void company.refetch()} />;
  }

  const { updatedAt, updatedBy } = company.data;

  return (
    <form
      className="border-t-1 grid grid-cols-1 sm:grid-cols-2 gap-6 py-6"
      onSubmit={handleSubmit((values) => save.mutate(values))}
      noValidate
    >
      <BaseInput
        className="sm:col-span-2"
        name="legalName"
        control={control}
        label="Legal name"
        rules={{
          required: "Enter the legal name",
          validate: (v) => (v.trim().length >= 2 && v.trim().length <= 200) || "2-200 characters",
        }}
      />
      <BaseInput
        name="gstHstNumber"
        control={control}
        label="GST/HST number"
        placeholder="123456789RT0001"
        rules={{ pattern: { value: /^\d{9}RT\d{4}$/, message: "Format: 123456789RT0001" } }}
      />
      <BaseInput
        name="accountsNotificationEmail"
        control={control}
        type="email"
        label="Accounts team email"
        description="Where alerts for the accounts team go."
        rules={{ validate: (v) => !v.trim() || EMAIL_SHAPE.test(v.trim()) || "Enter a valid email" }}
      />
      <BaseInput className="sm:col-span-2" name="addressLine1" control={control} label="Street address" placeholder="123 Freight Way" rules={{ maxLength: { value: 200, message: "Up to 200 characters" } }} />
      <BaseInput className="sm:col-span-2" name="addressLine2" control={control} label="Address line 2" rules={{ maxLength: { value: 200, message: "Up to 200 characters" } }} />
      <BaseInput name="city" control={control} label="City" rules={{ maxLength: { value: 100, message: "Up to 100 characters" } }} />
      <div className="grid grid-cols-3 gap-6">
        <BaseInput
          name="province"
          control={control}
          label="Province"
          placeholder="ON"
          rules={{ pattern: { value: /^[A-Za-z]{2,3}$/, message: "2-3 letters, e.g. ON" } }}
        />
        <BaseInput name="postalCode" control={control} label="Postal code" placeholder="L5T 2N7" rules={{ maxLength: { value: 10, message: "Up to 10 characters" } }} />
        <BaseInput
          name="country"
          control={control}
          label="Country"
          placeholder="CA"
          rules={{ pattern: { value: /^[A-Za-z]{2}$/, message: "2 letters, e.g. CA" } }}
        />
      </div>
      <div className="sm:col-span-2 border-t-1 border-dashed pt-6 flex flex-wrap justify-between gap-4 items-center">
        <p className="text-xs text-content-5">
          {updatedAt
            ? `Last saved ${formatDateTime(updatedAt)}${updatedBy ? ` by ${fullName(updatedBy)}` : ""}.`
            : "Not saved yet."}
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
