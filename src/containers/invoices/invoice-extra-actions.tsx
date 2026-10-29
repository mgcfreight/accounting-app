import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChangeEvent, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseInput,
  BaseSelect,
  BaseSwitch,
  BaseTextArea,
  FormModal,
  Money,
} from "@/components/common";
import { RowAction } from "@/components/common/row-actions";
import { EMAIL_SHAPE } from "@/lib/constants";
import {
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  DocumentKind,
  InvoiceKind,
  Permission,
} from "@/lib/enums";
import { compareMoney, isZeroMoney } from "@/lib/money";
import {
  ApiError,
  emailCustomerInvoice,
  errorMessage,
  openDispute,
  UPLOADABLE_KINDS,
  uploadInvoiceDocument,
  UploadableKind,
  voidCarrierInvoice,
  voidCustomerInvoice,
  writeOffInvoice,
} from "@/services";
import {
  directionOf,
  invoiceNumberOf,
  InvoiceView,
  isCustomerInvoice,
  isOwed,
} from "./invoice-view";

// The invoice's "More" actions, each through the API: emailing it to the
// shipper, its PDF, voiding it for a cancelled load, flagging a dispute,
// writing a balance off and attaching a document.

export type ExtraAction = "email" | "void" | "dispute" | "upload" | "write-off";

const AMOUNT = /^\d{1,9}\.\d{2}$/;

const VOIDABLE_CARRIER_STATUSES = [
  CarrierInvoiceStatus.Expected,
  CarrierInvoiceStatus.Received,
  CarrierInvoiceStatus.OnHold,
  CarrierInvoiceStatus.Approved,
];

// Voiding is for an invoice nothing has been paid on: a payment would have
// to be refunded or moved first.
export const canBeVoided = (invoice: InvoiceView) =>
  isZeroMoney(invoice.amountPaid) &&
  (isCustomerInvoice(invoice)
    ? invoice.status === CustomerInvoiceStatus.Draft ||
      invoice.status === CustomerInvoiceStatus.Issued
    : VOIDABLE_CARRIER_STATUSES.includes(invoice.status));

const isClosed = (invoice: InvoiceView) =>
  invoice.status === CustomerInvoiceStatus.Void ||
  invoice.status === CustomerInvoiceStatus.Superseded ||
  invoice.status === CarrierInvoiceStatus.Void ||
  invoice.status === CarrierInvoiceStatus.Superseded;

// An issued shipper invoice still owing, not a credit note and not under
// an open dispute (a disputed amount is written off by resolving it).
export const canBeWrittenOff = (invoice: InvoiceView) =>
  isCustomerInvoice(invoice) &&
  isOwed(invoice) &&
  invoice.kind !== InvoiceKind.CreditNote &&
  !invoice.disputed;

// The "More" menu of an invoice: what its status allows and the role may
// do. "Download PDF" acts at once (`onPdf`); the rest open a form
// (`onOpen`).
export const extraActionsFor = (
  invoice: InvoiceView,
  can: (permission: Permission) => boolean,
  onOpen: (action: ExtraAction) => void,
  onPdf: () => void
): RowAction[] => {
  const isCustomer = isCustomerInvoice(invoice);
  const canEdit = can(
    isCustomer ? Permission.CustomerInvoicesEdit : Permission.CarrierInvoicesEdit
  );
  // A draft or an awaited carrier bill has nothing to print yet.
  const printable = isCustomer
    ? invoice.status !== CustomerInvoiceStatus.Draft
    : invoice.status !== CarrierInvoiceStatus.Expected;
  const actions: RowAction[] = [];

  if (
    isCustomer &&
    invoice.status === CustomerInvoiceStatus.Issued &&
    can(Permission.CustomerInvoicesSendEmail)
  ) {
    actions.push({ key: "email", label: "Email to shipper", onPress: () => onOpen("email") });
  }
  if (
    printable &&
    can(
      isCustomer
        ? Permission.CustomerInvoicesExportPdf
        : Permission.CarrierInvoicesExportPdf
    )
  ) {
    actions.push({ key: "pdf", label: "Download PDF", onPress: onPdf });
  }
  if (canEdit && isOwed(invoice) && !invoice.disputed) {
    actions.push({ key: "dispute", label: "Flag as disputed", onPress: () => onOpen("dispute") });
  }
  if (canEdit && !isClosed(invoice)) {
    actions.push({ key: "upload", label: "Upload document", onPress: () => onOpen("upload") });
  }
  if (canBeWrittenOff(invoice) && can(Permission.CustomerInvoicesWriteOff)) {
    actions.push({
      key: "write-off",
      label: "Write off as bad debt",
      danger: true,
      onPress: () => onOpen("write-off"),
    });
  }
  if (
    canBeVoided(invoice) &&
    can(isCustomer ? Permission.CustomerInvoicesVoid : Permission.CarrierInvoicesVoid)
  ) {
    actions.push({
      key: "void",
      label: "Void (load cancelled)",
      danger: true,
      onPress: () => onOpen("void"),
    });
  }
  return actions;
};

