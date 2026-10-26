import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  BaseButton,
  BaseInput,
  BaseSelect,
  BaseTextArea,
  FormModal,
} from "@/components/common";
import { Add } from "@/components/icons";
import { chargeKindOptions, invoiceLineKindOptions } from "@/lib/constants";
import { InvoiceDirection } from "@/lib/enums";
import { Invoice } from "@/lib/interfaces";
import InvoiceCell from "./invoice-cell";

export type InvoiceAction =
  | "issue"
  | "revise"
  | "charge"
  | "credit"
  | "dispute"
  | "carrier-bill";

type LineValues = { kind: string; description: string; amount: string };

type FormValues = {
  kind: string;
  description: string;
  amount: string;
  reason: string;
  billNo: string;
  lines: LineValues[];
};

const titles: Record<InvoiceAction, string> = {
  issue: "Issue & Send Invoice",
  revise: "Edit Invoice (New Version)",
  charge: "Add Charge (Debit Note)",
  credit: "Credit Note",
  dispute: "Flag as Disputed",
  "carrier-bill": "Enter Carrier Bill",
};

const confirmText: Record<InvoiceAction, string> = {
  issue: "Issue & Send",
  revise: "Issue New Version",
  charge: "Add Charge",
  credit: "Create Credit Note",
  dispute: "Flag Dispute",
  "carrier-bill": "Save Bill",
};

// The API caps an invoice at 50 lines.
const MAX_LINES = 50;

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
  // The whole current set of charges, to change in place: the new version
  // is made from all of them, not from the difference.
  lines: invoice.lines.map((line) => ({
    kind: line.kind,
    description: line.description,
    amount: line.amount,
  })),
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
  const lines = useFieldArray({ control, name: "lines" });

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

  const isReceivable = invoice.direction === InvoiceDirection.Receivable;

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={titles[action]}
      confirmText={confirmText[action]}
      onConfirm={submit}
      size={action === "revise" ? "2xl" : "md"}
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
            edited — changes after this are made with a new version, or with credit or debit notes.
          </p>
        ) : (
          <p className="text-sm">
            Confirms this carrier invoice as payable. It can no longer be
            edited — changes after this are made with a new version, or with credit or debit notes.
          </p>
        ))}

      {action === "revise" && (
        <>
          <p className="text-sm">
            {invoice.number} is kept exactly as it was sent and marked
            Replaced. The new version gets the next letter on the number
            (230 → 230a → 230b) and keeps the same invoice
            date, due date and reference numbers. Tax is worked out again on
            the charges below. Payments already received move to the new
            version; its total can&apos;t be lower than what has been paid.
          </p>
          {isReceivable ? (
            <p className="text-xs text-content-5">
              Emailing isn&apos;t built yet: the new version is issued and
              marked &quot;Not sent yet&quot;.
            </p>
          ) : (
            <p className="text-xs text-content-5">
              The new version has to be approved again before it can be paid.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {lines.fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-1 sm:grid-cols-[10rem_1fr_8rem_auto] gap-2 items-start"
              >
                <BaseSelect
                  name={`lines.${index}.kind`}
                  control={control}
                  label="Charge type"
                  options={invoiceLineKindOptions}
                  rules={{ required: "Choose a charge type" }}
                />
                <BaseInput
                  name={`lines.${index}.description`}
                  control={control}
                  label="Description"
                  rules={{ required: "Enter a description" }}
                />
                <BaseInput
                  name={`lines.${index}.amount`}
                  control={control}
                  label={`Before tax (${invoice.currency})`}
                  placeholder="0.00"
                  rules={AMOUNT_RULES}
                />
                <BaseButton
                  text="Remove"
                  varient="light"
                  className="text-base-primary mt-1"
                  isDisabled={lines.fields.length === 1}
                  aria-label={`Remove line ${index + 1}`}
                  onPress={() => lines.remove(index)}
                />
              </div>
            ))}
            <BaseButton
              text="Add line"
              varient="light"
              className="text-base-primary w-fit"
              startContent={<Add />}
              isDisabled={lines.fields.length >= MAX_LINES}
              onPress={() =>
                lines.append({ kind: "", description: "", amount: "" })
              }
            />
          </div>

          {!isReceivable && (
            <BaseInput
              name="billNo"
              control={control}
              label="Carrier bill number"
              description="Change it only if the carrier sent a new bill."
              rules={{ required: "Enter the carrier's bill number" }}
            />
          )}
          <BaseTextArea
            name="reason"
            control={control}
            label="Reason for the change"
            placeholder="Detention at consignee, 2 hours"
            description="Shown in the invoice's version history."
            rules={{
              required: "Enter a reason",
              minLength: { value: 3, message: "Enter at least 3 characters" },
              maxLength: { value: 255, message: "Keep it under 255 characters" },
            }}
          />
        </>
      )}

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
