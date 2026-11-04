import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
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
  allPaymentTermsOptions,
  CREDIT_LIMIT_PATTERN,
  creditStatusOptions,
  EMAIL_SHAPE,
  currencyOptions,
  PAYMENT_TERMS_NOT_IN_API,
  paymentTermsOptions,
  REGION_PATTERN,
  taxBasisOptions,
  taxTreatmentOptions,
} from "@/lib/constants";
import {
  BillingTrigger,
  CreditStatus,
  Currency,
  PartyType,
  PaymentTerms,
  Permission,
  TaxBasis,
  TaxTreatment,
} from "@/lib/enums";
import { useCan } from "@/components/providers/user-provider";
import { ContactView, PartyView } from "@/lib/interfaces";
import {
  ContactChanges,
  createAgreement,
  createContact,
  createParty,
  errorMessage,
  NewAgreement,
  NewParty,
  updateContact,
} from "@/services";

// Adding a shipper or carrier, agreed terms for one, and its contacts. Each
// modal is mounted only while open, so its form starts fresh. The API
// validates everything again.

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
  contactName: string;
  contactEmail: string;
  contactPhone: string;
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
  // Adding a contact is parties.edit, which adding a party doesn't imply.
  const { can } = useCan();
  const canAddContact = can(Permission.PartiesEdit);
  const { control, handleSubmit, setValue, getValues } = useForm<PartyValues>({
    defaultValues: {
      contactName: "",
      contactEmail: "",
      contactPhone: "",
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

  // The party first, then its contact: the API takes them separately. If the
  // contact fails the party still exists, so it's reported as added and the
  // contact can be added from its page.
  const save = useMutation({
    mutationFn: async (values: PartyValues) => {
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
      const party = await createParty(body);
      const email = values.contactEmail.trim().toLowerCase();
      if (!canAddContact || !email) return { party, contactError: null };
      try {
        await createContact({
          partyId: party.id,
          name: values.contactName.trim(),
          email,
          phone: optional(values.contactPhone),
          receivesInvoices: true,
          receivesReminders: true,
        });
        return { party, contactError: null };
      } catch (error) {
        return { party, contactError: error };
      }
    },
    onSuccess: ({ party, contactError }) => {
      if (contactError) {
        toast.warning(
          `${party.name} was added, but its contact wasn't: ${errorMessage(contactError)} Add it from the ${what.toLowerCase()}'s page.`
        );
      } else {
        toast.success(`${party.name} was added.`);
      }
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
      {canAddContact && (
        <div className="flex flex-col gap-3 border-t border-content-3 pt-4">
          <div>
            <p className="text-sm font-semibold text-base-primary-900">
              {type === PartyType.Shipper ? "Accounts contact" : "Billing contact"}
            </p>
            <p className="text-xs text-content-5">
              Invoices and documents are emailed here. Optional: it can be
              added later from the {what.toLowerCase()}&apos;s page.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <BaseInput
              name="contactEmail"
              control={control}
              type="email"
              label="Email"
              placeholder={type === PartyType.Shipper ? "ap@shipper.com" : "billing@carrier.com"}
              rules={{
                validate: (value: string) => {
                  const email = value.trim();
                  if (!email) return true;
                  if (email.length > 254) return "At most 254 characters";
                  return EMAIL_SHAPE.test(email) || "Enter a valid email";
                },
              }}
            />
            <BaseInput
              name="contactName"
              control={control}
              label="Contact name"
              placeholder="Accounts Payable"
              rules={{
                // Needed with an email: the API names every contact.
                validate: (value: string) =>
                  !getValues("contactEmail").trim() ||
                  value.trim() !== "" ||
                  "Enter a name for this contact",
                maxLength: maxLength(100),
              }}
            />
            <BaseInput
              name="contactPhone"
              control={control}
              type="tel"
              label="Phone"
              placeholder="Optional"
              rules={{ maxLength: maxLength(32) }}
            />
          </div>
        </div>
      )}
    </FormModal>
  );
}

type ContactValues = {
  name: string;
  email: string;
  phone: string;
  receivesInvoices: boolean;
  receivesReminders: boolean;
  receivesStatements: boolean;
  isActive: boolean;
};

const contactDefaults = (contact: ContactView | undefined): ContactValues => ({
  name: contact?.name ?? "",
  email: contact?.email ?? "",
  phone: contact?.phone ?? "",
  // A shipper's first contact is usually its accounts department.
  receivesInvoices: contact?.receivesInvoices ?? true,
  receivesReminders: contact?.receivesReminders ?? true,
  receivesStatements: contact?.receivesStatements ?? false,
  isActive: contact?.isActive ?? true,
});

// Adds a contact to a shipper or carrier, or changes one (`contact` set).
// The invoice and document emails go to the active contacts that receive
// invoices. Contacts aren't deleted: turning "Active" off retires one.
export function ContactFormModal({
  party,
  contact,
  onClose,
}: {
  party: PartyView;
  contact?: ContactView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isShipper = party.type === PartyType.Shipper;
  const { control, handleSubmit } = useForm<ContactValues>({
    defaultValues: contactDefaults(contact),
  });

  const save = useMutation({
    mutationFn: (values: ContactValues) => {
      const next = {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim(),
        receivesInvoices: values.receivesInvoices,
        receivesReminders: values.receivesReminders,
        receivesStatements: values.receivesStatements,
      };
      if (!contact) {
        return createContact({
          ...next,
          partyId: party.id,
          phone: optional(next.phone),
        });
      }
      // Only what changed; "" clears the phone.
      const before = contactDefaults(contact);
      const changes: ContactChanges = {
        ...Object.fromEntries(
          Object.entries(next).filter(
            ([key, value]) => before[key as keyof ContactValues] !== value
          )
        ),
        ...(values.isActive !== contact.isActive && { isActive: values.isActive }),
      };
      return updateContact(contact.id, changes);
    },
    onSuccess: (saved) => {
      toast.success(contact ? `${saved.name} was updated.` : `${saved.name} was added.`);
      void queryClient.invalidateQueries({ queryKey: ["parties", "contacts", party.id] });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={contact ? "Edit Contact" : `Add Contact for ${party.name}`}
      confirmText={contact ? "Save Contact" : "Add Contact"}
      isConfirming={save.isPending}
      onConfirm={handleSubmit((values) => save.mutate(values))}
      size="xl"
    >
      <p className="text-xs text-content-5">
        Invoices and documents are emailed to the active contacts that receive
        invoices.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BaseInput
          name="name"
          control={control}
          label="Name"
          placeholder="Accounts Payable"
          rules={{ required: "Enter a name", maxLength: maxLength(100) }}
        />
        <BaseInput
          name="email"
          control={control}
          type="email"
          label="Email"
          placeholder={isShipper ? "ap@shipper.com" : "billing@carrier.com"}
          rules={{
            validate: (value: string | boolean) => {
              const email = String(value).trim();
              if (!email) return "Enter an email";
              if (email.length > 254) return "At most 254 characters";
              return EMAIL_SHAPE.test(email) || "Enter a valid email";
            },
          }}
        />
        <BaseInput
          name="phone"
          control={control}
          type="tel"
          label="Phone"
          placeholder="Optional"
          rules={{ maxLength: maxLength(32) }}
        />
      </div>
      <div className="flex flex-col gap-3">
        <BaseSwitch name="receivesInvoices" control={control}>
          <span className="flex flex-col">
            <span>Receives invoices and documents</span>
            <span className="text-xs text-content-5">
              Filled in as the &quot;To&quot; address when emailing an invoice or its documents.
            </span>
          </span>
        </BaseSwitch>
        <BaseSwitch name="receivesReminders" control={control}>
          Receives payment reminders
        </BaseSwitch>
        {isShipper && (
          <BaseSwitch name="receivesStatements" control={control}>
            Receives statements
          </BaseSwitch>
        )}
        {contact && (
          <BaseSwitch name="isActive" control={control}>
            <span className="flex flex-col">
              <span>Active</span>
              <span className="text-xs text-content-5">
                Turn off to retire the contact: nothing more is sent to it.
              </span>
            </span>
          </BaseSwitch>
        )}
      </div>
    </FormModal>
  );
}

const DemoNote = () => (
  <p className="text-xs text-content-5">
    Demo only: these settings aren&apos;t saved yet.
  </p>
);

type AgreementValues = {
  effectiveFrom: string;
  currency: string;
  paymentTerms: string;
  creditStatus: string;
  creditLimit: string;
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
      effectiveFrom: "",
      currency: party.agreements?.[0]?.currency ?? party.defaultCurrency,
      paymentTerms: PaymentTerms.Net30,
      // Carried over once the API sends them, so new terms for another
      // reason don't drop the shipper's credit settings.
      creditStatus: replacing?.creditStatus ?? CreditStatus.Allowed,
      creditLimit: replacing?.creditLimit ?? "",
      taxTreatment: TaxTreatment.Standard,
      taxBasis: TaxBasis.BillTo,
      billingTrigger: "",
      daysBefore: "",
      notes: "",
    },
  });
  const creditAllowed =
    useWatch({ control, name: "creditStatus" }) === CreditStatus.Allowed;

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
        // Credit status and limit aren't sent: the API doesn't take them yet.
      };
      return createAgreement(body);
    },
    onSuccess: (_, values) => {
      toast.success("Agreement added.");
      if (
        !isCarrier &&
        (values.creditStatus !== CreditStatus.Allowed || values.creditLimit.trim())
      ) {
        toast.info("Credit settings — demo only, nothing was saved.");
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
      size="3xl"
      className="xl:max-w-4xl"
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
          label={isCarrier ? "Payment terms" : "Payment terms (credit period)"}
          options={isCarrier ? paymentTermsOptions : allPaymentTermsOptions}
          disallowEmptySelection
          rules={{
            validate: (value: string | boolean) =>
              !PAYMENT_TERMS_NOT_IN_API.has(String(value)) ||
              "Net 90 can't be saved yet: the Accounts API doesn't support it",
          }}
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
      {!isCarrier && (
        <div className="flex flex-col gap-3 border-t border-content-3 pt-4">
          <div>
            <p className="text-sm font-semibold text-base-primary-900">Credit</p>
            <DemoNote />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <BaseSelect
              name="creditStatus"
              control={control}
              label="Credit status"
              options={creditStatusOptions}
              disallowEmptySelection
            />
            {creditAllowed && (
              <BaseInput
                name="creditLimit"
                control={control}
                label="Credit limit"
                placeholder="No limit"
                inputMode="decimal"
                description="The most this shipper may owe at once, in the currency above. Leave empty for no limit."
                rules={{
                  // The form also holds the on/off switches, hence the wider type.
                  validate: (value: string | boolean, values: AgreementValues) => {
                    const amount = String(value).trim();
                    return (
                      values.creditStatus !== CreditStatus.Allowed ||
                      amount === "" ||
                      CREDIT_LIMIT_PATTERN.test(amount) ||
                      "An amount of 0 or more, up to 2 decimals"
                    );
                  },
                }}
              />
            )}
          </div>
        </div>
      )}
    </FormModal>
  );
}