type ModalProps = {
  invoice: InvoiceView;
  partyName: string;
  onClose: () => void;
};

// Each form is mounted only while open, so it starts from the invoice as
// last read.
export default function InvoiceExtraActionModal({
  action,
  ...props
}: ModalProps & { action: ExtraAction | null }) {
  switch (action) {
    case "email":
      return <EmailInvoiceModal {...props} />;
    case "void":
      return <VoidInvoiceModal {...props} />;
    case "dispute":
      return <DisputeInvoiceModal {...props} />;
    case "upload":
      return <UploadDocumentModal {...props} />;
    case "write-off":
      return <WriteOffModal {...props} />;
    default:
      return null;
  }
}

function Summary({ invoice, partyName }: Omit<ModalProps, "onClose">) {
  return (
    <p className="text-sm text-[#707070]">
      {invoiceNumberOf(invoice) ?? "No number yet"} · {partyName} · total{" "}
      <Money amount={invoice.total} currency={invoice.currency} />
    </p>
  );
}

// Saves through `action`, refetches what it changed and closes. On a 409
// (someone changed the invoice first) it refetches too, so the page shows
// what is true now.
const useActionMutation = <T, R>(
  action: (values: T) => Promise<R>,
  onDone: (result: R) => void,
  onClose: () => void,
  refetch: string[][] = [["invoices"]]
) => {
  const queryClient = useQueryClient();
  const refresh = () =>
    refetch.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }));
  return useMutation({
    mutationFn: action,
    onSuccess: (result) => {
      onDone(result);
      refresh();
      onClose();
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      if (error instanceof ApiError && error.status === 409) refresh();
    },
  });
};

// ---------------------------------------------------------------- email

type EmailValues = {
  to: string;
  cc: string;
  subject: string;
  message: string;
  attachPdf: boolean;
  attachDocuments: boolean;
};

const addresses = (value: string) =>
  value
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

// The form also holds switches, so a rule's value is typed string | boolean.
const emailList = (value: string | boolean) => {
  const list = addresses(String(value));
  if (list.length === 0) return true;
  if (list.length > 10) return "At most 10 addresses";
  return (
    list.every((address) => EMAIL_SHAPE.test(address)) ||
    "Enter email addresses separated by commas"
  );
};

