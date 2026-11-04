import { CheckboxGroup } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseCardWrapper,
  BaseCheckbox,
  BaseInput,
  BaseSelect,
  BaseSwitch,
  BaseTextArea,
  FileDropZone,
  FormModal,
  formatFileSize,
  Money,
} from "@/components/common";
import { RowAction } from "@/components/common/row-actions";
import { DocumentUpload, Pdf, Send } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
import { EMAIL_SHAPE } from "@/lib/constants";
import {
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  Permission,
} from "@/lib/enums";
import { Attachment } from "@/lib/interfaces";
import { demoCarrierDocuments, demoShipperDocuments } from "@/lib/mock";
import { compareMoney, isZeroMoney } from "@/lib/money";
import { listContacts } from "@/services";
import {
  invoiceNumberOf,
  InvoiceView,
  isCustomerInvoice,
  isOwed,
} from "./invoice-view";

// Invoice actions the Accounts API has no endpoint for yet: emailing the
// invoice, voiding it for a cancelled load, flagging a dispute, attaching a
// document and emailing documents to the shipper or carrier. (Its PDF is printed here: invoice-pdf.ts.) Each form is checked as the real one will be, then
// confirms with a toast.

export type ExtraAction =
  | "email"
  | "email-documents"
  | "void"
  | "dispute"
  | "upload";

const AMOUNT = /^\d{1,9}\.\d{2}$/;

const notify = (what: string, done = "saved") => toast.success(`${what} ${done}.`);

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

// Who an invoice's documents go to.
const partyWord = (invoice: InvoiceView) =>
  isCustomerInvoice(invoice) ? "shipper" : "carrier";

const isClosed = (invoice: InvoiceView) =>
  invoice.status === CustomerInvoiceStatus.Void ||
  invoice.status === CustomerInvoiceStatus.Superseded ||
  invoice.status === CarrierInvoiceStatus.Void ||
  invoice.status === CarrierInvoiceStatus.Superseded;

