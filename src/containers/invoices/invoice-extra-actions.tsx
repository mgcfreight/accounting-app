import { useQuery } from "@tanstack/react-query";
import { ChangeEvent, useEffect, useState } from "react";
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
import { useCan } from "@/components/providers/user-provider";
import { EMAIL_SHAPE } from "@/lib/constants";
import {
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  Permission,
} from "@/lib/enums";
import { compareMoney, isZeroMoney } from "@/lib/money";
import { getParty } from "@/services";
import {
  invoiceNumberOf,
  InvoiceView,
  isCustomerInvoice,
  isOwed,
} from "./invoice-view";

// Invoice actions the Accounts API has no endpoint for yet: emailing the
// invoice, its PDF, voiding it for a cancelled load, flagging a dispute and
// attaching a document. Each form is checked as the real one will be, then
// says it's a demo: nothing is saved, sent or uploaded.

export type ExtraAction = "email" | "void" | "dispute" | "upload";

const AMOUNT = /^\d{1,9}\.\d{2}$/;

const demo = (what: string, nothing = "saved") =>
  toast.info(`${what} — demo only, nothing was ${nothing}.`);

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

// The "More" menu of an invoice: what its status allows and the role may
// do. "Download PDF" acts at once; the rest open a form (`onOpen`).
export const extraActionsFor = (
  invoice: InvoiceView,
  can: (permission: Permission) => boolean,
  onOpen: (action: ExtraAction) => void
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
    actions.push({
      key: "pdf",
      label: "Download PDF",
      onPress: () => demo(`PDF of ${invoiceNumberOf(invoice) ?? "this invoice"}`, "generated"),
    });
  }
  if (canEdit && isOwed(invoice)) {
    actions.push({ key: "dispute", label: "Flag as disputed", onPress: () => onOpen("dispute") });
  }
  if (canEdit && !isClosed(invoice)) {
    actions.push({ key: "upload", label: "Upload document", onPress: () => onOpen("upload") });
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
const emailList = (required: boolean) => (value: string | boolean) => {
  const list = addresses(String(value));
  if (list.length === 0) return required ? "Enter at least one address" : true;
  return (
    list.every((address) => EMAIL_SHAPE.test(address)) ||
    "Enter email addresses separated by commas"
  );
};

function EmailInvoiceModal({ invoice, partyName, onClose }: ModalProps) {
  const number = invoiceNumberOf(invoice) ?? "";
  const { can } = useCan();
  // The customer's accounts address as the TMS holds it, for those who may
  // read parties. The party page reads the same query, so it is often
  // cached already.
  const customerId =
    isCustomerInvoice(invoice) && can(Permission.PartiesView)
      ? invoice.customerId
      : null;
  const party = useQuery({
    queryKey: ["parties", "detail", customerId],
    queryFn: ({ signal }) => getParty(customerId!, signal),
    enabled: !!customerId,
  });
  const { control, handleSubmit, getValues, setValue } = useForm<EmailValues>({
    defaultValues: {
      to: "",
      cc: "",
      subject: `Invoice ${number} from MGC Freight`,
      message: `Please find attached invoice ${number}.`,
      attachPdf: true,
      attachDocuments: true,
    },
  });

  // Fills "To" once the address arrives, unless something was typed first.
  const suggested = party.data?.businessEmail ?? party.data?.email ?? null;
  useEffect(() => {
    if (suggested && !getValues("to")) setValue("to", suggested);
  }, [suggested, getValues, setValue]);

  const submit = handleSubmit((values) => {
    demo(`Email of ${number} to ${addresses(values.to).join(", ")}`, "sent");
    onClose();
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Email Invoice"
      confirmText="Send"
      onConfirm={submit}
      size="2xl"
    >
      <Summary invoice={invoice} partyName={partyName} />
      <p className="text-xs text-content-5">
        Goes to the shipper&apos;s accounts department. Sending isn&apos;t
        built yet: this checks the form only.
      </p>
      <BaseInput
        name="to"
        control={control}
        label="To"
        placeholder="ap@shipper.com"
        description={
          party.isPending && customerId
            ? "Looking up the shipper's email…"
            : "Separate several addresses with commas."
        }
        rules={{ validate: emailList(true) }}
      />
      <BaseInput
        name="cc"
        control={control}
        label="CC"
        placeholder="Optional"
        rules={{ validate: emailList(false) }}
      />
      <BaseInput
        name="subject"
        control={control}
        label="Subject"
        rules={{
          required: "Enter a subject",
          maxLength: { value: 200, message: "At most 200 characters" },
        }}
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

  const submit = handleSubmit(() => {
    demo(
      `Void of ${invoiceNumberOf(invoice) ?? "this invoice"}${
        keepFee ? " with a cancellation fee" : ""
      }`
    );
    onClose();
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Void Invoice"
      confirmText="Void Invoice"
      onConfirm={submit}
      size="xl"
    >
      <Summary invoice={invoice} partyName={partyName} />
      <p className="text-xs text-content-5">
        For a cancelled load. The invoice is kept, marked void, and owes
        nothing. A cancellation fee is billed on a new invoice of its own.
      </p>
      <BaseTextArea
        name="reason"
        control={control}
        label="Reason"
        placeholder="Load cancelled by the shipper on …"
        rules={{
          required: "Say why the invoice is void",
          maxLength: { value: 255, message: "At most 255 characters" },
        }}
      />
      <BaseSwitch name="keepFee" control={control}>
        Keep a cancellation fee
      </BaseSwitch>
      {keepFee && (
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

  const submit = handleSubmit(() => {
    demo(`Dispute on ${invoiceNumberOf(invoice) ?? "this invoice"}`);
    onClose();
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Flag as Disputed"
      confirmText="Flag as Disputed"
      onConfirm={submit}
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
          required: "Say what is disputed",
          maxLength: { value: 500, message: "At most 500 characters" },
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

// --------------------------------------------------------------- upload

type UploadValues = { kind: string; note: string };

const documentKinds = [
  { key: "POD", label: "Proof of delivery (POD)", value: "POD" },
  { key: "BOL", label: "Bill of lading (BOL)", value: "BOL" },
  { key: "RATE_CONFIRMATION", label: "Rate confirmation", value: "RATE_CONFIRMATION" },
  { key: "OTHER", label: "Other", value: "OTHER" },
];

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const ACCEPTED_EXTENSIONS = /\.(pdf|png|jpe?g)$/i;
const MAX_BYTES = 10 * 1024 * 1024;

// Checked by type and extension both: either alone is easy to get wrong.
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
    defaultValues: { kind: "POD", note: "" },
  });

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    setFile(chosen);
    setError(chosen ? fileProblem(chosen) : null);
  };

  const submit = handleSubmit((values) => {
    const problem = fileProblem(file);
    setError(problem);
    if (problem) return;
    demo(`${values.kind.replace(/_/g, " ")} ${file!.name}`, "uploaded");
    onClose();
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Upload Document"
      confirmText="Upload"
      onConfirm={submit}
      size="xl"
    >
      <Summary invoice={invoice} partyName={partyName} />
      <p className="text-xs text-content-5">
        Documents from the TMS (BOL, labels, invoice PDFs) already show in the
        Documents card. Add one the TMS doesn&apos;t have, such as a signed POD.
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
      <BaseInput
        name="note"
        control={control}
        label="Note"
        placeholder="Optional"
        rules={{ maxLength: { value: 255, message: "At most 255 characters" } }}
      />
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
