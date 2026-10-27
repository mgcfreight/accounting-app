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
  reviseCarrierInvoice,
  reviseCustomerInvoice,
  updateCarrierInvoice,
  updateCustomerInvoice,
} from "@/services";
import ChargeLines, {
  ChargeValues,
  emptyCharge,
  toCharges,
} from "./charge-lines";
import {
  InvoiceBalance,
  invoiceNumberOf,
  InvoiceView,
  isCustomerInvoice,
  referenceLabels,
} from "./invoice-view";

export type InvoiceAction = "edit" | "issue" | "receive" | "approve" | "revise";

type ModalProps<T extends InvoiceView = InvoiceView> = {
  invoice: T;
  // The customer's or carrier's name, for the summary line.
  partyName: string;
  onClose: () => void;
};

// The forms behind an invoice's actions, each sending the invoice's
// `version`. Each is mounted only while open, so its form starts from the
// invoice as last read. After a change — or a 409, meaning someone else
// changed it first — every invoice query is refetched. A new version opens
// in place of the one it replaced (`onRevised`).
export default function InvoiceActionModal({
  action,
  invoice,
  partyName,
  onClose,
  onRevised,
}: ModalProps & {
  action: InvoiceAction | null;
  onRevised?: (revised: InvoiceView) => void;
}) {
  const props = { partyName, onClose };
  switch (action) {
    case "edit":
      return <EditInvoiceModal invoice={invoice} {...props} />;
    case "issue":
      return <IssueInvoiceModal invoice={invoice} {...props} />;
    case "receive":
      return isCustomerInvoice(invoice) ? null : (
        <ReceiveBillModal invoice={invoice} {...props} />
      );
    case "approve":
      return isCustomerInvoice(invoice) ? null : (
        <ApproveInvoiceModal invoice={invoice} {...props} />
      );
    // A new version replaces every charge: only an invoice read with its
    // lines (the invoice page) offers it, so they can be checked first.
    case "revise":
      return invoice.lines ? (
        <ReviseInvoiceModal
          invoice={invoice}
          {...props}
          onRevised={onRevised}
        />
      ) : null;
    default:
      return null;
  }
}

// Saves through `action`, then refetches invoices and closes.
const useInvoiceMutation = <T, R = unknown>(
  action: (values: T) => Promise<R>,
  successMessage: string,
  onClose: () => void,
  onDone?: (result: R) => void
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: (result) => {
      toast.success(successMessage);
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      onClose();
      onDone?.(result);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      }
    },
  });
};