function EmailInvoiceModal({ invoice, partyName, onClose }: ModalProps) {
  const number = invoiceNumberOf(invoice) ?? "";
  const { control, handleSubmit } = useForm<EmailValues>({
    defaultValues: {
      to: "",
      cc: "",
      subject: "",
      message: `Please find attached invoice ${number}.`,
      attachPdf: true,
      attachDocuments: true,
    },
  });

  const send = useActionMutation(
    (values: EmailValues) => {
      const to = addresses(values.to);
      const cc = addresses(values.cc);
      return emailCustomerInvoice(invoice.id, {
        ...(to.length > 0 && { to }),
        ...(cc.length > 0 && { cc }),
        ...(values.subject.trim() && { subject: values.subject.trim() }),
        message: values.message.trim(),
        attachPdf: values.attachPdf,
        attachDocuments: values.attachDocuments,
      });
    },
    (sent) => toast.success(`${number || "The invoice"} emailed to ${sent.to.join(", ")}.`),
    onClose,
    [["invoices"], ["audit"]]
  );

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Email Invoice"
      confirmText="Send"
      onConfirm={handleSubmit((values) => send.mutate(values))}
      isConfirming={send.isPending}
      size="2xl"
    >
      <Summary invoice={invoice} partyName={partyName} />
      <BaseInput
        name="to"
        control={control}
        label="To"
        placeholder="The shipper's invoice contacts"
        description="Leave blank to send to the shipper's contacts that receive invoices. Separate several addresses with commas."
        rules={{ validate: emailList }}
      />
      <BaseInput
        name="cc"
        control={control}
        label="CC"
        placeholder="Optional"
        rules={{ validate: emailList }}
      />
      <BaseInput
        name="subject"
        control={control}
        label="Subject"
        placeholder={`Invoice ${number} from MGC Freight`}
        rules={{ maxLength: { value: 200, message: "At most 200 characters" } }}
      />
      <BaseTextArea
        name="message"
        control={control}
        label="Message"
        rules={{ maxLength: { value: 2000, message: "At most 2000 characters" } }}
      />
      <div className="flex flex-col gap-2">
        <BaseSwitch name="attachPdf" control={control}>
          Attach the invoice PDF
        </BaseSwitch>
        <BaseSwitch name="attachDocuments" control={control}>
          Attach the BOL and POD
        </BaseSwitch>
      </div>
    </FormModal>
  );
}

// ----------------------------------------------------------------- void

type VoidValues = { reason: string; keepFee: boolean; fee: string };

function VoidInvoiceModal({ invoice, partyName, onClose }: ModalProps) {
  const { control, handleSubmit } = useForm<VoidValues>({
    defaultValues: { reason: "", keepFee: false, fee: "" },
  });
  const keepFee = useWatch({ control, name: "keepFee" });
  // Only an original invoice can carry a fee, not an adjustment or credit.
  const feeAllowed = invoice.kind === InvoiceKind.Standard;

  const doVoid = useActionMutation(
    (values: VoidValues): Promise<InvoiceView> => {
      const body = {
        version: invoice.version,
        reason: values.reason.trim(),
        ...(feeAllowed && values.keepFee && { cancellationFee: values.fee.trim() }),
      };
      return isCustomerInvoice(invoice)
        ? voidCustomerInvoice(invoice.id, body)
        : voidCarrierInvoice(invoice.id, body);
    },
    () =>
      toast.success(
        `${invoiceNumberOf(invoice) ?? "The invoice"} is void${
          keepFee && feeAllowed ? "; the cancellation fee is on a new draft invoice" : ""
        }.`
      ),
    onClose,
    [["invoices"], ["accounts"], ["reminders"]]
  );

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Void Invoice"
      confirmText="Void Invoice"
      onConfirm={handleSubmit((values) => doVoid.mutate(values))}
      isConfirming={doVoid.isPending}
      size="xl"
    >
      <Summary invoice={invoice} partyName={partyName} />
      <p className="text-xs text-content-5">
        For a cancelled load. The invoice is kept, marked void, and owes
        nothing. A cancellation fee is billed on a new draft invoice with the
        next letter on the number.
      </p>
      <BaseTextArea
        name="reason"
        control={control}
        label="Reason"
        placeholder="Load cancelled by the shipper on …"
        rules={{
          validate: (value: string | boolean) => {
            const length = String(value).trim().length;
            if (length < 3) return "Say why the invoice is void (at least 3 characters)";
            return length <= 255 || "At most 255 characters";
          },
        }}
      />
      {feeAllowed && (
        <BaseSwitch name="keepFee" control={control}>
          Keep a cancellation fee
        </BaseSwitch>
      )}
      {feeAllowed && keepFee && (
        <BaseInput
          name="fee"
          control={control}
          label={`Cancellation fee (${invoice.currency}, before tax)`}
          placeholder="0.00"
          rules={{
            validate: (value: string | boolean) =>
              !AMOUNT.test(String(value).trim())
                ? "Enter the fee with cents, e.g. 150.00"
                : isZeroMoney(String(value).trim())
                  ? "Turn the fee off instead of entering 0.00"
                  : true,
          }}
        />
      )}
    </FormModal>
  );
}

// -------------------------------------------------------------- dispute

