import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  BaseButton,
  BaseCardWrapper,
  BaseTextArea,
  FormModal,
  Money,
  StatusChip,
} from "@/components/common";
import { useCan } from "@/components/providers/user-provider";
import { useFileDownload } from "@/hooks";
import { DocumentSource, Permission } from "@/lib/enums";
import { InvoiceDocument, WriteOff } from "@/lib/interfaces";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  ApiError,
  downloadInvoiceDocument,
  errorMessage,
  listInvoiceDocuments,
  listWriteOffs,
  removeInvoiceDocument,
  reverseWriteOff,
} from "@/services";
import { documentKindLabels } from "./invoice-extra-actions";
import { directionOf, InvoiceView, isCustomerInvoice } from "./invoice-view";

const sourceLabels: Record<DocumentSource, string> = {
  [DocumentSource.Mgc]: "From the TMS",
  [DocumentSource.Upload]: "Uploaded",
  [DocumentSource.Generated]: "Made by the app",
};

const sizeText = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

// The invoice's files, oldest first: from the TMS, uploaded by staff, and
// the PDFs the app emailed. Uploaded ones can be hidden (they stay on
// record).
export function DocumentsCard({ invoice }: { invoice: InvoiceView }) {
  const { can } = useCan();
  const direction = directionOf(invoice);
  const canEdit = can(
    isCustomerInvoice(invoice)
      ? Permission.CustomerInvoicesEdit
      : Permission.CarrierInvoicesEdit
  );
  const documents = useQuery({
    queryKey: ["invoice-documents", invoice.id],
    queryFn: ({ signal }) => listInvoiceDocuments(direction, invoice.id, signal),
  });
  const download = useFileDownload((document: InvoiceDocument) =>
    downloadInvoiceDocument(direction, invoice.id, document.id, document.fileName)
  );
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (document: InvoiceDocument) =>
      removeInvoiceDocument(direction, invoice.id, document.id),
    onSuccess: (_, document) => {
      toast.success(`${document.fileName} removed.`);
      void queryClient.invalidateQueries({ queryKey: ["invoice-documents", invoice.id] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <BaseCardWrapper heading="Documents">
      {documents.isError ? (
        <p className="text-sm text-base-danger">
          Couldn&apos;t load the documents.{" "}
          <button type="button" className="underline" onClick={() => void documents.refetch()}>
            Try again
          </button>
        </p>
      ) : documents.isPending ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : documents.data.length === 0 ? (
        <p className="text-sm text-gray-500">No documents yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.data.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap justify-between items-center gap-2 text-sm border-b border-gray-100 pb-2"
            >
              <div className="flex flex-col">
                <span className="font-semibold break-all">{document.fileName}</span>
                <span className="text-xs text-gray-500">
                  {documentKindLabels[document.kind]} · {sourceLabels[document.source]}
                  {document.uploadedBy ? ` by ${document.uploadedBy}` : ""} ·{" "}
                  {formatDateTime(document.createdAt)} · {sizeText(document.sizeBytes)}
                </span>
              </div>
              <div className="flex gap-2">
                <BaseButton
                  text="Download"
                  varient="bordered"
                  className="text-base-primary rounded-xl px-3"
                  isLoading={download.isPending && download.variables?.id === document.id}
                  onPress={() => download.mutate(document)}
                />
                {canEdit && document.source === DocumentSource.Upload && (
                  <BaseButton
                    text="Remove"
                    varient="light"
                    className="text-base-danger px-2"
                    isLoading={remove.isPending && remove.variables?.id === document.id}
                    onPress={() => remove.mutate(document)}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </BaseCardWrapper>
  );
}

// A shipper invoice's write-offs, reversed ones included, from the
// shipper's list. Shown only when there are some.
export function WriteOffsCard({ invoice }: { invoice: InvoiceView }) {
  const { can } = useCan();
  const [reversing, setReversing] = useState<WriteOff | null>(null);
  const customerId = isCustomerInvoice(invoice) ? invoice.customerId : null;
  const writeOffs = useQuery({
    queryKey: ["write-offs", { customerId }],
    queryFn: ({ signal }) =>
      listWriteOffs({ page: 1, limit: 100, customerId: customerId! }, signal),
    enabled: !!customerId,
    select: (page) => page.items.filter((item) => item.invoiceId === invoice.id),
  });
  if (!writeOffs.data || writeOffs.data.length === 0) return null;
  const canReverse = can(Permission.CustomerInvoicesWriteOff);

  return (
    <BaseCardWrapper heading="Write-offs">
      <ul className="flex flex-col gap-2">
        {writeOffs.data.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap justify-between items-start gap-2 text-sm border-b border-gray-100 pb-2"
          >
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Money amount={item.amount} currency={item.currency} className="font-semibold" />
                <span className="text-gray-500">
                  on {formatDate(item.writtenOffOn)} · bad debt{" "}
                  <Money amount={item.badDebt} currency={item.currency} />, tax relief{" "}
                  <Money amount={item.taxRelief} currency={item.currency} />
                </span>
                {item.reversedAt && <StatusChip text="Reversed" tone="neutral" />}
              </div>
              <span>{item.reason}</span>
              {item.reversedAt && (
                <span className="text-xs text-gray-500">
                  Reversed {formatDateTime(item.reversedAt)}: {item.reversalReason}
                </span>
              )}
            </div>
            {canReverse && !item.reversedAt && (
              <BaseButton
                text="Reverse"
                varient="bordered"
                className="text-base-primary rounded-xl px-3"
                onPress={() => setReversing(item)}
              />
            )}
          </li>
        ))}
      </ul>
      {reversing && (
        <ReverseWriteOffModal writeOff={reversing} onClose={() => setReversing(null)} />
      )}
    </BaseCardWrapper>
  );
}

function ReverseWriteOffModal({
  writeOff,
  onClose,
}: {
  writeOff: WriteOff;
  onClose: () => void;
}) {
  const { control, handleSubmit } = useForm({ defaultValues: { reason: "" } });
  const queryClient = useQueryClient();
  const refresh = () =>
    ["invoices", "write-offs", "accounts", "report", "reminders"].forEach(
      (key) => void queryClient.invalidateQueries({ queryKey: [key] })
    );
  const reverse = useMutation({
    mutationFn: (reason: string) => reverseWriteOff(writeOff.id, reason),
    onSuccess: () => {
      toast.success("Write-off reversed: the invoice owes the amount again.");
      refresh();
      onClose();
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      if (error instanceof ApiError && error.status === 409) refresh();
    },
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Reverse Write-off"
      confirmText="Reverse"
      onConfirm={handleSubmit((values) => reverse.mutate(values.reason.trim()))}
      isConfirming={reverse.isPending}
    >
      <p className="text-sm">
        The invoice owes <Money amount={writeOff.amount} currency={writeOff.currency} /> again,
        and the bad debt and tax relief come off the reports.
      </p>
      <BaseTextArea
        name="reason"
        control={control}
        label="Reason"
        placeholder="Shipper paid in full after all"
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
