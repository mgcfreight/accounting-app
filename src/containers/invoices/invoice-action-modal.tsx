import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { Control, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  BaseInput,
  BaseSwitch,
  BaseTextArea,
  DetailRow,
  FormModal,
  Money,
} from "@/components/common";
import { useCan } from "@/components/providers/user-provider";
import {
  BASE_PRICE_PATTERN,
  billingTriggerLabels,
  FX_RATE_PATTERN,
  reviewFlagLabels,
  TMS_INVOICE_CODE_PATTERN,
} from "@/lib/constants";
import {
  BillingTrigger,
  CarrierInvoiceStatus,
  Currency,
  InvoiceDirection,
  InvoiceKind,
  InvoiceReviewFlag,
  Permission,
} from "@/lib/enums";
import { CarrierInvoiceView, ReferenceNumbers } from "@/lib/interfaces";
import { commissionPercent, compareMoney, sumMoney, toAmount } from "@/lib/money";
import {
  ApiError,
  approveCarrierInvoice,
  errorMessage,
  InvoiceChanges,
  issueCustomerInvoice,
  listCarrierInvoices,
  receiveCarrierInvoice,
  refreshMoneyViews,
  reviseCarrierInvoice,
  reviseCustomerInvoice,
  updateCarrierInvoice,
  updateCustomerInvoice,
} from "@/services";
import ChargeLines, {
  ChargeValues,
  amountChargesFrom,
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
  onRevised?: (newInvoiceId: string) => void;
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
    // A new version replaces every charge, so it starts from the current
    // ones: only an invoice read with its lines (the invoice page) offers it.
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

// Saves through `action`, then refetches invoices and their History card
// (audit events), and closes.
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
      // Issuing, revising or approving moves balances and Needs Review too.
      refreshMoneyViews(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
      onClose();
      onDone?.(result);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      if (error instanceof ApiError && error.status === 409) {
        refreshMoneyViews(queryClient);
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
  // A carrier invoice needs its BOL number; the other references are
  // optional. Checked here only: the API doesn't require it.
  const isRequiredReference = (key: keyof ReferenceNumbers) =>
    !isCustomerInvoice(invoice) && key === "bolNumber";

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
        Amounts never change here. Clear a reference number to remove it
        {isCustomerInvoice(invoice) ? "" : " (the BOL number is required)"}.
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
            isRequired={isRequiredReference(key)}
            placeholder={isRequiredReference(key) ? undefined : "Optional"}
            rules={{
              validate: (value: string) =>
                !isRequiredReference(key) ||
                value.trim() !== "" ||
                `Enter the ${referenceLabels[key]} number`,
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
// whose bill changed. The form starts from the current charges; the whole
// set is sent, and the API works out amounts and tax again.
function ReviseInvoiceModal({
  invoice,
  partyName,
  onClose,
  onRevised,
}: ModalProps & { onRevised?: (newInvoiceId: string) => void }) {
  const isCustomer = isCustomerInvoice(invoice);
  const { control, handleSubmit } = useForm<ReviseValues>({
    defaultValues: {
      lines: amountChargesFrom(invoice.lines ?? []),
      reason: "",
      notes: invoice.notes ?? "",
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
        // Left out to keep the notes as they are.
        ...(notes !== (invoice.notes ?? "") && { notes }),
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
    (revised) => onRevised?.(revised.id)
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
      size="3xl"
      className="xl:max-w-4xl 2xl:max-w-5xl"
    >
      <RevisionSummary invoice={invoice} partyName={partyName} />
      <WhatHappens invoice={invoice} />

      <Step number={1} title="Charges" hint="Change, add or remove the charges. Every amount is before tax.">
        <ChargeLines
          control={control}
          name="lines"
          priceLabel={`Amount (${invoice.currency})`}
          showQuantity={false}
          layout="table"
          footer={<NewSubtotal invoice={invoice} control={control} />}
        />
      </Step>

      {isCustomer ? (
        <Step number={2} title="Commission" hint="A check on the margin. Shown only: nothing here is saved.">
          <CommissionSummary invoice={invoice} control={control} />
        </Step>
      ) : (
        <Step number={2} title="Carrier bill number">
          <BaseInput
            name="carrierInvoiceNumber"
            control={control}
            label="New carrier bill number"
            placeholder={invoice.carrierInvoiceNumber ?? ""}
            description="Only if the carrier sent a new bill. Leave blank to keep the current one."
            rules={{ maxLength: { value: 64, message: "At most 64 characters" } }}
          />
        </Step>
      )}

      <Step number={3} title="Why it changed">
        <div className="flex flex-col gap-3">
          <BaseTextArea
            name="reason"
            control={control}
            label="Reason for the change"
            placeholder="Detention at consignee, 2 hours"
            description="Required. Shown in the invoice's version history."
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
            placeholder="Optional"
            description={isCustomer ? "Printed on the invoice." : "Kept with the bill."}
            rules={{ maxLength: { value: 2000, message: "At most 2000 characters" } }}
          />
        </div>
      </Step>

      {flags.length > 0 && (
        <Step number={4} title="Check the flags">
          <div
            className={`flex flex-col gap-3 rounded-lg border p-4 ${
              missingAck ? "border-base-danger bg-danger-50" : "border-warning bg-warning-50"
            }`}
          >
            <p className="text-sm font-semibold text-[#343A40]">
              <span aria-hidden>⚠ </span>This invoice is flagged:
            </p>
            <ReviewFlagList flags={flags} />
            <BaseSwitch name="acknowledgeReview" control={control}>
              I&apos;ve checked these. (Recorded in the audit log.)
            </BaseSwitch>
            {missingAck && (
              <p role="alert" className="text-xs text-base-danger">
                Confirm you&apos;ve checked the flags to issue the new version.
              </p>
            )}
          </div>
        </Step>
      )}

      <p className="text-xs text-content-5">
        {isCustomer
          ? "The new version is issued but not emailed: send it from More › Email to shipper."
          : "The new version has to be approved again before it can be paid."}
      </p>
    </FormModal>
  );
}

// The invoice being replaced, as the API sent it: who it's for and its
// total, what's been paid and what's owed.
function RevisionSummary({ invoice, partyName }: { invoice: InvoiceView; partyName: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-content-10 bg-content-12 p-4">
      <p className="text-sm text-[#343A40]">
        <span className="font-semibold">
          {invoiceNumberOf(invoice) ? `#${invoiceNumberOf(invoice)}` : "No number yet"}
        </span>{" "}
        · {partyName}
      </p>
      <dl className="grid grid-cols-3 gap-4">
        {[
          { label: "Current total", value: <Money amount={invoice.total} currency={invoice.currency} /> },
          { label: "Paid", value: <Money amount={invoice.amountPaid} currency={invoice.currency} /> },
          { label: "Balance", value: <InvoiceBalance invoice={invoice} className="" /> },
        ].map((item) => (
          <div key={item.label} className="flex flex-col gap-0.5">
            <dt className="text-xs text-content-5">{item.label}</dt>
            <dd className="text-base font-semibold text-base-primary-900">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// What issuing a new version does, as a checklist rather than a paragraph.
function WhatHappens({ invoice }: { invoice: InvoiceView }) {
  const number = invoiceNumberOf(invoice);
  const points = [
    `${number ? `#${number}` : "This invoice"} is kept as it was and marked Replaced.`,
    "The new version gets the next letter on the number (230 → 230a).",
    "Same invoice date, due date and reference numbers.",
    "Tax is worked out again on the new charges.",
    "What was paid moves to the new version; its total can't be lower than that.",
  ];
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 md:grid-cols-2" aria-label="What happens">
      {points.map((point) => (
        <li key={point} className="flex gap-2 text-xs text-[#343A40]">
          <span aria-hidden className="text-base-success">
            ✓
          </span>
          {point}
        </li>
      ))}
    </ul>
  );
}

// A numbered section of the form.
function Step({
  number,
  title,
  hint,
  children,
}: {
  number: number;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-content-3 pt-4" aria-label={title}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-base-primary text-xs font-semibold text-white"
        >
          {number}
        </span>
        <div>
          <h3 className="text-sm font-semibold text-base-primary-900">{title}</h3>
          {hint && <p className="text-xs text-content-5">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

// The new charges added up, before tax, beside the current subtotal: a
// preview while typing. The API works out the tax and the total on save.
function NewSubtotal({
  invoice,
  control,
}: {
  invoice: InvoiceView;
  control: Control<ReviseValues>;
}) {
  const lines = useWatch({ control, name: "lines" });
  const amounts = lines.map((line) => toAmount(line.unitPrice.trim()));
  const subtotal = amounts.every((amount): amount is string => amount !== null)
    ? sumMoney(amounts)
    : null;
  const change =
    subtotal && !invoice.subtotal.startsWith("-")
      ? sumMoney([subtotal, `-${invoice.subtotal}`])
      : null;
  const direction = change ? compareMoney(change, "0.00") : 0;

  // The charges table's footer line: right-aligned under the amounts.
  return (
    <div className="flex flex-wrap items-baseline justify-end gap-x-4 gap-y-1 text-right">
      <span className="text-sm text-[#343A40]">
        New subtotal <span className="text-content-5">(before tax)</span>
      </span>
      {subtotal ? (
        <span className="flex flex-col items-end">
          <span className="text-base font-semibold tabular-nums text-base-primary-900">
            <Money amount={subtotal} currency={invoice.currency} />
          </span>
          {change && (
            <span
              className={`text-xs ${
                direction > 0 ? "text-base-success" : direction < 0 ? "text-base-danger" : "text-content-5"
              }`}
            >
              {direction === 0 ? (
                "no change"
              ) : (
                <>
                  {direction > 0 ? "+" : ""}
                  <Money amount={change} currency={invoice.currency} /> vs now
                </>
              )}
            </span>
          )}
        </span>
      ) : (
        <span className="text-xs text-content-5">Enter every amount, up to 2 decimals</span>
      )}
    </div>
  );
}

// mokal-app's commission, once for the whole new version: the base price
// (what the carrier charges, before tax), the customer rate (every charge
// above, added up) and the commission between them. Shown only: the charges
// are what's sent, and nothing here changes them or is saved.
function CommissionSummary({
  invoice,
  control,
}: {
  invoice: InvoiceView;
  control: Control<ReviseValues>;
}) {
  const { can } = useCan();
  const { currency, shipmentId } = invoice;
  const canRead = !!shipmentId && can(Permission.CarrierInvoicesView);
  // The shipment's one live standard carrier invoice (the API allows no
  // second); null when it has none yet.
  const carrierInvoice = useQuery({
    queryKey: ["invoices", InvoiceDirection.Payable, "for-shipment", shipmentId],
    queryFn: async ({ signal }) => {
      const page = await listCarrierInvoices(
        { page: 1, limit: 10, shipmentId: shipmentId! },
        signal
      );
      return (
        page.items.find(
          (item) =>
            item.kind === InvoiceKind.Standard &&
            item.status !== CarrierInvoiceStatus.Void
        ) ?? null
      );
    },
    enabled: canRead,
  });
  const carrier = carrierInvoice.data;
  // Before tax: the bill's subtotal, or the expected charges until it
  // arrives. Never across currencies: a USD cost isn't a CAD one.
  const carrierBase =
    carrier && carrier.currency === currency
      ? carrier.status === CarrierInvoiceStatus.Expected
        ? carrier.expectedTotal
        : carrier.subtotal
      : undefined;
  // Starts from the carrier invoice once it loads; a typed base is kept.
  const { control: baseControl } = useForm({
    values: { basePrice: carrierBase ?? "" },
    resetOptions: { keepDirtyValues: true },
  });
  const basePrice = useWatch({ control: baseControl, name: "basePrice" }).trim();
  const lines = useWatch({ control, name: "lines" });

  const amounts = lines.map((line) => toAmount(line.unitPrice.trim()));
  const customerRate = amounts.every((amount): amount is string => amount !== null)
    ? sumMoney(amounts)
    : null;
  const base = BASE_PRICE_PATTERN.test(basePrice) ? toAmount(basePrice) : null;
  const commission =
    customerRate && base ? sumMoney([customerRate, `-${base}`]) : null;
  const percent = customerRate && base ? commissionPercent(base, customerRate) : null;
  const belowBase = !!percent?.startsWith("-");

  const source = !canRead ? (
    "What the carrier charges, before tax."
  ) : carrierInvoice.isPending ? (
    "Loading the carrier invoice…"
  ) : carrierInvoice.isError ? (
    <span className="text-base-danger">
      Couldn&apos;t load the carrier invoice: enter it, or{" "}
      <button
        type="button"
        className="underline"
        onClick={() => void carrierInvoice.refetch()}
      >
        try again
      </button>
      .
    </span>
  ) : !carrier ? (
    "The shipment has no carrier invoice: enter what the carrier charges, before tax."
  ) : carrier.currency !== currency ? (
    `The carrier invoice is in ${carrier.currency}: enter the carrier's charges in ${currency}, before tax.`
  ) : carrier.status === CarrierInvoiceStatus.Expected ? (
    "The carrier invoice's expected charges, before tax (the bill hasn't arrived)."
  ) : (
    "The carrier invoice's subtotal, before tax."
  );

  return (
    <div className="flex flex-col gap-2">
      <BaseInput
        name="basePrice"
        control={baseControl}
        label={`Base price (${currency})`}
        placeholder="0.00"
        description={source}
        rules={{
          validate: (value: string) =>
            value.trim() === "" ||
            BASE_PRICE_PATTERN.test(value.trim()) ||
            "Above 0, up to 2 decimals",
        }}
      />
      <DetailRow
        label="Customer rate (the charges above)"
        value={
          customerRate ? (
            <Money amount={customerRate} currency={currency} />
          ) : (
            <span className="text-content-5">Enter every amount, up to 2 decimals</span>
          )
        }
      />
      <DetailRow
        label="Commission"
        value={
          commission && percent ? (
            <span className={belowBase ? "text-base-danger" : ""}>
              <Money amount={commission} currency={currency} /> ({percent}%)
            </span>
          ) : (
            <span className="text-content-5">—</span>
          )
        }
      />
      {belowBase && (
        <p className="text-xs text-base-danger">
          The charges are below the base price.
        </p>
      )}
    </div>
  );
}
