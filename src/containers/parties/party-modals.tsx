import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { BaseInput, BaseSelect, BaseTextArea, FormModal } from "@/components/common";
import {
  billingTriggerOptions,
  CANADIAN_PROVINCES,
  COUNTRY_PATTERN,
  currencyOptions,
  paymentTermsOptions,
  REGION_PATTERN,
  taxBasisOptions,
  taxTreatmentOptions,
} from "@/lib/constants";
import {
  BillingTrigger,
  Currency,
  PartyType,
  PaymentTerms,
  TaxBasis,
  TaxTreatment,
} from "@/lib/enums";
import { PartyView } from "@/lib/interfaces";
import {
  createAgreement,
  createParty,
  errorMessage,
  NewAgreement,
  NewParty,
} from "@/services";

// Adding a shipper or carrier, and adding agreed terms for one. Each modal
// is mounted only while open, so its form starts fresh. The API validates
// everything again.

const provinceOptions = CANADIAN_PROVINCES.map((code) => ({
  key: code,
  label: code,
  value: code,
}));

const maxLength = (value: number) => ({
  value,
  message: `At most ${value} characters`,
});

// Optional text: blank is left out of the request.
const optional = (value: string) => value.trim() || undefined;

type PartyValues = {
  mgcId: string;
  name: string;
  legalName: string;
  gstHstNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  defaultCurrency: string;
};

