import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  BaseInput,
  BaseSwitch,
  BaseTextArea,
  FormModal,
  Money,
} from "@/components/common";
import {
  billingTriggerLabels,
  FX_RATE_PATTERN,
  reviewFlagLabels,
  TMS_INVOICE_CODE_PATTERN,
} from "@/lib/constants";
import {
  BillingTrigger,
  CarrierInvoiceStatus,
  Currency,
  InvoiceReviewFlag,
} from "@/lib/enums";
import { CarrierInvoiceView, ReferenceNumbers } from "@/lib/interfaces";
import {
  ApiError,
  approveCarrierInvoice,
  errorMessage,
  InvoiceChanges,
  issueCustomerInvoice,
  receiveCarrierInvoice,
  updateCarrierInvoice,
  updateCustomerInvoice,
} from "@/services";
import ChargeLines, { ChargeValues, emptyCharge, toCharges } from "./charge-lines";
import {
  InvoiceBalance,
  invoiceNumberOf,
  InvoiceView,
  isCustomerInvoice,
  partyOf,
  referenceLabels,
} from "./invoice-view";

export type InvoiceAction = "edit" | "issue" | "receive" | "approve";

// The forms behind an invoice's actions, each sending the invoice's
// `version`. Each is mounted only while open, so its form starts from the
// invoice as last read. After a change — or a 409, meaning someone else
// changed it first — every invoice query is refetched.
export default function InvoiceActionModal({
  action,
  invoice,
  onClose,
}: {
  action: InvoiceAction | null;
  invoice: InvoiceView;
  onClose: () => void;
}) {
  switch (action) {
    case "edit":
      return <EditInvoiceModal invoice={invoice} onClose={onClose} />;
    case "issue":
      return <IssueInvoiceModal invoice={invoice} onClose={onClose} />;
    case "receive":
      return isCustomerInvoice(invoice) ? null : (
        <ReceiveBillModal invoice={invoice} onClose={onClose} />
      );
    case "approve":
      return isCustomerInvoice(invoice) ? null : (
        <ApproveInvoiceModal invoice={invoice} onClose={onClose} />
      );
    default:
      return null;
  }
}

// Saves through `action`, then refetches invoices and closes.
const useInvoiceMutation = <T,>(
  action: (values: T) => Promise<unknown>,
  successMessage: string,
  onClose: () => void
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: () => {
      toast.success(successMessage);
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      onClose();
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      }
    },
  });
};

function InvoiceSummary({ invoice }: { invoice: InvoiceView }) {
  return (
    <p className="text-sm text-[#707070]">
      {invoiceNumberOf(invoice) ?? "No number yet"} · {partyOf(invoice).name} ·
      balance <InvoiceBalance invoice={invoice} className="" />
    </p>
  );
}

function ReviewFlagList({ flags }: { flags: InvoiceReviewFlag[] }) {
  return (
    <ul className="list-disc pl-5 text-sm text-[#343A40]">
      {flags.map((flag) => (
        <li key={flag}>{reviewFlagLabels[flag]}</li>
      ))}
    </ul>
  );
}

// ----------------------------------------------------------------- edit

type EditValues = Record<keyof ReferenceNumbers, string> & {
  tmsInvoiceCode: string;
  fxRateToCad: string;
  notes: string;
};

const referenceKeys = Object.keys(referenceLabels) as (keyof ReferenceNumbers)[];

const editDefaults = (invoice: InvoiceView): EditValues => ({
  ...(Object.fromEntries(
    referenceKeys.map((key) => [key, invoice[key] ?? ""])
  ) as Record<keyof ReferenceNumbers, string>),
  tmsInvoiceCode: invoice.tmsInvoiceCode ?? "",
  fxRateToCad: invoice.fxRateToCad ?? "",
  notes: invoice.notes ?? "",
});

// Only what changed is sent. An emptied reference number or note is sent as
// "" (the API clears it); the TMS code and FX rate can't be cleared.
const changesFrom = (
  invoice: InvoiceView,
  values: EditValues
): Omit<InvoiceChanges, "version"> => {
  const before = editDefaults(invoice);
  const changes: Omit<InvoiceChanges, "version"> = {};
  for (const key of [...referenceKeys, "notes"] as const) {
    const value = values[key].trim();
    if (value !== before[key]) changes[key] = value;
  }
  const code = values.tmsInvoiceCode.trim();
  if (code && code !== before.tmsInvoiceCode) changes.tmsInvoiceCode = code;
  const rate = values.fxRateToCad.trim();
  if (rate && rate !== before.fxRateToCad) changes.fxRateToCad = rate;
  return changes;
};

