import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ReactNode, useState } from "react";
import {
  AlertBanner,
  BaseButton,
  BaseCardWrapper,
  DetailRow,
  ErrorState,
  InfoStrip,
  Money,
  RowActions,
  TableSkeleton,
} from "@/components/common";
import { ArrowRight, Send } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
import {
  billingTriggerLabels,
  paymentTermsLabels,
  reviewFlagLabels,
  taxBasisLabels,
} from "@/lib/constants";
import {
  CarrierInvoiceStatus,
  InvoiceDirection,
  InvoiceReviewFlag,
} from "@/lib/enums";
import { CarrierInvoiceView, CustomerInvoiceView } from "@/lib/interfaces";
import { addDays, formatDate, formatDateTime, humanize } from "@/lib/utils";
import {
  ApiError,
  errorMessage,
  getCarrierInvoice,
  getCarrierInvoiceVersions,
  getCustomerInvoice,
  getCustomerInvoiceVersions,
} from "@/services";
import usePartyNames from "../parties/use-party-names";
import InvoiceActionModal, { InvoiceAction } from "./invoice-action-modal";
import InvoiceExtraActionModal, {
  canBeVoided,
  CancelledLoadBanner,
  ExtraAction,
  extraActionsFor,
} from "./invoice-extra-actions";
import InvoiceHistory from "./invoice-history";
import { availableActions } from "./invoice-row-actions";
import {
  apiInvoiceHref,
  awaitsReview,
  carrierIdsOf,
  InvoiceBalance,
  invoiceListHref,
  invoiceNumberOf,
  InvoiceStatusCell,
  InvoiceTotal,
  InvoiceView,
  isCustomerInvoice,
  isOwed,
  isSuperseded,
  partyOf,
  referencesOf,
} from "./invoice-view";

// Reminders go out this many days before the due date (the requirement).
const REMINDER_DAYS_BEFORE_DUE = 7;

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <p>
    <strong>{label}:</strong> {children}
  </p>
);

const orNone = (value: string | null) => value ?? "Not on file";

