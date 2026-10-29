import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { BaseInput, BaseSelect, FormModal } from "@/components/common";
import { useCan } from "@/components/providers/user-provider";
import { FX_RATE_PATTERN, paymentMethodOptions } from "@/lib/constants";
import {
  Currency,
  PartyType,
  PaymentDirection,
  PaymentMethod,
  Permission,
} from "@/lib/enums";
import { torontoToday } from "@/lib/utils";
import { errorMessage, getParty, recordPayment } from "@/services";
import PartyPicker from "../shipments/party-picker";

type FormValues = {
  direction: string;
  party: string;
  method: string;
  amount: string;
  paidOn: string;
  reference: string;
  fxRateToCad: string;
};

const allDirections = [
  {
    key: PaymentDirection.In,
    label: "Money in (from a shipper)",
    value: PaymentDirection.In,
    permission: Permission.CustomerPaymentsCreate,
  },
  {
    key: PaymentDirection.Out,
    label: "Money out (to a carrier)",
    value: PaymentDirection.Out,
    permission: Permission.CarrierPaymentsCreate,
  },
];

const AMOUNT = /^\d{1,12}\.\d{2}$/;

// Recording a payment (design §8.5). The API saves it all unapplied; it is
// then allocated from the Unmatched tab, where matching suggests the
// invoices. The currency is the party's own: each party uses one.
export default function RecordPaymentModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  // Only the sides the role may record (the header button needs either).
  const { can } = useCan();
  const directionOptions = allDirections.filter((option) =>
    can(option.permission)
  );
  const { control, handleSubmit, reset, setValue } = useForm<FormValues>({
    defaultValues: {
      direction: directionOptions[0]?.value ?? PaymentDirection.In,
      party: "",
      method: "",
      amount: "",
      paidOn: "",
      reference: "",
      fxRateToCad: "",
    },
  });
  const direction = useWatch({ control, name: "direction" }) as PaymentDirection;
  const partyId = useWatch({ control, name: "party" });

  // One key per payment being recorded: a retry after a lost answer returns
  // the payment already saved instead of recording it twice.
  const idempotencyKey = useRef("");
  useEffect(() => {
    if (isOpen) {
      reset();
      idempotencyKey.current = crypto.randomUUID();
    }
  }, [isOpen, reset]);

  // A shipper chosen before switching to "Money out" is not a carrier, so the
  // choice is cleared rather than submitted against the wrong side.
  useEffect(() => {
    setValue("party", "");
  }, [direction, setValue]);

  const party = useQuery({
    queryKey: ["parties", "detail", partyId],
    queryFn: ({ signal }) => getParty(partyId, signal),
    enabled: !!partyId,
  });
  const currency = party.data?.defaultCurrency;

  const record = useMutation({
    mutationFn: (values: FormValues) =>
      recordPayment(direction, {
        partyId: values.party,
        paymentDate: values.paidOn,
        amount: values.amount,
        currency: currency!,
        fxRateToCad:
          currency === Currency.USD && values.fxRateToCad.trim()
            ? values.fxRateToCad.trim()
            : undefined,
        method: values.method as PaymentMethod,
        reference: values.reference.trim() || undefined,
        idempotencyKey: idempotencyKey.current,
      }),
    onSuccess: (payment) => {
      toast.success(
        `${payment.number} recorded. Allocate it from the Unmatched tab.`
      );
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const submit = handleSubmit((values) => {
    if (!currency) {
      toast.error("Wait for the party to load, then try again.");
      return;
    }
    record.mutate(values);
  });

  const today = torontoToday();

  return (
    <FormModal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Record Payment"
      confirmText="Record Payment"
      onConfirm={submit}
      isConfirming={record.isPending}
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
        <div className="sm:col-span-2">
          <PartyPicker
            key={direction}
            control={control}
            name="party"
            type={
              direction === PaymentDirection.Out
                ? PartyType.Carrier
                : PartyType.Shipper
            }
            label={direction === PaymentDirection.Out ? "Carrier" : "Shipper"}
            description={
              currency
                ? `Paid in ${currency}, the ${
                    direction === PaymentDirection.Out ? "carrier" : "shipper"
                  }'s currency.`
                : undefined
            }
            isRequired
          />
        </div>
        <BaseSelect
          name="method"
          control={control}
          label="Method"
          options={paymentMethodOptions}
          rules={{ required: "Choose a method" }}
        />
        <BaseInput
          name="amount"
          control={control}
          label={currency ? `Amount (${currency})` : "Amount"}
          placeholder="0.00"
          rules={{
            required: "Enter the amount",
            pattern: {
              value: AMOUNT,
              message: "Enter the amount with cents, e.g. 1500.00",
            },
            validate: (value) =>
              !/^0+\.00$/.test(value) || "Enter more than 0.00",
          }}
        />
        <BaseInput
          name="paidOn"
          control={control}
          type="date"
          label="Paid on"
          placeholder=" "
          max={today}
          rules={{
            required: "Enter the payment date",
            validate: (value) =>
              value <= today || "The payment date can't be in the future",
          }}
        />
        <BaseInput
          name="reference"
          control={control}
          label="Reference (optional)"
          placeholder="sin_EGP9wr_230 or cheque number"
          description="Include the invoice number to match automatically."
          rules={{ maxLength: { value: 64, message: "At most 64 characters" } }}
        />
        {currency === Currency.USD && (
          <BaseInput
            className="sm:col-span-2"
            name="fxRateToCad"
            control={control}
            label="Rate to CAD (optional)"
            placeholder="1.372500"
            description="The bank's own rate, if it gave one. Left empty, the Bank of Canada rate for the payment date is used."
            rules={{
              validate: (value) =>
                !value.trim() ||
                FX_RATE_PATTERN.test(value.trim()) ||
                "A positive number, up to 6 decimals",
            }}
          />
        )}
      </div>
    </FormModal>
  );
}