// The extra actions of an invoice: what its status allows and the role may
// do. Each opens a form (`onOpen`). The detail page shows "email" as a
// button of its own and the rest in its "More" menu.
export const extraActionsFor = (
  invoice: InvoiceView,
  can: (permission: Permission) => boolean,
  onOpen: (action: ExtraAction) => void
): RowAction[] => {
  const isCustomer = isCustomerInvoice(invoice);
  const canEdit = can(
    isCustomer ? Permission.CustomerInvoicesEdit : Permission.CarrierInvoicesEdit
  );
  const actions: RowAction[] = [];

  if (
    isCustomer &&
    invoice.status === CustomerInvoiceStatus.Issued &&
    can(Permission.CustomerInvoicesSendEmail)
  ) {
    actions.push({ key: "email", label: "Email to shipper", onPress: () => onOpen("email") });
  }
  if (canEdit && isOwed(invoice)) {
    actions.push({ key: "dispute", label: "Flag as disputed", onPress: () => onOpen("dispute") });
  }
  if (canEdit && !isClosed(invoice)) {
    actions.push({ key: "upload", label: "Upload document", onPress: () => onOpen("upload") });
  }
  // Emailing a shipper goes with sending its invoices. There is no
  // permission of its own for emailing a carrier yet: it goes with editing
  // the carrier invoice.
  const canEmailDocuments = isCustomer
    ? can(Permission.CustomerInvoicesSendEmail)
    : canEdit;
  if (canEmailDocuments && !isClosed(invoice)) {
    actions.push({
      key: "email-documents",
      label: `Email documents to ${partyWord(invoice)}`,
      onPress: () => onOpen("email-documents"),
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
    case "email-documents":
      return <EmailDocumentsModal {...props} />;
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

// Where an invoice's emails go: the party's active contacts that receive
// invoices, for those who may read parties. The party page reads the same
// query, so it is often cached already. `href` is the party's page, where
// contacts are added.
function useInvoiceRecipients(invoice: InvoiceView) {
  const { can } = useCan();
  const isCustomer = isCustomerInvoice(invoice);
  const partyId = isCustomer ? invoice.customerId : invoice.carrierId;
  const canRead = can(Permission.PartiesView) && !!partyId;
  const contacts = useQuery({
    queryKey: ["parties", "contacts", partyId],
    queryFn: ({ signal }) => listContacts(partyId!, signal),
    enabled: canRead,
  });
  const emails = (contacts.data ?? [])
    .filter((contact) => contact.isActive && contact.receivesInvoices)
    .map((contact) => contact.email);
  return {
    emails,
    isLoading: canRead && contacts.isPending,
    // Only once the list has loaded, so a slow or failed request doesn't
    // claim there are none.
    hasNone: canRead && contacts.isSuccess && emails.length === 0,
    isError: canRead && contacts.isError,
    href: partyId
      ? `${isCustomer ? "/shippers/" : "/carriers/"}view/?id=${encodeURIComponent(partyId)}`
      : null,
  };
}

// Fills "To" once the addresses arrive, unless something was typed first.
function usePrefillTo(
  emails: string[],
  getValues: () => string,
  setValue: (value: string) => void
) {
  const joined = emails.join(", ");
  useEffect(() => {
    if (joined && !getValues()) setValue(joined);
  }, [joined, getValues, setValue]);
}

// The line under "To": looking the address up, where it came from, or that
// the party has no contact for it yet.
function recipientHint(
  recipients: ReturnType<typeof useInvoiceRecipients>,
  who: string
) {
  if (recipients.isLoading) return `Looking up the ${who}'s contacts…`;
  if (recipients.isError) return `Couldn't load the ${who}'s contacts. Type the address instead.`;
  if (recipients.hasNone) {
    return (
      <>
        No {who} contact receives invoices yet.{" "}
        {recipients.href && (
          <Link to={recipients.href} className="text-base-primary underline">
            Add one on the {who}&apos;s page
          </Link>
        )}
      </>
    );
  }
  if (recipients.emails.length > 0) {
    return `From the ${who}'s contacts. Separate several addresses with commas.`;
  }
  return "Separate several addresses with commas.";
}

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
  const recipients = useInvoiceRecipients(invoice);
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
  usePrefillTo(
    recipients.emails,
    () => getValues("to"),
    (value) => setValue("to", value)
  );

  const submit = handleSubmit((values) => {
    notify(`Email of ${number} to ${addresses(values.to).join(", ")}`, "sent");
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
        description={recipientHint(recipients, "shipper")}
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

// ------------------------------------------------------- documents email

type DocumentsEmailValues = {
  to: string;
  subject: string;
  message: string;
};

// The documents on an invoice, sent to its shipper or carrier: each one
// ticked by default and left out by unticking it.
function EmailDocumentsModal({ invoice, partyName, onClose }: ModalProps) {
  const isCustomer = isCustomerInvoice(invoice);
  const who = partyWord(invoice);
  const documents = documentsOf(invoice);
  const [chosen, setChosen] = useState<string[]>(() =>
    documents.map((item) => item.id)
  );
  const [missing, setMissing] = useState<string | null>(null);
  const recipients = useInvoiceRecipients(invoice);
  const reference =
    (!isCustomer && invoice.carrierInvoiceNumber) ||
    invoiceNumberOf(invoice) ||
    (isCustomer ? "your shipment" : "your load");
  const { control, handleSubmit, getValues, setValue } =
    useForm<DocumentsEmailValues>({
      defaultValues: {
        to: "",
        subject: `Documents for ${reference} from MGC Freight`,
        message: `Please find attached the documents for ${reference}.`,
      },
    });
  usePrefillTo(
    recipients.emails,
    () => getValues("to"),
    (value) => setValue("to", value)
  );

  const submit = handleSubmit((values) => {
    if (documents.length === 0) {
      setMissing("There are no documents on this invoice to send.");
      return;
    }
    if (chosen.length === 0) {
      setMissing("Choose at least one document to send.");
      return;
    }
    notify(
      `Email of ${chosen.length} ${chosen.length === 1 ? "document" : "documents"} to ${addresses(values.to).join(", ")}`,
      "sent"
    );
    onClose();
  });

  const allChosen = chosen.length === documents.length;
  const choose = (value: string[]) => {
    setChosen(value);
    setMissing(null);
  };

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`Email Documents to ${isCustomer ? "Shipper" : "Carrier"}`}
      confirmText={
        chosen.length > 0
          ? `Send ${chosen.length} ${chosen.length === 1 ? "document" : "documents"}`
          : "Send"
      }
      onConfirm={submit}
      size="2xl"
    >
      <Summary invoice={invoice} partyName={partyName} />
      <BaseInput
        name="to"
        control={control}
        label="To"
        placeholder={isCustomer ? "ap@shipper.com" : "billing@carrier.com"}
        description={recipientHint(recipients, who)}
        rules={{ validate: emailList(true) }}
      />
      {documents.length === 0 ? (
        <p className="text-sm text-content-5">
          No documents on this invoice yet. Upload {isCustomer ? "a BOL or POD" : "a POD"} first.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-base-primary">
              Documents to send ({chosen.length} of {documents.length})
            </span>
            <button
              type="button"
              className="text-xs text-base-primary underline"
              onClick={() => choose(allChosen ? [] : documents.map((item) => item.id))}
            >
              {allChosen ? "Clear all" : "Select all"}
            </button>
          </div>
          <CheckboxGroup
            aria-label="Documents to send"
            size="sm"
            value={chosen}
            onValueChange={choose}
            orientation="horizontal"
            // Side by side, wrapping, as on the invoice's Documents card.
            classNames={{ wrapper: "flex-wrap gap-2" }}
          >
            {documents.map((item) => (
              <BaseCheckbox
                key={item.id}
                value={item.id}
                classNames={{
                  base: "m-0 min-w-0 max-w-full sm:max-w-xs rounded-medium border border-base-default p-3 data-[selected=true]:border-base-primary",
                  label: "min-w-0 w-full",
                }}
              >
                <DocumentLine document={item} />
              </BaseCheckbox>
            ))}
          </CheckboxGroup>
        </div>
      )}
      {missing && (
        <p role="alert" className="text-xs text-base-danger">
          {missing}
        </p>
      )}
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
    notify(
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
      confirmColor="danger"
      onConfirm={submit}
      size="xl"
    >
      <Summary invoice={invoice} partyName={partyName} />
      <p className="text-xs text-content-5">
        For a cancelled load. The invoice is kept, marked void, and owes
        nothing. A cancellation fee is billed on a new invoice of its own.
        Voiding isn&apos;t built yet: this checks the form only.
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
    notify(`Dispute on ${invoiceNumberOf(invoice) ?? "this invoice"}`);
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
        column and payment reminders for this invoice pause. Disputes
        aren&apos;t built yet: this checks the form only.
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

// A carrier invoice takes only a POD or another document.
const carrierDocumentKinds = documentKinds.filter(
  (kind) => kind.key === "POD" || kind.key === "OTHER"
);

const documentKindLabel = (kind: string) =>
  documentKinds.find((item) => item.key === kind)?.label ?? kind;

// The documents attached to an invoice. The API doesn't list them yet and
// Upload Document stores nothing, so sample ones stand in until it does.
const documentsOf = (invoice: InvoiceView) =>
  isCustomerInvoice(invoice) ? demoShipperDocuments : demoCarrierDocuments;

// A document's icon, name and kind, as one line of a list.
function DocumentLine({ document }: { document: Attachment }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      {/\.pdf$/i.test(document.fileName) ? (
        <Pdf className="h-8 w-8 shrink-0" aria-hidden />
      ) : (
        <DocumentUpload className="h-8 w-8 shrink-0" aria-hidden />
      )}
      <div className="min-w-0">
        <p className="truncate text-sm text-content-6" title={document.fileName}>
          {document.fileName}
        </p>
        <p className="text-xs text-content-5">{documentKindLabel(document.kind)}</p>
      </div>
    </div>
  );
}

// The documents on an invoice, with uploading and emailing them to the
// shipper or carrier for those allowed to.
export function DocumentsCard({
  invoice,
  onUpload,
  onEmail,
}: {
  invoice: InvoiceView;
  onUpload?: () => void;
  onEmail?: () => void;
}) {
  const isCustomer = isCustomerInvoice(invoice);
  const who = partyWord(invoice);
  const documents = documentsOf(invoice);
  return (
    <BaseCardWrapper
      heading={
        documents.length > 0
          ? `Supporting Documents (${documents.length})`
          : "Supporting Documents"
      }
    >
      <div className="flex flex-col gap-4">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <DocumentUpload className="h-8 w-8" aria-hidden />
            <p className="text-sm text-content-6">No documents yet</p>
            <p className="text-xs text-content-5">
              {isCustomer
                ? "Upload the signed BOL and POD to keep them with this invoice and send them to the shipper."
                : "Upload the signed POD to keep it with this bill and send it to the carrier."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {documents.map((item) => (
              <li key={item.id} className="min-w-0 max-w-full sm:max-w-xs">
                {/* Downloads the file under its own name, as the browser
                    saves any download; `download` works only on our own
                    origin, so only a same-origin path is linked. */}
                {item.url?.startsWith("/") && !item.url.startsWith("//") ? (
                  <a
                    href={item.url}
                    download={item.fileName}
                    aria-label={`Download ${item.fileName}`}
                    className="block rounded-medium border border-base-default p-3 transition-colors hover:border-base-primary hover:bg-content-12 focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    <DocumentLine document={item} />
                  </a>
                ) : (
                  <div className="rounded-medium border border-base-default p-3">
                    <DocumentLine document={item} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {(onUpload || onEmail) && (
          <div className="flex flex-wrap gap-2">
            {onEmail && documents.length > 0 && (
              <BaseButton
                text={`Email to ${who}`}
                startContent={<Send />}
                className="px-4"
                onPress={onEmail}
              />
            )}
            {onUpload && (
              <BaseButton
                text="Upload document"
                varient="bordered"
                className="text-base-primary px-4"
                onPress={onUpload}
              />
            )}
          </div>
        )}
      </div>
    </BaseCardWrapper>
  );
}

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const ACCEPTED_EXTENSIONS = /\.(pdf|png|jpe?g)$/i;
const MAX_BYTES = 10 * 1024 * 1024;

// Checked by type and extension both: either alone is easy to get wrong.
const fileProblem = (file: File | null) => {
  if (!file) return "Choose a file to upload";
  if (!ACCEPTED_TYPES.includes(file.type) || !ACCEPTED_EXTENSIONS.test(file.name)) {
    return `${file.name} isn't a PDF, PNG or JPEG file`;
  }
  if (file.size === 0) return `${file.name} is empty`;
  if (file.size > MAX_BYTES) {
    return `${file.name} is ${formatFileSize(file.size)}; the limit is 10 MB`;
  }
  return null;
};

function UploadDocumentModal({ invoice, partyName, onClose }: ModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit } = useForm<UploadValues>({
    defaultValues: { kind: "POD", note: "" },
  });

  // One document per upload. A rejected file isn't kept, so the zone stays
  // ready for another and the file that was there before isn't lost.
  const choose = (files: File[]) => {
    if (files.length > 1) {
      setError("Choose one file at a time");
      return;
    }
    const problem = fileProblem(files[0]);
    setError(problem);
    if (!problem) setFile(files[0]);
  };

  const submit = handleSubmit((values) => {
    const problem = fileProblem(file);
    setError(problem);
    if (problem) return;
    notify(`${values.kind.replace(/_/g, " ")} ${file!.name}`, "uploaded");
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
        Add a document the TMS doesn&apos;t have, such as a signed POD.
        Uploading isn&apos;t built yet: this checks the file only.
      </p>
      <BaseSelect
        name="kind"
        control={control}
        label="Document"
        options={
          isCustomerInvoice(invoice) ? documentKinds : carrierDocumentKinds
        }
        disallowEmptySelection
      />
      <FileDropZone
        id="invoice-document"
        label="File"
        hint="PDF, PNG or JPEG, up to 10 MB."
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        file={file}
        error={error}
        onSelect={choose}
        onRemove={() => {
          setFile(null);
          setError(null);
        }}
      />
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