// mokal-app's InvoiceId page, on the Accounts API: the invoice, who it's for,
// its lines and taxes, and what can be done with it next.
export default function InvoiceDetail({
  direction,
}: {
  direction: InvoiceDirection;
}) {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const navigate = useNavigate();
  const { can } = useCan();
  const [action, setAction] = useState<InvoiceAction | null>(null);
  const [extraAction, setExtraAction] = useState<ExtraAction | null>(null);
  const isReceivable = direction === InvoiceDirection.Receivable;
  const listHref = invoiceListHref(direction);

  const invoice = useQuery({
    queryKey: ["invoices", direction, "detail", id],
    queryFn: ({ signal }): Promise<InvoiceView> =>
      isReceivable
        ? getCustomerInvoice(id!, signal)
        : getCarrierInvoice(id!, signal),
    enabled: !!id,
  });
  // Every version of this invoice's number, oldest first.
  const versions = useQuery({
    queryKey: ["invoices", direction, "versions", id],
    queryFn: ({ signal }): Promise<InvoiceView[]> =>
      isReceivable
        ? getCustomerInvoiceVersions(id!, signal)
        : getCarrierInvoiceVersions(id!, signal),
    enabled: !!id,
  });
  const carriers = usePartyNames(carrierIdsOf(invoice.data ? [invoice.data] : []));

  if (!id) {
    return <ErrorState title="Invoice not found" message="No invoice was chosen." />;
  }
  if (invoice.isPending) return <TableSkeleton />;
  if (invoice.isError) {
    // 400: not an invoice id. 404: no such invoice.
    const notFound =
      invoice.error instanceof ApiError &&
      (invoice.error.status === 404 || invoice.error.status === 400);
    return notFound ? (
      <ErrorState title="Invoice not found" message={`There is no invoice ${id}.`} />
    ) : (
      <ErrorState
        message={errorMessage(invoice.error)}
        onAction={() => void invoice.refetch()}
      />
    );
  }

  const data = invoice.data;
  const number = invoiceNumberOf(data);
  const party = partyOf(data, carriers);
  const actions = availableActions(data, can);
  const extraActions = extraActionsFor(data, can, setExtraAction);
  const canVoid = extraActions.some((item) => item.key === "void");
  const references = referencesOf(data);
  // The TMS cancelled the load: until the invoice is void, point to voiding.
  const loadCancelled =
    data.reviewFlags.includes(InvoiceReviewFlag.TmsCancelled) &&
    canBeVoided(data);
  const remindOn =
    isOwed(data) && data.dueDate
      ? addDays(data.dueDate, -REMINDER_DAYS_BEFORE_DUE)
      : null;
  const replacedBy = isSuperseded(data)
    ? versions.data?.find((version) => version.parentInvoiceId === data.id)
    : undefined;

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <Link to={listHref} className="text-base text-[#71717A]">
            {isReceivable ? "Shipper Invoices" : "Carrier Invoices"}
          </Link>
          <ArrowRight />
          <span className="text-base-primary-600 text-sm">
            {number ? `#${number}` : "No number yet"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((item, index) => (
            <BaseButton
              key={item.key}
              text={item.label}
              varient={index === 0 ? "solid" : "bordered"}
              className={`rounded-xl px-4 ${index === 0 ? "" : "text-base-primary"}`}
              startContent={item.key === "issue" ? <Send /> : undefined}
              onPress={() => setAction(item.key)}
            />
          ))}
          {extraActions.length > 0 && <RowActions actions={extraActions} />}
        </div>
      </div>

      {loadCancelled && (
        <CancelledLoadBanner
          canVoid={canVoid}
          onVoid={() => setExtraAction("void")}
        />
      )}

      {isSuperseded(data) && (
        <AlertBanner
          message={
            <>
              This version was replaced
              {replacedBy && (
                <>
                  {" "}by{" "}
                  <Link
                    to={apiInvoiceHref(replacedBy)}
                    className="text-base-primary-300 hover:underline"
                  >
                    {invoiceNumberOf(replacedBy) ?? "the new version"}
                  </Link>
                </>
              )}
              {data.supersededAt && ` on ${formatDateTime(data.supersededAt)}`}
              . It is kept exactly as it was; what it owed moved to the new
              version.
            </>
          }
        />
      )}

      {awaitsReview(data) && (
        <AlertBanner
          message={
            <>
              Check before {isReceivable ? "issuing" : "approving"}:{" "}
              {data.reviewFlags.map((flag) => reviewFlagLabels[flag]).join("; ")}.
            </>
          }
        />
      )}

      <InfoStrip
        items={[
          { label: "Invoice Date", value: formatDate(data.invoiceDate ?? undefined) ?? "—" },
          { label: "Due Date", value: formatDate(data.dueDate ?? undefined) ?? "—" },
          { label: "Invoice Total", value: <InvoiceTotal invoice={data} /> },
          { label: "Balance", value: <InvoiceBalance invoice={data} /> },
          { label: "Status", value: <InvoiceStatusCell invoice={data} /> },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isCustomerInvoice(data) ? (
          <BillToCard invoice={data} href={party.href} />
        ) : (
          <CarrierCard invoice={data} name={party.name} href={party.href} />
        )}
        <BaseCardWrapper heading="Details">
          <div className="text-sm text-[#343A40] space-y-1">
            <Field label="Currency">{data.currency}</Field>
            {data.fxRateToCad !== null && (
              <Field label="Rate to CAD">{data.fxRateToCad}</Field>
            )}
            <Field label="Terms">{paymentTermsLabels[data.paymentTerms]}</Field>
            {remindOn && (
              <Field label="Payment reminder">
                {formatDate(remindOn)} ({REMINDER_DAYS_BEFORE_DUE} days before
                due
                {isReceivable
                  ? ", emailed to the customer's accounts department"
                  : ", an alert to the accounts team"}
                ).{" "}
                <span className="text-content-5">
                  Not sent yet: reminders aren&apos;t built.{" "}
                  <Link
                    to="/reminders/"
                    className="text-base-primary-300 hover:underline"
                  >
                    All reminders
                  </Link>
                </span>
              </Field>
            )}
            {/* Carrier invoices print no tax (decided 2026-10-27). */}
            {isCustomerInvoice(data) && (
              <Field label="Tax">
                {taxBasisLabels[data.taxBasis]}
                {data.taxJurisdiction && ` · ${data.taxJurisdiction}`}
              </Field>
            )}
            <Field label="Kind">{humanize(data.kind)}</Field>
            <Field label="TMS invoice code">{data.tmsInvoiceCode ?? "Not set"}</Field>
            <Field label="Shipment">{data.shipmentId ?? "—"}</Field>
            <Field label="Reference numbers">
              {references.length > 0
                ? references.map((ref) => `${ref.label} ${ref.value}`).join(" · ")
                : "None"}
            </Field>
          </div>
        </BaseCardWrapper>
      </div>

      <ChargesCard invoice={data} />

      {versions.isError ? (
        <BaseCardWrapper heading="Versions">
          <p className="text-sm text-base-danger">
            Couldn&apos;t load this invoice&apos;s versions.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void versions.refetch()}
            >
              Try again
            </button>
          </p>
        </BaseCardWrapper>
      ) : (
        versions.data &&
        versions.data.length > 1 && (
          <BaseCardWrapper heading="Versions">
            <ol className="flex flex-col gap-3">
              {versions.data.map((version) => (
                <li
                  key={version.id}
                  className="flex flex-wrap justify-between items-start gap-3"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {version.id === data.id ? (
                        <strong>{invoiceNumberOf(version) ?? "This version"}</strong>
                      ) : (
                        <Link
                          to={apiInvoiceHref(version)}
                          className="text-base-primary-300 hover:underline"
                        >
                          {invoiceNumberOf(version) ?? "No number yet"}
                        </Link>
                      )}
                      <InvoiceStatusCell invoice={version} />
                    </div>
                    <span className="text-xs text-content-5">
                      {version.revisionReason ?? "First version"}
                    </span>
                  </div>
                  <InvoiceTotal invoice={version} />
                </li>
              ))}
            </ol>
          </BaseCardWrapper>
        )
      )}

      <InvoiceHistory invoice={data} />

      {data.notes && (
        <BaseCardWrapper heading="Notes" className="mb-5">
          {/* Rendered as text by React, so a note can't inject markup. */}
          <p className="text-sm text-[#343A40] whitespace-pre-wrap">{data.notes}</p>
        </BaseCardWrapper>
      )}

      <InvoiceActionModal
        action={action}
        invoice={data}
        partyName={party.name}
        onClose={() => setAction(null)}
        onRevised={(newId) =>
          navigate(`${listHref}view/?id=${encodeURIComponent(newId)}`)
        }
      />
      <InvoiceExtraActionModal
        action={extraAction}
        invoice={data}
        partyName={party.name}
        onClose={() => setExtraAction(null)}
      />
    </div>
  );
}

