import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { BaseInput, BaseSelect, FormModal } from "@/components/common";
import { currencyOptions, paymentMethodOptions } from "@/lib/constants";
import { mockCarriers, mockShippers } from "@/lib/mock";

type FormValues = {
  direction: string;
  party: string;
  method: string;
  currency: string;
  amount: string;
  bankFee: string;
  paidOn: string;
  reference: string;
};

const directionOptions = [
  { key: "IN", label: "Money in (from a shipper)", value: "IN" },
  { key: "OUT", label: "Money out (to a carrier)", value: "OUT" },
];

const AMOUNT = /^\d{1,9}\.\d{2}$/;

// Recording a payment (design §8.5). On save the API would match it: invoice
// number in the reference, then exact amount, then oldest open invoice. Here
// nothing is saved.
export default function RecordPaymentModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { control, handleSubmit, reset, setValue } = useForm<FormValues>({
    defaultValues: {
      direction: "IN",
      party: "",
      method: "",
      currency: "CAD",
      amount: "",
      bankFee: "",
      paidOn: "",
      reference: "",
    },
  });
  const direction = useWatch({ control, name: "direction" });

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, reset]);

  // A shipper chosen before switching to "Money out" is not a carrier, so the
  // choice is cleared rather than submitted against the wrong list.
  useEffect(() => {
    setValue("party", "");
  }, [direction, setValue]);

  const parties = (direction === "OUT" ? mockCarriers : mockShippers).map(
    (party) => ({ key: party.id, label: party.name, value: party.id })
  );

  const submit = handleSubmit(() => {
    toast.success("Payment recorded — demo only, nothing was saved.");
    onClose();
  });

  return (
    <FormModal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Record Payment"
      confirmText="Record Payment"
      onConfirm={submit}
      size="xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BaseSelect
          className="sm:col-span-2"
          name="direction"
          control={control}
          label="Direction"
          options={directionOptions}
          disallowEmptySelection
        />
        <BaseSelect
          className="sm:col-span-2"
          name="party"
          control={control}
          label={direction === "OUT" ? "Carrier" : "Shipper"}
          options={parties}
          rules={{ required: "Choose who the payment is with" }}
        />
        <BaseSelect
          name="method"
          control={control}
          label="Method"
          options={paymentMethodOptions}
          rules={{ required: "Choose a method" }}
        />
        <BaseSelect
          name="currency"
          control={control}
          label="Currency"
          options={currencyOptions}
          disallowEmptySelection
          description="Version 1 records a payment in its invoice's currency."
        />
        <BaseInput
          name="amount"
          control={control}
          label="Amount"
          placeholder="0.00"
          rules={{
            required: "Enter the amount",
            pattern: { value: AMOUNT, message: "Enter the amount with cents, e.g. 1500.00" },
          }}
        />
        <BaseInput
          name="bankFee"
          control={control}
          label="Bank fee (optional)"
          placeholder="0.00"
          rules={{
            validate: (value) =>
              !value || AMOUNT.test(value) || "Enter the fee with cents, e.g. 15.00",
          }}
        />
        <BaseInput
          name="paidOn"
          control={control}
          type="date"
          label="Paid on"
          placeholder=" "
          rules={{ required: "Enter the payment date" }}
        />
        <BaseInput
          name="reference"
          control={control}
          label="Reference"
          placeholder="INV-10421 or cheque number"
          description="Include the invoice number to match automatically."
        />
      </div>
    </FormModal>
  );
}