type DisputeValues = { reason: string; amount: string };

function DisputeInvoiceModal({ invoice, partyName, onClose }: ModalProps) {
  const { control, handleSubmit } = useForm<DisputeValues>({
    defaultValues: { reason: "", amount: invoice.balanceDue },
  });

  const flag = useActionMutation(
    (values: DisputeValues) =>
      openDispute(directionOf(invoice), {
        invoiceId: invoice.id,
        amount: values.amount.trim(),
        reason: values.reason.trim(),
      }),
    () => toast.success(`${invoiceNumberOf(invoice) ?? "The invoice"} is flagged as disputed.`),
    onClose,
    [["invoices"], ["disputes"], ["accounts"]]
  );

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Flag as Disputed"
      confirmText="Flag as Disputed"
      onConfirm={handleSubmit((values) => flag.mutate(values))}
      isConfirming={flag.isPending}
      size="xl"
    >
      <Summary invoice={invoice} partyName={partyName} />
      <p className="text-xs text-content-5">
        While disputed, the amount shows in the aging report&apos;s Disputed
        column and payment reminders for this invoice pause.
      </p>
      <BaseTextArea
        name="reason"
        control={control}
        label="What is disputed"
        placeholder="Shipper says the liftgate was not used"
        rules={{
          validate: (value: string) => {
            const length = value.trim().length;
            if (length < 3) return "Say what is disputed (at least 3 characters)";
            return length <= 500 || "At most 500 characters";
          },
        }}
      />
      <BaseInput
        name="amount"
        control={control}
        label={`Disputed amount (${invoice.currency})`}
        description={
          <>
            Up to the balance,{" "}
            <Money amount={invoice.balanceDue} currency={invoice.currency} />.
          </>
        }
        rules={{
          validate: (value: string) => {
            const amount = value.trim();
            if (!AMOUNT.test(amount)) return "Enter the amount with cents, e.g. 250.00";
            if (isZeroMoney(amount)) return "Enter an amount above 0.00";
            return (
              compareMoney(amount, invoice.balanceDue) <= 0 ||
              "No more than the balance"
            );
          },
        }}
      />
    </FormModal>
  );
}

// ------------------------------------------------------------ write-off

type WriteOffValues = { amount: string; reason: string };

function WriteOffModal({ invoice, partyName, onClose }: ModalProps) {
  const { control, handleSubmit } = useForm<WriteOffValues>({
    defaultValues: { amount: invoice.balanceDue, reason: "" },
  });

  const writeOff = useActionMutation(
    (values: WriteOffValues) => {
      const amount = values.amount.trim();
      return writeOffInvoice(invoice.id, {
        version: invoice.version,
        reason: values.reason.trim(),
        // The whole balance is the default; send a part only.
        ...(compareMoney(amount, invoice.balanceDue) !== 0 && { amount }),
      });
    },
    (done) =>
      toast.success(
        `Wrote off ${done.currency} ${done.amount} of ${invoiceNumberOf(invoice) ?? "the invoice"}.`
      ),
    onClose,
    [["invoices"], ["write-offs"], ["accounts"], ["report"], ["reminders"]]
  );

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Write Off as Bad Debt"
      confirmText="Write Off"
      onConfirm={handleSubmit((values) => writeOff.mutate(values))}
      isConfirming={writeOff.isPending}
      size="xl"
    >
      <Summary invoice={invoice} partyName={partyName} />
      <p className="text-xs text-content-5">
        The amount stops being owed. Its GST/HST share is claimed back as
        bad-debt relief; the rest is a bad-debt expense in the reports. A
        write-off can be reversed if the shipper pays after all.
      </p>
      <BaseInput
        name="amount"
        control={control}
        label={`Amount to write off (${invoice.currency}, tax included)`}
        description={
          <>
            Up to the balance,{" "}
            <Money amount={invoice.balanceDue} currency={invoice.currency} />.
          </>
        }
        rules={{
          validate: (value: string) => {
            const amount = value.trim();
            if (!AMOUNT.test(amount)) return "Enter the amount with cents, e.g. 250.00";
            if (isZeroMoney(amount)) return "Enter an amount above 0.00";
            return (
              compareMoney(amount, invoice.balanceDue) <= 0 ||
              "No more than the balance"
            );
          },
        }}
      />
      <BaseTextArea
        name="reason"
        control={control}
        label="Why it won't be paid"
        placeholder="Shipper went bankrupt; trustee confirmed no dividend"
        rules={{
          validate: (value: string) => {
            const length = value.trim().length;
            if (length < 3) return "Say why (at least 3 characters)";
            return length <= 500 || "At most 500 characters";
          },
        }}
      />
    </FormModal>
  );
}