// The customer's billing address as it was when the invoice was made.
function BillToCard({ invoice, href }: { invoice: CustomerInvoiceView; href: string }) {
  const { billTo } = invoice;
  const place = [billTo.city, billTo.province, billTo.postal_code]
    .filter(Boolean)
    .join(" ");
  return (
    <BaseCardWrapper heading="Bill To">
      <div className="text-sm text-[#343A40] space-y-1">
        <Field label="Name">
          <Link to={href} className="text-base-primary-300 hover:underline">
            {billTo.name}
          </Link>
        </Field>
        {billTo.legal_name && <Field label="Legal name">{billTo.legal_name}</Field>}
        <Field label="GST/HST #">{orNone(billTo.gst_hst_number)}</Field>
        <Field label="Address">
          {[billTo.address_line1, billTo.address_line2, place, billTo.country]
            .filter(Boolean)
            .join(", ")}
        </Field>
        {invoice.issuedAt && (
          <Field label="Issued">{formatDateTime(invoice.issuedAt)}</Field>
        )}
        {invoice.sentAt && <Field label="Sent">{formatDateTime(invoice.sentAt)}</Field>}
        <p className="text-xs text-content-5 pt-2">
          As it was when the invoice was made.
        </p>
      </div>
    </BaseCardWrapper>
  );
}

