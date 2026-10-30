import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Control, useForm, UseFormSetValue, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  BaseButton,
  BaseCardWrapper,
  BaseInput,
  BaseSelect,
  LeavePageModal,
} from "@/components/common";
import { ArrowRight } from "@/components/icons";
import { useUnsavedChanges } from "@/hooks";
import {
  CANADIAN_PROVINCES,
  COUNTRY_PATTERN,
  paymentTermsOptions,
  REGION_PATTERN,
  TMS_INVOICE_CODE_PATTERN,
} from "@/lib/constants";
import { PartyType, PaymentTerms } from "@/lib/enums";
import { ReferenceNumbers } from "@/lib/interfaces";
import { torontoLocalToIso, torontoNowLocal } from "@/lib/utils";
import { createShipment, errorMessage, NewShipment } from "@/services";
import ChargeLines, { ChargeValues, emptyCharge, toCharges } from "../invoices/charge-lines";
import { referenceLabels } from "../invoices/invoice-view";
import usePartyNames from "../parties/use-party-names";
import { agreementInForce } from "./agreement-in-force";
import PartyPicker from "./party-picker";
import { shipmentHref } from "./shipment-list";

type RefValues = Record<keyof ReferenceNumbers, string>;

type ShipmentValues = RefValues & {
  mgcShipmentId: string;
  loadNumber: string;
  shipperPartyId: string;
  carrierPartyId: string;
  tmsStatus: string;
  tmsPaymentTerms: string;
  tmsCustomerInvoiceCode: string;
  tmsCarrierInvoiceCode: string;
  originCity: string;
  originProvince: string;
  originCountry: string;
  destinationCity: string;
  destinationProvince: string;
  destinationCountry: string;
  pickupDate: string;
  deliveryDate: string;
  mgcCreatedAt: string;
  customerCharges: ChargeValues[];
  carrierCharges: ChargeValues[];
};

const referenceKeys = Object.keys(referenceLabels) as (keyof ReferenceNumbers)[];

const DATE_PATTERN = { value: /^\d{4}-\d{2}-\d{2}$/, message: "Enter a date" };

const maxLength = (value: number) => ({
  value,
  message: `At most ${value} characters`,
});

const provinceOptions = CANADIAN_PROVINCES.map((code) => ({
  key: code,
  label: code,
  value: code,
}));

// A text check for this form, whose values also hold charge lists: RHF
// types every validator for any of them.
const text =
  (check: (value: string) => true | string) =>
  (value: unknown) =>
    check(typeof value === "string" ? value : "");

// Optional text: blank is left out of the request.
const optional = (value: string) => value.trim() || undefined;

const tmsCodeRules = {
  validate: text(
    (value) =>
      value.trim() === "" ||
      TMS_INVOICE_CODE_PATTERN.test(value.trim()) ||
      "6 letters or digits"
  ),
};

const dateRules = {
  validate: text(
    (value) => value === "" || DATE_PATTERN.value.test(value) || DATE_PATTERN.message
  ),
};

const toRequest = (values: ShipmentValues): NewShipment => {
  const hasCarrier = !!values.carrierPartyId;
  const references = Object.fromEntries(
    referenceKeys
      .map((key) => [key, optional(values[key])])
      .filter(([, value]) => value !== undefined)
  ) as Partial<RefValues>;
  return {
    ...references,
    mgcShipmentId: values.mgcShipmentId.trim(),
    loadNumber: values.loadNumber.trim(),
    shipperPartyId: values.shipperPartyId,
    tmsStatus: values.tmsStatus.trim(),
    tmsPaymentTerms: values.tmsPaymentTerms as PaymentTerms,
    tmsCustomerInvoiceCode: optional(values.tmsCustomerInvoiceCode),
    originCity: optional(values.originCity),
    originProvince: optional(values.originProvince.toUpperCase()),
    originCountry: optional(values.originCountry),
    destinationCity: optional(values.destinationCity),
    destinationProvince: optional(values.destinationProvince.toUpperCase()),
    destinationCountry: optional(values.destinationCountry),
    pickupDate: optional(values.pickupDate),
    deliveryDate: optional(values.deliveryDate),
    mgcCreatedAt: torontoLocalToIso(values.mgcCreatedAt),
    customerCharges: toCharges(values.customerCharges),
    ...(hasCarrier && {
      carrierPartyId: values.carrierPartyId,
      tmsCarrierInvoiceCode: optional(values.tmsCarrierInvoiceCode),
      carrierCharges: toCharges(values.carrierCharges),
    }),
  };
};