function EditInvoiceModal({
  invoice,
  onClose,
}: {
  invoice: InvoiceView;
  onClose: () => void;
}) {
  const { control, handleSubmit } = useForm<EditValues>({
    defaultValues: editDefaults(invoice),
  });

  const save = useInvoiceMutation(
    (changes: Omit<InvoiceChanges, "version">) => {
      const body = { ...changes, version: invoice.version };
      return isCustomerInvoice(invoice)
        ? updateCustomerInvoice(invoice.id, body)
        : updateCarrierInvoice(invoice.id, body);
    },
    "Invoice updated.",
    onClose
  );

  const submit = handleSubmit((values) => {
    const changes = changesFrom(invoice, values);
    if (Object.keys(changes).length === 0) {
      toast.info("Nothing changed.");
      onClose();
      return;
    }
    save.mutate(changes);
  });

  const keepIfSet = (current: string | null, what: string) => (value: string) =>
    !current || value.trim() !== "" || `The ${what} can't be removed once set`;

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Edit Invoice Details"
      confirmText="Save"
      isConfirming={save.isPending}
      onConfirm={submit}
      size="2xl"
    >
      <InvoiceSummary invoice={invoice} />
      <p className="text-xs text-content-5">
        Amounts never change here. Clear a reference number to remove it.
      </p>
      <BaseInput
        name="tmsInvoiceCode"
        control={control}
        label="TMS invoice code"
        placeholder="EGP9wr"
        description="6 letters or digits. Gives the invoice its number."
        rules={{
          validate: {
            format: (value: string) =>
              value.trim() === "" ||
              TMS_INVOICE_CODE_PATTERN.test(value.trim()) ||
              "6 letters or digits",
            keep: keepIfSet(invoice.tmsInvoiceCode, "TMS code"),
          },
        }}
      />
      {invoice.currency === Currency.USD && (
        <BaseInput
          name="fxRateToCad"
          control={control}
          label="Rate to CAD"
          placeholder="1.372500"
          description="USD to CAD, up to 6 decimals."
          rules={{
            validate: {
              format: (value: string) =>
                value.trim() === "" ||
                FX_RATE_PATTERN.test(value.trim()) ||
                "A positive number, up to 6 decimals",
              keep: keepIfSet(invoice.fxRateToCad, "FX rate"),
            },
          }}
        />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {referenceKeys.map((key) => (
          <BaseInput
            key={key}
            name={key}
            control={control}
            label={`${referenceLabels[key]} number`}
            rules={{
              maxLength: {
                value: key === "quoteNumber" ? 32 : 64,
                message: `At most ${key === "quoteNumber" ? 32 : 64} characters`,
              },
            }}
          />
        ))}
      </div>
      <BaseTextArea
        name="notes"
        control={control}
        label="Notes"
        rules={{ maxLength: { value: 2000, message: "At most 2000 characters" } }}
      />
    </FormModal>
  );
}

// ---------------------------------------------------------------- issue

function IssueInvoiceModal({
  invoice,
  onClose,
}: {
  invoice: InvoiceView;
  onClose: () => void;
}) {
  const { control, handleSubmit } = useForm({
    defaultValues: { acknowledgeReview: false },
  });
  const [missingAck, setMissingAck] = useState(false);
  const flags = invoice.reviewFlags;

  const issue = useInvoiceMutation(
    ({ acknowledgeReview }: { acknowledgeReview: boolean }) =>
      issueCustomerInvoice(invoice.id, {
        version: invoice.version,
        ...(flags.length > 0 && { acknowledgeReview }),
      }),
    "Invoice issued.",
    onClose
  );

  const submit = handleSubmit((values) => {
    if (flags.length > 0 && !values.acknowledgeReview) {
      setMissingAck(true);
      return;
    }
    issue.mutate(values);
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Issue Invoice"
      confirmText="Issue"
      isConfirming={issue.isPending}
      onConfirm={submit}
    >
      <InvoiceSummary invoice={invoice} />
      <p className="text-sm">
        Once issued, the invoice&apos;s amounts never change. It needs a TMS
        invoice code and at least one reference number.
      </p>
      {flags.length > 0 && (
        <>
          <p className="text-sm font-semibold">This invoice is flagged:</p>
          <ReviewFlagList flags={flags} />
          <BaseSwitch name="acknowledgeReview" control={control}>
            I&apos;ve checked these. (Recorded in the audit log.)
          </BaseSwitch>
          {missingAck && (
            <p className="text-xs text-base-danger">
              Confirm you&apos;ve checked the flags to issue it.
            </p>
          )}
        </>
      )}
    </FormModal>
  );
}

// ------------------------------------------------------- carrier: receive

type BillValues = {
  carrierInvoiceNumber: string;
  invoiceDate: string;
  lines: ChargeValues[];
};

function ReceiveBillModal({
  invoice,
  onClose,
}: {
  invoice: CarrierInvoiceView;
  onClose: () => void;
}) {
  const { control, handleSubmit } = useForm<BillValues>({
    defaultValues: {
      carrierInvoiceNumber: "",
      invoiceDate: "",
      lines: [emptyCharge],
    },
  });

  const receive = useInvoiceMutation(
    (values: BillValues) =>
      receiveCarrierInvoice(invoice.id, {
        version: invoice.version,
        carrierInvoiceNumber: values.carrierInvoiceNumber.trim(),
        invoiceDate: values.invoiceDate,
        lines: toCharges(values.lines),
      }),
    "Carrier bill recorded.",
    onClose
  );

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Enter Carrier Bill"
      confirmText="Save Bill"
      isConfirming={receive.isPending}
      onConfirm={handleSubmit((values) => receive.mutate(values))}
      size="2xl"
    >
      <p className="text-sm text-[#707070]">
        {invoice.carrierName} · expected{" "}
        <Money amount={invoice.expectedTotal} currency={invoice.currency} />{" "}
        before tax
      </p>
      <p className="text-xs text-content-5">
        Enter the charges as printed on the bill, before tax. Line amounts and
        tax are calculated by the server. A subtotal different from expected
        puts the invoice on hold. The due date counts from today.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BaseInput
          name="carrierInvoiceNumber"
          control={control}
          label="Carrier's bill number"
          placeholder="SH-55102"
          rules={{
            required: "Enter the carrier's bill number",
            maxLength: { value: 64, message: "At most 64 characters" },
          }}
        />
        <BaseInput
          name="invoiceDate"
          control={control}
          type="date"
          label="Date on the bill"
          description="Picks the tax rate."
          rules={{
            required: "Enter the date on the bill",
            pattern: { value: /^\d{4}-\d{2}-\d{2}$/, message: "Enter a date" },
          }}
        />
      </div>
      <ChargeLines
        control={control}
        name="lines"
        priceLabel={`Unit price (${invoice.currency})`}
      />
    </FormModal>
  );
}

// ------------------------------------------------------- carrier: approve

function ApproveInvoiceModal({
  invoice,
  onClose,
}: {
  invoice: CarrierInvoiceView;
  onClose: () => void;
}) {
  const { control, handleSubmit } = useForm({
    defaultValues: { podReceived: false, acknowledgeReview: false },
  });
  const [missing, setMissing] = useState<string | null>(null);
  const needsPod = invoice.billingTrigger === BillingTrigger.OnDeliveryWithPod;
  const flags = invoice.reviewFlags;

  const approve = useInvoiceMutation(
    (values: { podReceived: boolean; acknowledgeReview: boolean }) =>
      approveCarrierInvoice(invoice.id, {
        version: invoice.version,
        ...(needsPod && { podReceived: values.podReceived }),
        ...(flags.length > 0 && { acknowledgeReview: values.acknowledgeReview }),
      }),
    "Carrier invoice approved.",
    onClose
  );

  const submit = handleSubmit((values) => {
    if (needsPod && !values.podReceived) {
      setMissing("Confirm the POD was received to approve it.");
      return;
    }
    if (flags.length > 0 && !values.acknowledgeReview) {
      setMissing("Confirm you've checked the flags to approve it.");
      return;
    }
    approve.mutate(values);
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Approve for Payment"
      confirmText="Approve"
      isConfirming={approve.isPending}
      onConfirm={submit}
    >
      <InvoiceSummary invoice={invoice} />
      {invoice.status === CarrierInvoiceStatus.OnHold && (
        <div className="text-sm space-y-1">
          <p>
            <strong>On hold:</strong> {invoice.holdReason ?? "The bill differs from what was expected."}
          </p>
          <p>
            Expected{" "}
            <Money amount={invoice.expectedTotal} currency={invoice.currency} />
            {invoice.varianceAmount !== null && (
              <>
                , difference{" "}
                <Money amount={invoice.varianceAmount} currency={invoice.currency} />
              </>
            )}
            . Approving accepts the difference.
          </p>
        </div>
      )}
      {needsPod && (
        <BaseSwitch name="podReceived" control={control}>
          The proof of delivery was received. (
          {billingTriggerLabels[invoice.billingTrigger]}; recorded in the audit
          log.)
        </BaseSwitch>
      )}
      {flags.length > 0 && (
        <>
          <p className="text-sm font-semibold">This invoice is flagged:</p>
          <ReviewFlagList flags={flags} />
          <BaseSwitch name="acknowledgeReview" control={control}>
            I&apos;ve checked these. (Recorded in the audit log.)
          </BaseSwitch>
        </>
      )}
      {missing && <p className="text-xs text-base-danger">{missing}</p>}
    </FormModal>
  );
}
