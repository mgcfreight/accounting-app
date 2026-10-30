import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Control, Path, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  BaseInput,
  BaseSelect,
  BaseSwitch,
  BaseTextArea,
  FormModal,
} from "@/components/common";
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
import { AgreementView, PartyView } from "@/lib/interfaces";
import { REMINDER_DAYS_BEFORE_DUE } from "@/lib/mock/accounts";
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

// The on/off settings on an agreement. The API's create-agreement request
// doesn't take them yet and nothing can change them afterwards, so the
// switches below are a demo: they work, but saving them keeps nothing.
type AgreementSwitches = Pick<
  AgreementView,
  "remindersEnabled" | "billingNoticeEnabled" | "weeklyStatementEnabled" | "autoSendInvoices"
>;

// What the API sets on a new agreement.
const switchDefaults: AgreementSwitches = {
  remindersEnabled: true,
  billingNoticeEnabled: true,
  weeklyStatementEnabled: false,
  autoSendInvoices: false,
};

const pickSwitches = (agreement: AgreementView | undefined): AgreementSwitches =>
  agreement
    ? {
        remindersEnabled: agreement.remindersEnabled,
        billingNoticeEnabled: agreement.billingNoticeEnabled,
        weeklyStatementEnabled: agreement.weeklyStatementEnabled,
        autoSendInvoices: agreement.autoSendInvoices,
      }
    : switchDefaults;

const sameSwitches = (a: AgreementSwitches, b: AgreementSwitches) =>
  (Object.keys(switchDefaults) as (keyof AgreementSwitches)[]).every(
    (key) => a[key] === b[key]
  );

// Each switch with a line saying what it does, so staff who've never met
// them know what turning one on means. Billing notices, statements and
// auto-send are for shippers only.
const switchFields = (
  isShipper: boolean
): { key: keyof AgreementSwitches; label: string; help: string }[] => [
  {
    key: "remindersEnabled",
    label: "Payment reminders",
    help: isShipper
      ? `Email the shipper's accounts department ${REMINDER_DAYS_BEFORE_DUE} days before an invoice is due.`
      : `Alert MGC's accounts team ${REMINDER_DAYS_BEFORE_DUE} days before a carrier bill is due.`,
  },
  ...(isShipper
    ? [
        {
          key: "billingNoticeEnabled" as const,
          label: "Billing period notice",
          help: "Tell the shipper before a billing period closes, so they can check what's on it.",
        },
        {
          key: "weeklyStatementEnabled" as const,
          label: "Weekly statement",
          help: "Email the shipper their open invoices every Friday and on the last weekday of the month.",
        },
        {
          key: "autoSendInvoices" as const,
          label: "Auto-send invoices",
          help: "Email each invoice as soon as it's issued, without a person sending it. Whether this is allowed is still undecided (issue #1).",
        },
      ]
    : []),
];

function AgreementSwitchFields<T extends AgreementSwitches>({
  control,
  isShipper,
}: {
  control: Control<T>;
  isShipper: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {switchFields(isShipper).map((field) => (
        <BaseSwitch key={field.key} name={field.key as Path<T>} control={control}>
          <span className="flex flex-col">
            <span>{field.label}</span>
            <span className="text-xs text-content-5">{field.help}</span>
          </span>
        </BaseSwitch>
      ))}
    </div>
  );
}

const DemoNote = () => (
  <p className="text-xs text-content-5">
    Demo only: these settings aren&apos;t saved yet.
  </p>
);

// Turns an agreement's notifications and automation on or off. A demo until
// the API can change them.
export function AgreementSettingsModal({
  agreement,
  isShipper,
  onClose,
}: {
  agreement: AgreementView;
  isShipper: boolean;
  onClose: () => void;
}) {
  const { control, handleSubmit } = useForm<AgreementSwitches>({
    defaultValues: pickSwitches(agreement),
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Notifications & Automation"
      confirmText="Save Settings"
      onConfirm={handleSubmit((values) => {
        if (!sameSwitches(values, pickSwitches(agreement))) {
          toast.info("Agreement settings — demo only, nothing was saved.");
        }
        onClose();
      })}
      size="lg"
    >
      <DemoNote />
      <AgreementSwitchFields control={control} isShipper={isShipper} />
    </FormModal>
  );
}

type AgreementValues = AgreementSwitches & {
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
  // The new terms replace the open-ended agreement, so its settings carry
  // over unless changed.
  const replacing = party.agreements?.find((a) => a.effectiveTo === null);
  const { control, handleSubmit } = useForm<AgreementValues>({
    defaultValues: {
      ...pickSwitches(replacing),
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
    onSuccess: (_, values) => {
      toast.success("Agreement added.");
      // The API set its own defaults; say so if other settings were chosen.
      if (!sameSwitches(values, switchDefaults)) {
        toast.info("Notification settings — demo only, nothing was saved.");
      }
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
            // The form also holds the on/off switches, hence the wider type.
            validate: (value: string | boolean) => {
              const days = String(value).trim();
              return (
                days === "" ||
                (DAYS_PATTERN.test(days) && Number(days) <= 60) ||
                "A whole number from 0 to 60"
              );
            },
          }}
        />
      </div>
      <BaseTextArea
        name="notes"
        control={control}
        label="Notes"
        rules={{ maxLength: maxLength(2000) }}
      />
      <div className="flex flex-col gap-3 border-t border-content-3 pt-4">
        <div>
          <p className="text-sm font-semibold text-base-primary-900">
            Notifications &amp; automation
          </p>
          <DemoNote />
        </div>
        <AgreementSwitchFields control={control} isShipper={!isCarrier} />
      </div>
    </FormModal>
  );
}
