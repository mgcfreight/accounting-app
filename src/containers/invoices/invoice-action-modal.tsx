import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  BaseInput,
  BaseSelect,
  BaseTextArea,
  FormModal,
} from "@/components/common";
import { chargeKindOptions } from "@/lib/constants";
import { InvoiceDirection } from "@/lib/enums";
import { Invoice } from "@/lib/interfaces";
import InvoiceCell from "./invoice-cell";

export type InvoiceAction =
  | "issue"
  | "charge"
  | "credit"
  | "dispute"
  | "carrier-bill";

type FormValues = {
  kind: string;
  description: string;
  amount: string;
  reason: string;
  billNo: string;
};

const titles: Record<InvoiceAction, string> = {
  issue: "Issue & Send Invoice",
  charge: "Add Charge (Debit Note)",
  credit: "Credit Note",
  dispute: "Flag as Disputed",
  "carrier-bill": "Enter Carrier Bill",
};

const confirmText: Record<InvoiceAction, string> = {
  issue: "Issue & Send",
  charge: "Add Charge",
  credit: "Create Credit Note",
  dispute: "Flag Dispute",
  "carrier-bill": "Save Bill",
};

// Amounts are typed as the 2-decimal string the API expects. Validation here
// is for the form only; the API validates again.
const AMOUNT_RULES = {
  required: "Enter an amount",
  pattern: {
    value: /^\d{1,9}\.\d{2}$/,
    message: "Enter the amount with cents, e.g. 125.00",
  },
};

const emptyForm = (invoice: Invoice): FormValues => ({
  kind: "",
  description: "",
  amount: "",
  reason: "",
  billNo: invoice.carrierBillNo ?? "",
});

// The forms behind an invoice's actions (design §8.2). Nothing is saved: the
// screens run on mock data, so confirming shows a notice and closes.
export default function InvoiceActionModal({
  action,
  invoice,
  onClose,
}: {
  action: InvoiceAction | null;
  invoice: Invoice;
  onClose: () => void;
}) {
  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: emptyForm(invoice),
  });

  // Reset from the invoice each time, not from defaults captured on mount:
  // the detail page keeps this modal mounted across invoices.
  useEffect(() => {
    if (action) reset(emptyForm(invoice));
  }, [action, invoice, reset]);

  if (!action) return null;

  const submit = handleSubmit(() => {
    toast.success(`${titles[action]} — demo only, nothing was saved or sent.`);
    onClose();
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={titles[action]}
      confirmText={confirmText[action]}
      onConfirm={submit}
    >
      {/* InvoiceCell, so a draft reads "Not issued" rather than 0.00. */}
      <p className="text-sm text-[#707070]">
        {invoice.number} · {invoice.partyName} · balance{" "}
        <InvoiceCell invoice={invoice} columnKey="balance" />
      </p>

      {action === "issue" &&
        (invoice.direction === InvoiceDirection.Receivable ? (
          <p className="text-sm">
            The invoice PDF and attachments will be emailed to the
            shipper&apos;s billing contacts, and the invoice can no longer be
            edited — changes after this are made with credit or debit notes.
          </p>
        ) : (
          <p className="text-sm">
            Confirms this carrier invoice as payable. It can no longer be
            edited — changes after this are made with credit or debit notes.
          </p>
        ))}

      {action === "charge" && (
        <>
          <BaseSelect
            name="kind"
            control={control}
            label="Charge type"
            options={chargeKindOptions}
            rules={{ required: "Choose a charge type" }}
          />
          <BaseInput
            name="description"
            control={control}
            label="Description"
            placeholder="Detention at consignee, 2 hours"
            rules={{ required: "Enter a description" }}
          />
          <BaseInput
            name="amount"
            control={control}
            label={`Amount before tax (${invoice.currency})`}
            placeholder="0.00"
            rules={AMOUNT_RULES}
          />
          <p className="text-xs text-content-5">
            Tax is added from the tax table for this shipment&apos;s province,
            the same way as the original lines.
          </p>
        </>
      )}

      {action === "credit" && (
        <>
          <BaseInput
            name="amount"
            control={control}
            label={`Credit amount before tax (${invoice.currency})`}
            placeholder="0.00"
            rules={AMOUNT_RULES}
          />
          <BaseTextArea
            name="reason"
            control={control}
            label="Reason"
            placeholder="Rate correction agreed with customer"
            rules={{ required: "Enter a reason" }}
          />
        </>
      )}

      {action === "dispute" && (
        <BaseTextArea
          name="reason"
          control={control}
          label="Reason for dispute"
          placeholder="Customer says liftgate was not used"
          rules={{ required: "Enter a reason" }}
          description="Disputed invoices get no reminders and are shown separately in aging."
        />
      )}

      {action === "carrier-bill" && (
        <>
          <BaseInput
            name="billNo"
            control={control}
            label="Carrier bill number"
            placeholder="DR-778120"
            rules={{ required: "Enter the carrier's bill number" }}
          />
          <BaseInput
            name="amount"
            control={control}
            label={`Bill total (${invoice.currency})`}
            placeholder="0.00"
            rules={AMOUNT_RULES}
            description="If it differs from the expected total, the difference becomes a debit or credit note."
          />
        </>
      )}
    </FormModal>
  );
}
