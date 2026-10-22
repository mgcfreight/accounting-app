import { useDisclosure } from "@heroui/react";
import { useForm } from "react-hook-form";
import {
  BaseButton,
  BaseInput,
  BaseSelect,
  SuccessModal,
} from "@/components/common";
import { DownArrow } from "@/components/icons";

type Company = {
  legalName: string;
  gstHstNumber: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  placeOfSupply: string;
};

const placeOfSupplyOptions = [
  { key: "DESTINATION", label: "Destination province (default)", value: "DESTINATION" },
  { key: "ORIGIN", label: "Origin province", value: "ORIGIN" },
  { key: "BILLING", label: "Billing address", value: "BILLING" },
];

// Printed on every invoice (design §8.3). The place-of-supply rule is open
// question 2 — the accountant confirms it before go-live.
export default function CompanyInformation() {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { control, handleSubmit } = useForm<Company>({
    mode: "all",
    defaultValues: {
      legalName: "MGC Freight Inc.",
      gstHstNumber: "",
      address: "",
      city: "Mississauga",
      province: "ON",
      postalCode: "",
      placeOfSupply: "DESTINATION",
    },
  });

  return (
    <>
      <form className="border-t-1 grid grid-cols-1 sm:grid-cols-2 gap-6 py-6">
        <BaseInput
          className="sm:col-span-2"
          name="legalName"
          control={control}
          label="Legal name"
          rules={{ required: "Enter the legal name" }}
        />
        <BaseInput
          name="gstHstNumber"
          control={control}
          label="GST/HST number"
          placeholder="123456789RT0001"
          rules={{
            required: "Enter the GST/HST number",
            pattern: { value: /^\d{9}RT\d{4}$/, message: "Format: 123456789RT0001" },
          }}
        />
        <BaseSelect
          name="placeOfSupply"
          control={control}
          label="Province that decides the tax"
          options={placeOfSupplyOptions}
          disallowEmptySelection
          description="To be confirmed by MGC's accountant."
        />
        <BaseInput className="sm:col-span-2" name="address" control={control} label="Street address" placeholder="123 Freight Way" />
        <BaseInput name="city" control={control} label="City" />
        <div className="grid grid-cols-2 gap-6">
          <BaseInput name="province" control={control} label="Province" />
          <BaseInput name="postalCode" control={control} label="Postal code" placeholder="L5T 2N7" />
        </div>
        <div className="sm:col-span-2 border-t-1 border-dashed pt-6 flex justify-end gap-4 items-center">
          <BaseButton
            text="Save"
            startContent={<DownArrow />}
            className="rounded-xl! px-6"
            onPress={() => handleSubmit(onOpen)()}
          />
        </div>
      </form>
      <SuccessModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        message="This is a demo — company details are not saved yet."
        buttonText="Return to Settings"
      />
    </>
  );
}