function InvoiceSummary({
  invoice,
  partyName,
}: {
  invoice: InvoiceView;
  partyName: string;
}) {
  return (
    <p className="text-sm text-[#707070]">
      {invoiceNumberOf(invoice) ?? "No number yet"} · {partyName} · balance{" "}
      <InvoiceBalance invoice={invoice} className="" />
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

function EditInvoiceModal({ invoice, partyName, onClose }: ModalProps) {
  const { control, handleSubmit } = useForm<EditValues>({
    defaultValues: editDefaults(invoice),
  });

  const save = useInvoiceMutation(
    (changes: Omit<InvoiceChanges, "version">): Promise<InvoiceView> => {
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
      <InvoiceSummary invoice={invoice} partyName={partyName} />
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

function IssueInvoiceModal({ invoice, partyName, onClose }: ModalProps) {
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
      <InvoiceSummary invoice={invoice} partyName={partyName} />
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
  partyName,
  onClose,
}: ModalProps<CarrierInvoiceView>) {
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
        {partyName} · expected{" "}
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
  partyName,
  onClose,
}: ModalProps<CarrierInvoiceView>) {
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
      <InvoiceSummary invoice={invoice} partyName={partyName} />
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

// --------------------------------------------------------------- revise

type ReviseValues = {
  lines: ChargeValues[];
  reason: string;
  notes: string;
  carrierInvoiceNumber: string;
  acknowledgeReview: boolean;
};

// A new version of an issued customer invoice, or of a carrier invoice
// whose bill changed. The form starts empty: every charge of the new
// version is entered, the whole set is sent, and the API works out amounts
// and tax again.
function ReviseInvoiceModal({
  invoice,
  partyName,
  onClose,
  onRevised,
}: ModalProps & { onRevised?: (revised: InvoiceView) => void }) {
  const isCustomer = isCustomerInvoice(invoice);
  const { control, handleSubmit } = useForm<ReviseValues>({
    defaultValues: {
      lines: [emptyCharge],
      reason: "",
      notes: "",
      carrierInvoiceNumber: "",
      acknowledgeReview: false,
    },
  });
  const [missingAck, setMissingAck] = useState(false);
  // The customer side checks the flags again, as when issuing.
  const flags = isCustomer ? invoice.reviewFlags : [];

  const revise = useInvoiceMutation(
    (values: ReviseValues): Promise<InvoiceView> => {
      const notes = values.notes.trim();
      const base = {
        version: invoice.version,
        reason: values.reason.trim(),
        lines: toCharges(values.lines),
        // Left blank to keep the notes as they are.
        ...(notes && notes !== (invoice.notes ?? "") && { notes }),
      };
      if (isCustomer) {
        return reviseCustomerInvoice(invoice.id, {
          ...base,
          ...(flags.length > 0 && { acknowledgeReview: values.acknowledgeReview }),
        });
      }
      const billNumber = values.carrierInvoiceNumber.trim();
      return reviseCarrierInvoice(invoice.id, {
        ...base,
        ...(billNumber && { carrierInvoiceNumber: billNumber }),
      });
    },
    "New version issued.",
    onClose,
    (revised) => onRevised?.(revised)
  );

  const submit = handleSubmit((values) => {
    if (flags.length > 0 && !values.acknowledgeReview) {
      setMissingAck(true);
      return;
    }
    revise.mutate(values);
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={isCustomer ? "Issue New Version" : "Enter Changed Carrier Bill"}
      confirmText={isCustomer ? "Issue New Version" : "Save New Version"}
      isConfirming={revise.isPending}
      onConfirm={submit}
      size="2xl"
    >
      <InvoiceSummary invoice={invoice} partyName={partyName} />
      <p className="text-sm">
        {invoiceNumberOf(invoice) ?? "This invoice"} is kept exactly as it
        was and marked Replaced. The new version gets the next letter on the
        number (230 → 230a → 230b) and keeps the same invoice date, due date
        and reference numbers. Enter every charge of the new version: any
        charge left out is dropped. Tax is worked out again on the charges
        below.
        What was already paid moves to the new version; its total can&apos;t
        be lower than that.
      </p>
      <p className="text-xs text-content-5">
        {isCustomer
          ? "Emailing isn't built yet: the new version is issued but not sent."
          : "The new version has to be approved again before it can be paid."}
      </p>
      <ChargeLines
        control={control}
        name="lines"
        priceLabel={`Unit price (${invoice.currency})`}
      />
      {!isCustomer && (
        <BaseInput
          name="carrierInvoiceNumber"
          control={control}
          label="New carrier bill number"
          placeholder={invoice.carrierInvoiceNumber ?? ""}
          description="Only if the carrier sent a new bill. Leave blank to keep the current one."
          rules={{ maxLength: { value: 64, message: "At most 64 characters" } }}
        />
      )}
      <BaseTextArea
        name="reason"
        control={control}
        label="Reason for the change"
        placeholder="Detention at consignee, 2 hours"
        description="Shown in the invoice's version history."
        rules={{
          validate: (value: unknown) => {
            const length = String(value ?? "").trim().length;
            return (length >= 3 && length <= 255) || "Enter 3-255 characters";
          },
        }}
      />
      <BaseTextArea
        name="notes"
        control={control}
        label="Notes"
        description="Leave blank to keep the current notes."
        rules={{ maxLength: { value: 2000, message: "At most 2000 characters" } }}
      />
      {flags.length > 0 && (
        <>
          <p className="text-sm font-semibold">This invoice is flagged:</p>
          <ReviewFlagList flags={flags} />
          <BaseSwitch name="acknowledgeReview" control={control}>
            I&apos;ve checked these. (Recorded in the audit log.)
          </BaseSwitch>
          {missingAck && (
            <p className="text-xs text-base-danger">
              Confirm you&apos;ve checked the flags to issue the new version.
            </p>
          )}
        </>
      )}
    </FormModal>
  );
}