// --------------------------------------------------------------- upload

type UploadValues = { kind: UploadableKind };

export const documentKindLabels: Record<DocumentKind, string> = {
  [DocumentKind.Pod]: "Proof of delivery (POD)",
  [DocumentKind.Bol]: "Bill of lading (BOL)",
  [DocumentKind.RateConfirmation]: "Rate confirmation",
  [DocumentKind.CarrierInvoice]: "Carrier's bill",
  [DocumentKind.InvoicePdf]: "Invoice PDF",
  [DocumentKind.StatementPdf]: "Statement PDF",
  [DocumentKind.CsvReport]: "CSV report",
  [DocumentKind.ZipBundle]: "ZIP bundle",
  [DocumentKind.Other]: "Other",
};

const documentKinds = UPLOADABLE_KINDS.map((kind) => ({
  key: kind,
  label: documentKindLabels[kind],
  value: kind,
}));

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const ACCEPTED_EXTENSIONS = /\.(pdf|png|jpe?g)$/i;
const MAX_BYTES = 10 * 1024 * 1024;

// Checked by type and extension both: either alone is easy to get wrong.
// The API checks the content again.
const fileProblem = (file: File | null) => {
  if (!file) return "Choose a file";
  if (!ACCEPTED_TYPES.includes(file.type) || !ACCEPTED_EXTENSIONS.test(file.name)) {
    return "A PDF, PNG or JPEG file";
  }
  if (file.size > MAX_BYTES) return "At most 10 MB";
  return null;
};

function UploadDocumentModal({ invoice, partyName, onClose }: ModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit } = useForm<UploadValues>({
    defaultValues: {
      kind: isCustomerInvoice(invoice) ? DocumentKind.Pod : DocumentKind.CarrierInvoice,
    },
  });

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    setFile(chosen);
    setError(chosen ? fileProblem(chosen) : null);
  };

  const upload = useActionMutation(
    ({ kind, chosen }: { kind: UploadableKind; chosen: File }) =>
      uploadInvoiceDocument(directionOf(invoice), invoice.id, kind, chosen),
    (document) => toast.success(`${document.fileName} uploaded.`),
    onClose,
    [["invoice-documents", invoice.id]]
  );

  const submit = handleSubmit((values) => {
    const problem = fileProblem(file);
    setError(problem);
    if (problem || !file) return;
    upload.mutate({ kind: values.kind, chosen: file });
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Upload Document"
      confirmText="Upload"
      onConfirm={submit}
      isConfirming={upload.isPending}
      size="xl"
    >
      <Summary invoice={invoice} partyName={partyName} />
      <p className="text-xs text-content-5">
        Documents from the TMS already show in the Documents card. Add one the
        TMS doesn&apos;t have, such as a signed POD.
      </p>
      <BaseSelect
        name="kind"
        control={control}
        label="Document"
        options={documentKinds}
        disallowEmptySelection
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="invoice-document" className="text-xs text-base-primary">
          File (PDF, PNG or JPEG, up to 10 MB)
        </label>
        <input
          id="invoice-document"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          onChange={choose}
          className="text-sm"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </FormModal>
  );
}

// Shown on an invoice the TMS cancelled: points to voiding it.
export function CancelledLoadBanner({
  canVoid,
  onVoid,
}: {
  canVoid: boolean;
  onVoid: () => void;
}) {
  return (
    <AlertBanner
      message="MGC Freight cancelled this load. Void the invoice, keeping a cancellation fee if one applies."
      action={
        canVoid ? (
          <button type="button" className="underline text-sm" onClick={onVoid}>
            Void invoice
          </button>
        ) : undefined
      }
    />
  );
}