function CarrierCard({
  invoice,
  name,
  href,
}: {
  invoice: CarrierInvoiceView;
  name: string;
  href: string;
}) {
  return (
    <BaseCardWrapper heading="Carrier">
      <div className="text-sm text-[#343A40] space-y-1">
        <Field label="Name">
          <Link to={href} className="text-base-primary-300 hover:underline">
            {name}
          </Link>
        </Field>
        <Field label="Billing">{billingTriggerLabels[invoice.billingTrigger]}</Field>
        <Field label="Carrier bill #">
          {invoice.carrierInvoiceNumber ?? "Awaiting bill"}
        </Field>
        {invoice.receivedAt && (
          <Field label="Bill received">{formatDateTime(invoice.receivedAt)}</Field>
        )}
        {invoice.approvedAt && (
          <Field label="Approved">{formatDateTime(invoice.approvedAt)}</Field>
        )}
        {invoice.status === CarrierInvoiceStatus.OnHold && (
          <Field label="On hold">
            {invoice.holdReason ?? "The bill differs from what was expected."}
          </Field>
        )}
        <Field label="Expected total">
          <Money amount={invoice.expectedTotal} currency={invoice.currency} />
        </Field>
        {invoice.varianceAmount !== null && (
          <Field label="Difference from expected">
            <Money amount={invoice.varianceAmount} currency={invoice.currency} />
          </Field>
        )}
      </div>
    </BaseCardWrapper>
  );
}

// Lines, taxes and totals, exactly as the API calculated them.
function ChargesCard({ invoice }: { invoice: InvoiceView }) {
  const { currency } = invoice;
  const lines = invoice.lines ?? [];
  const awaitingBill =
    !isCustomerInvoice(invoice) && invoice.status === CarrierInvoiceStatus.Expected;

  return (
    <BaseCardWrapper heading="Charges">
      {awaitingBill ? (
        <p className="text-sm text-content-5">
          The carrier&apos;s bill hasn&apos;t arrived. Its charges show here once
          it&apos;s entered.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-4 mb-4 pb-4">
            {lines.map((line) => (
              <DetailRow
                key={line.id}
                label={
                  <span>
                    {line.description}
                    <span className="block text-xs text-content-5">
                      {line.chargeTypeCode} · {line.quantity} × {currency}{" "}
                      {line.unitPrice}
                      {line.isTaxable ? "" : " · not taxed"}
                    </span>
                  </span>
                }
                value={<Money amount={line.amount} currency={currency} />}
              />
            ))}
          </div>
          <div className="flex flex-col gap-2 border-t-2 border-base-default pt-4">
            <DetailRow
              label="Subtotal"
              value={<Money amount={invoice.subtotal} currency={currency} />}
            />
            {invoice.taxes.map((tax) => (
              <DetailRow
                key={`${tax.tax_rate_id}-${tax.code}`}
                label={
                  <span className="pl-4 text-content-5">
                    {tax.code} {tax.rate_percent}%
                    {tax.jurisdiction && ` (${tax.jurisdiction})`} on{" "}
                    <Money amount={tax.taxable_amount} currency={currency} />
                  </span>
                }
                value={<Money amount={tax.tax_amount} currency={currency} />}
              />
            ))}
            <DetailRow
              label={isCustomerInvoice(invoice) ? "Tax" : "Tax (input tax credit)"}
              value={<Money amount={invoice.taxTotal} currency={currency} />}
            />
          </div>
          <div className="flex flex-col items-end gap-3 mt-6">
            <span className="font-medium text-sm">Invoice Total</span>
            <Money amount={invoice.total} currency={currency} className="font-medium text-xl" />
            <span className="text-sm opacity-70">Including tax</span>
            <span className="text-sm">
              Paid <Money amount={invoice.amountPaid} currency={currency} /> · Balance{" "}
              <InvoiceBalance invoice={invoice} />
            </span>
          </div>
        </>
      )}
    </BaseCardWrapper>
  );
}