export function PartyFormModal({
  type,
  onCreated,
  onClose,
}: {
  type: PartyType;
  onCreated: (party: PartyView) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const what = type === PartyType.Shipper ? "Shipper" : "Carrier";
  const { control, handleSubmit, setValue } = useForm<PartyValues>({
    defaultValues: {
      mgcId: "",
      name: "",
      legalName: "",
      gstHstNumber: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      province: "",
      postalCode: "",
      country: "CA",
      defaultCurrency: Currency.CAD,
    },
  });
  const isCanadian = useWatch({ control, name: "country" }).trim() === "CA";
  // The province select and the state box share one value: a state typed
  // for another country would stay hidden behind a blank select and be sent.
  useEffect(() => setValue("province", ""), [isCanadian, setValue]);

  const save = useMutation({
    mutationFn: (values: PartyValues) => {
      const body: NewParty = {
        type,
        mgcId: values.mgcId.trim(),
        name: values.name.trim(),
        legalName: optional(values.legalName),
        gstHstNumber: optional(values.gstHstNumber),
        addressLine1: optional(values.addressLine1),
        addressLine2: optional(values.addressLine2),
        city: optional(values.city),
        province: optional(values.province.toUpperCase()),
        postalCode: optional(values.postalCode),
        country: values.country.trim(),
        defaultCurrency: values.defaultCurrency as Currency,
      };
      return createParty(body);
    },
    onSuccess: (party) => {
      toast.success(`${party.name} was added.`);
      void queryClient.invalidateQueries({ queryKey: ["parties"] });
      onCreated(party);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`Add ${what}`}
      confirmText={`Add ${what}`}
      isConfirming={save.isPending}
      onConfirm={handleSubmit((values) => save.mutate(values))}
      size="2xl"
    >
      <p className="text-xs text-content-5">
        Until the MGC sync brings them, parties are typed in here. The billing
        address picks the tax rate. Add an agreement next: invoices need one.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BaseInput
          name="mgcId"
          control={control}
          label="MGC id"
          description="The party's id in MGC's TMS."
          rules={{ required: "Enter the MGC id", maxLength: maxLength(64) }}
        />
        <BaseSelect
          name="defaultCurrency"
          control={control}
          label="Currency"
          options={currencyOptions}
          disallowEmptySelection
        />
        <BaseInput
          name="name"
          control={control}
          label="Trading name"
          rules={{ required: "Enter a name", maxLength: maxLength(200) }}
        />
        <BaseInput
          name="legalName"
          control={control}
          label="Legal name"
          rules={{ maxLength: maxLength(200) }}
        />
        <BaseInput
          name="gstHstNumber"
          control={control}
          label="GST/HST #"
          rules={{ maxLength: maxLength(20) }}
        />
        <BaseInput
          name="addressLine1"
          control={control}
          label="Address line 1"
          rules={{ maxLength: maxLength(200) }}
        />
        <BaseInput
          name="addressLine2"
          control={control}
          label="Address line 2"
          rules={{ maxLength: maxLength(200) }}
        />
        <BaseInput
          name="city"
          control={control}
          label="City"
          rules={{ maxLength: maxLength(100) }}
        />
        <BaseInput
          name="country"
          control={control}
          label="Country"
          description="2-letter ISO code, e.g. CA or US."
          rules={{
            required: "Enter a country",
            validate: (value: string) =>
              COUNTRY_PATTERN.test(value.trim()) || "2 capital letters, e.g. CA",
          }}
        />
        {isCanadian ? (
          <BaseSelect
            name="province"
            control={control}
            label="Province"
            options={provinceOptions}
            rules={{ required: "Choose a province" }}
          />
        ) : (
          <BaseInput
            name="province"
            control={control}
            label="State / region"
            rules={{
              validate: (value: string) =>
                value.trim() === "" ||
                REGION_PATTERN.test(value.trim().toUpperCase()) ||
                "2-3 letters",
            }}
          />
        )}
        <BaseInput
          name="postalCode"
          control={control}
          label="Postal code"
          rules={{ maxLength: maxLength(10) }}
        />
      </div>
    </FormModal>
  );
}

type AgreementValues = {
  effectiveFrom: string;
  currency: string;
  paymentTerms: string;
  taxTreatment: string;
  taxBasis: string;
  billingTrigger: string;
  daysBefore: string;
  notes: string;
};

const DAYS_PATTERN = /^\d{1,2}$/;

// New terms from a date. The party's current open-ended agreement ends the
// day before. A party uses one currency throughout. Auto-sending invoices is
// left off: it's still an open decision (issue #1).
export function AgreementFormModal({
  party,
  onClose,
}: {
  party: PartyView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isCarrier = party.type === PartyType.Carrier;
  const { control, handleSubmit } = useForm<AgreementValues>({
    defaultValues: {
      effectiveFrom: "",
      currency: party.agreements?.[0]?.currency ?? party.defaultCurrency,
      paymentTerms: PaymentTerms.Net30,
      taxTreatment: TaxTreatment.Standard,
      taxBasis: TaxBasis.BillTo,
      billingTrigger: "",
      daysBefore: "",
      notes: "",
    },
  });

  const save = useMutation({
    mutationFn: (values: AgreementValues) => {
      const days = values.daysBefore.trim()
        ? Number(values.daysBefore.trim())
        : undefined;
      const body: NewAgreement = {
        partyId: party.id,
        effectiveFrom: values.effectiveFrom,
        currency: values.currency as Currency,
        paymentTerms: values.paymentTerms as PaymentTerms,
        taxTreatment: values.taxTreatment as TaxTreatment,
        taxBasis: values.taxBasis as TaxBasis,
        notes: optional(values.notes),
        ...(isCarrier
          ? {
              billingTrigger: values.billingTrigger as BillingTrigger,
              alertDaysBefore: days,
            }
          : { noticeDaysBefore: days }),
      };
      return createAgreement(body);
    },
    onSuccess: () => {
      toast.success("Agreement added.");
      void queryClient.invalidateQueries({ queryKey: ["parties"] });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`Add Agreement for ${party.name}`}
      confirmText="Add Agreement"
      isConfirming={save.isPending}
      onConfirm={handleSubmit((values) => save.mutate(values))}
      size="2xl"
    >
      <p className="text-xs text-content-5">
        The current open-ended agreement, if any, ends the day before this one
        starts.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BaseInput
          name="effectiveFrom"
          control={control}
          type="date"
          label="Applies from"
          rules={{
            required: "Choose the first day",
            pattern: { value: /^\d{4}-\d{2}-\d{2}$/, message: "Enter a date" },
          }}
        />
        <BaseSelect
          name="currency"
          control={control}
          label="Currency"
          options={currencyOptions}
          disallowEmptySelection
          description="Must match the party's earlier agreements."
        />
        <BaseSelect
          name="paymentTerms"
          control={control}
          label="Payment terms"
          options={paymentTermsOptions}
          disallowEmptySelection
        />
        <BaseSelect
          name="taxTreatment"
          control={control}
          label="Tax treatment"
          options={taxTreatmentOptions}
          disallowEmptySelection
        />
        <BaseSelect
          name="taxBasis"
          control={control}
          label="Tax rate from"
          options={taxBasisOptions}
          disallowEmptySelection
        />
        {isCarrier && (
          <BaseSelect
            name="billingTrigger"
            control={control}
            label="Billing trigger"
            options={billingTriggerOptions}
            rules={{ required: "Choose when the carrier bills" }}
          />
        )}
        <BaseInput
          name="daysBefore"
          control={control}
          label={
            isCarrier
              ? "Alert days before a bill is due"
              : "Notice days before a billing period ends"
          }
          placeholder="Optional"
          rules={{
            validate: (value: string) =>
              value.trim() === "" ||
              (DAYS_PATTERN.test(value.trim()) && Number(value.trim()) <= 60) ||
              "A whole number from 0 to 60",
          }}
        />
      </div>
      <BaseTextArea
        name="notes"
        control={control}
        label="Notes"
        rules={{ maxLength: maxLength(2000) }}
      />
    </FormModal>
  );
}