// A shipment typed in from the TMS until the MGC sync brings them (design
// §9). Saving takes the next invoice number and makes the customer invoice
// as a draft and, with a carrier, the carrier invoice. Currencies, terms and
// tax come from each party's agreement; every amount is calculated by the
// API.
export default function ShipmentForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { dirtyFields },
  } = useForm<ShipmentValues>({
    // Hidden fields (carrier charges without a carrier) drop out of the form
    // and its validation.
    shouldUnregister: true,
    defaultValues: {
      ...(Object.fromEntries(referenceKeys.map((key) => [key, ""])) as RefValues),
      mgcShipmentId: "",
      loadNumber: "",
      shipperPartyId: "",
      carrierPartyId: "",
      tmsStatus: "",
      tmsPaymentTerms: PaymentTerms.Net30,
      tmsCustomerInvoiceCode: "",
      tmsCarrierInvoiceCode: "",
      originCity: "",
      originProvince: "",
      originCountry: "CA",
      destinationCity: "",
      destinationProvince: "",
      destinationCountry: "CA",
      pickupDate: "",
      deliveryDate: "",
      mgcCreatedAt: torontoNowLocal(),
      customerCharges: [emptyCharge],
      carrierCharges: [emptyCharge],
    },
  });
  const [shipperPartyId, carrierPartyId, mgcCreatedAt] = useWatch({
    control,
    name: ["shipperPartyId", "carrierPartyId", "mgcCreatedAt"],
  });
  const hasCarrier = !!carrierPartyId;
  // Each side's prices are in the currency of its party's agreement on the
  // invoice date. Unknown (no party, no agreement then, still loading, or no
  // parties.view) leaves the label without one rather than guess.
  const parties = usePartyNames([shipperPartyId, carrierPartyId]);
  const invoiceDate = mgcCreatedAt.slice(0, 10);
  const priceLabel = (partyId: string) => {
    const currency = agreementInForce(parties.get(partyId), invoiceDate)?.currency;
    return currency ? `Unit price (${currency})` : "Unit price";
  };
  // Fields the user has edited, not `isDirty`, and only those still in the
  // form: hidden fields unregister (shouldUnregister) and leave the values,
  // and a field-array change diffs every default against them, marking the
  // hidden ones dirty.
  const registered = getValues();
  const leaving = useUnsavedChanges(
    Object.keys(dirtyFields).some((key) => key in registered)
  );

  const save = useMutation({
    mutationFn: (values: ShipmentValues) => createShipment(toRequest(values)),
    onSuccess: ({ shipment, customerInvoice }) => {
      toast.success(
        customerInvoice.invoiceNumber
          ? `Shipment entered. Invoice ${customerInvoice.invoiceNumber} is a draft.`
          : "Shipment entered. Its invoice is a draft, waiting for the TMS code."
      );
      void queryClient.invalidateQueries({ queryKey: ["shipments"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      leaving.allowLeave();
      navigate(shipmentHref(shipment));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <form
      noValidate
      className="grid grid-cols-1 gap-6"
      onSubmit={handleSubmit((values) => save.mutate(values))}
    >
      <div className="flex items-center gap-4">
        <Link to="/shipments/" className="text-base text-[#71717A]">
          Shipments
        </Link>
        <ArrowRight />
        <span className="text-base-primary-600 text-sm">New Shipment</span>
      </div>

      <BaseCardWrapper heading="Shipment">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <BaseInput
            name="mgcShipmentId"
            control={control}
            label="MGC shipment id"
            placeholder="98123"
            rules={{ required: "Enter the TMS shipment id", maxLength: maxLength(64) }}
          />
          <BaseInput
            name="loadNumber"
            control={control}
            label="Load #"
            placeholder="4812"
            rules={{ required: "Enter the load number", maxLength: maxLength(32) }}
          />
          <BaseInput
            name="tmsStatus"
            control={control}
            label="TMS status"
            placeholder="BOOKED"
            rules={{ required: "Enter the TMS status", maxLength: maxLength(32) }}
          />
          <BaseSelect
            name="tmsPaymentTerms"
            control={control}
            label="TMS payment terms"
            options={paymentTermsOptions}
            disallowEmptySelection
            description="Compared with the shipper's agreement."
          />
          <BaseInput
            name="mgcCreatedAt"
            control={control}
            type="datetime-local"
            label="Created in TMS (Toronto time)"
            description="Its date is the invoice date."
            rules={{
              required: "Enter when the shipment was created",
              pattern: {
                value: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
                message: "Enter a date and time",
              },
            }}
          />
        </div>
      </BaseCardWrapper>

      <BaseCardWrapper heading="Parties">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <PartyPicker
            control={control}
            name="shipperPartyId"
            type={PartyType.Shipper}
            label="Shipper"
            description="Needs an agreement in force on the invoice date."
            isRequired
          />
          <PartyPicker
            control={control}
            name="carrierPartyId"
            type={PartyType.Carrier}
            label="Carrier (if booked)"
            description="Makes the carrier invoice too."
          />
          <BaseInput
            name="tmsCustomerInvoiceCode"
            control={control}
            label="TMS shipper invoice code"
            placeholder="EGP9wr"
            description="6 letters or digits. Without it the invoice waits for a number."
            rules={tmsCodeRules}
          />
          {hasCarrier && (
            <BaseInput
              name="tmsCarrierInvoiceCode"
              control={control}
              label="TMS carrier invoice code"
              placeholder="K3pQ7x"
              rules={tmsCodeRules}
            />
          )}
        </div>
      </BaseCardWrapper>

      <BaseCardWrapper heading="Route">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AddressFields
            control={control}
            setValue={setValue}
            side="origin"
            heading="From"
          />
          <AddressFields
            control={control}
            setValue={setValue}
            side="destination"
            heading="To"
          />
          <BaseInput
            name="pickupDate"
            control={control}
            type="date"
            label="Pickup date"
            rules={dateRules}
          />
          <BaseInput
            name="deliveryDate"
            control={control}
            type="date"
            label="Delivery date"
            rules={dateRules}
          />
        </div>
      </BaseCardWrapper>

      <BaseCardWrapper heading="Reference Numbers">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {referenceKeys.map((key) => (
            <BaseInput
              key={key}
              name={key}
              control={control}
              label={`${referenceLabels[key]} number`}
              rules={{ maxLength: maxLength(key === "quoteNumber" ? 32 : 64) }}
            />
          ))}
        </div>
        <p className="text-xs text-content-5 mt-3">
          An invoice needs at least one before it&apos;s issued or approved.
        </p>
      </BaseCardWrapper>

      <BaseCardWrapper heading="Shipper Charges">
        <p className="text-xs text-content-5 mb-3">
          What the shipper is charged, before tax, in the currency of their
          agreement.
        </p>
        <ChargeLines
          control={control}
          name="customerCharges"
          priceLabel={priceLabel(shipperPartyId)}
        />
      </BaseCardWrapper>

      {hasCarrier && (
        <BaseCardWrapper heading="Expected Carrier Charges">
          <p className="text-xs text-content-5 mb-3">
            What the carrier is expected to bill, before tax. Their actual bill
            is compared with this when it arrives.
          </p>
          <ChargeLines
            control={control}
            name="carrierCharges"
            priceLabel={priceLabel(carrierPartyId)}
          />
        </BaseCardWrapper>
      )}

      <div className="flex justify-end gap-3">
        <BaseButton
          text="Cancel"
          varient="bordered"
          className="text-base-primary px-6"
          onPress={() => navigate("/shipments/")}
        />
        <BaseButton
          type="submit"
          text="Save Shipment"
          className="px-6"
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

// City, country and province for one end of the route. A Canadian address
// needs its province: the destination's can pick the tax rate.
function AddressFields({
  control,
  setValue,
  side,
  heading,
}: {
  control: Control<ShipmentValues>;
  setValue: UseFormSetValue<ShipmentValues>;
  side: "origin" | "destination";
  heading: string;
}) {
  const country = useWatch({ control, name: `${side}Country` }).trim();
  const isCanadian = country === "CA";
  // The province select and the state box share one value: a state typed
  // for another country would stay hidden behind a blank select and be sent.
  useEffect(() => setValue(`${side}Province`, ""), [isCanadian, side, setValue]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-base-primary">{heading}</p>
      <BaseInput
        name={`${side}City`}
        control={control}
        label="City"
        rules={{ maxLength: maxLength(100) }}
      />
      <BaseInput
        name={`${side}Country`}
        control={control}
        label="Country"
        description="2-letter ISO code. Leave blank if unknown."
        rules={{
          validate: text(
            (value) =>
              value.trim() === "" ||
              COUNTRY_PATTERN.test(value.trim()) ||
              "2 capital letters, e.g. CA"
          ),
        }}
      />
      {isCanadian ? (
        <BaseSelect
          key="ca"
          name={`${side}Province`}
          control={control}
          label="Province"
          options={provinceOptions}
          rules={{ required: "Choose a province" }}
        />
      ) : (
        <BaseInput
          key="other"
          name={`${side}Province`}
          control={control}
          label="State / region"
          rules={{
            validate: text(
              (value) =>
                value.trim() === "" ||
                REGION_PATTERN.test(value.trim().toUpperCase()) ||
                "2-3 letters"
            ),
          }}
        />
      )}
    </div>
  );
}
