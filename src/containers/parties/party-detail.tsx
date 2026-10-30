import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { ReactNode, useState } from "react";
import {
  AlertBanner,
  BaseButton,
  BaseCardWrapper,
  BaseTable,
  DetailRow,
  ErrorState,
  InfoStrip,
  StatusChip,
  TableSkeleton,
} from "@/components/common";
import { Add, ArrowRight } from "@/components/icons";
import { useCan } from "@/components/providers/user-provider";
import { useServerPaging } from "@/hooks";
import {
  billingTriggerLabels,
  paymentTermsLabels,
  taxBasisLabels,
  taxTreatmentLabels,
} from "@/lib/constants";
import { InvoiceDirection, PartyType, Permission } from "@/lib/enums";
import { AgreementView, Paginated, PartyView } from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import { formatDate, torontoToday } from "@/lib/utils";
import {
  ApiError,
  errorMessage,
  getParty,
  listCarrierInvoices,
  listCustomerInvoices,
} from "@/services";
import InvoiceViewCell, { InvoiceView, InvoiceViewAction } from "../invoices/invoice-view";
import { AgreementFormModal, AgreementSettingsModal } from "./party-modals";

const invoiceColumns: BaseTableColumn[] = [
  { key: "number", label: "Invoice #" },
  { key: "reference", label: "Load Ref" },
  { key: "invoiceDate", label: "Invoice Date" },
  { key: "dueDate", label: "Due Date" },
  { key: "total", label: "Total", align: "end" },
  { key: "balance", label: "Balance", align: "end" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", align: "center" },
];

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <p>
    <strong>{label}:</strong> {children}
  </p>
);

// Calendar dates compare as text ("2026-10-14").
const agreementState = (agreement: AgreementView, today: string) => {
  if (agreement.effectiveFrom > today) return "upcoming";
  if (agreement.effectiveTo !== null && agreement.effectiveTo < today) return "ended";
  return "current";
};

// A shipper's or carrier's page: profile, agreed terms and invoices, from
// the API's /party and /invoice routes. Balances and statements arrive with
// payments.
export default function PartyDetail({ type }: { type: PartyType }) {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const { can } = useCan();
  const [addingAgreement, setAddingAgreement] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const isShipper = type === PartyType.Shipper;
  const what = isShipper ? "Shipper" : "Carrier";
  const listHref = isShipper ? "/shippers/" : "/carriers/";

  const party = useQuery({
    queryKey: ["parties", "detail", id],
    queryFn: ({ signal }) => getParty(id!, signal),
    enabled: !!id,
  });

  if (!id) return <ErrorState title={`${what} not found`} message="None was chosen." />;
  if (party.isPending) return <TableSkeleton />;
  if (party.isError) {
    const notFound =
      party.error instanceof ApiError &&
      (party.error.status === 404 || party.error.status === 400);
    return notFound ? (
      <ErrorState title={`${what} not found`} message={`There is no record ${id}.`} />
    ) : (
      <ErrorState message={errorMessage(party.error)} onAction={() => void party.refetch()} />
    );
  }

  const data = party.data;
  if (data.type !== type) {
    return <ErrorState title={`${what} not found`} message={`There is no record ${id}.`} />;
  }

  const today = torontoToday();
  const agreements = data.agreements ?? [];
  const current = agreements.find((a) => agreementState(a, today) === "current");

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <Link to={listHref} className="text-base text-[#71717A]">
            {isShipper ? "Shippers" : "Carriers"}
          </Link>
          <ArrowRight />
          <span className="text-base-primary-600 text-sm">{data.name}</span>
        </div>
      </div>

      <InfoStrip
        items={[
          { label: "MGC Id", value: data.mgcId },
          { label: "Currency", value: data.defaultCurrency },
          {
            label: "Terms",
            value: current ? paymentTermsLabels[current.paymentTerms] : "No agreement in force",
          },
          {
            label: "Status",
            value: data.isActive ? (
              <StatusChip text="Active" tone="success" />
            ) : (
              <StatusChip text="Inactive" tone="neutral" />
            ),
          },
          { label: "Added", value: formatDate(data.createdAt) },
        ]}
      />

      <BaseCardWrapper heading="Profile">
        <div className="text-sm text-[#343A40] space-y-1">
          {data.legalName && <Field label="Legal name">{data.legalName}</Field>}
          <Field label="GST/HST #">{data.gstHstNumber ?? "Not on file"}</Field>
          <Field label="Address">
            {[
              data.addressLine1,
              data.addressLine2,
              [data.city, data.province, data.postalCode].filter(Boolean).join(" "),
              data.country,
            ]
              .filter(Boolean)
              .join(", ")}
          </Field>
        </div>
      </BaseCardWrapper>

      <BaseCardWrapper
        heading="Agreements"
        action={
          can(Permission.PartiesEdit) && (
            <BaseButton
              text="Add Agreement"
              className="rounded-xl px-4"
              startContent={<Add />}
              onPress={() => setAddingAgreement(true)}
            />
          )
        }
      >
        {agreements.length === 0 ? (
          <p className="text-sm text-content-5 text-center border border-dashed border-content-4 rounded-lg p-6">
            No agreement yet. Invoices can&apos;t be made for this {what.toLowerCase()} until
            one is added.
          </p>
        ) : (
          <Agreements
            agreements={agreements}
            current={current}
            today={today}
            isShipper={isShipper}
            onEditSettings={
              can(Permission.PartiesEdit) ? () => setEditingSettings(true) : undefined
            }
          />
        )}
      </BaseCardWrapper>

      {can(
        isShipper
          ? Permission.CustomerInvoicesView
          : Permission.CarrierInvoicesView
      ) && <PartyInvoices party={data} />}

      {addingAgreement && (
        <AgreementFormModal party={data} onClose={() => setAddingAgreement(false)} />
      )}
      {editingSettings && current && (
        <AgreementSettingsModal
          agreement={current}
          isShipper={isShipper}
          onClose={() => setEditingSettings(false)}
        />
      )}
    </div>
  );
}

// Earlier and later agreements shown before "Show all".
const HISTORY_PREVIEW = 2;

const agreementPeriod = (agreement: AgreementView) =>
  `${formatDate(agreement.effectiveFrom)} – ${
    agreement.effectiveTo ? formatDate(agreement.effectiveTo) : "open-ended"
  }`;

const AgreementStateChip = ({ state }: { state: ReturnType<typeof agreementState> }) =>
  state === "current" ? (
    <StatusChip text="In force" tone="success" />
  ) : state === "upcoming" ? (
    <StatusChip text="Starts later" tone="secondary" />
  ) : (
    <StatusChip text="Ended" tone="neutral" />
  );

// A tick or cross with the label, not a chip: these can't be changed here.
const AgreementSwitch = ({ label, on }: { label: string; on: boolean }) => (
  <span className="text-xs text-[#343A40]">
    <span aria-hidden className={on ? "text-base-success" : "text-content-5"}>
      {on ? "✓" : "✕"}
    </span>{" "}
    {label}
    <span className="sr-only">: {on ? "on" : "off"}</span>
  </span>
);

// The agreed terms, as label …… value rows.
function AgreementTerms({
  agreement,
  isShipper,
}: {
  agreement: AgreementView;
  isShipper: boolean;
}) {
  const days = isShipper ? agreement.noticeDaysBefore : agreement.alertDaysBefore;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
        <DetailRow label="Payment terms" value={paymentTermsLabels[agreement.paymentTerms]} />
        <DetailRow label="Currency" value={agreement.currency} />
        <DetailRow label="Tax treatment" value={taxTreatmentLabels[agreement.taxTreatment]} />
        <DetailRow label="Tax rate from" value={taxBasisLabels[agreement.taxBasis]} />
        {!isShipper && (
          <DetailRow
            label="Billing trigger"
            value={
              agreement.billingTrigger ? billingTriggerLabels[agreement.billingTrigger] : "—"
            }
          />
        )}
        <DetailRow
          label={isShipper ? "Notice before a billing period ends" : "Alert before a bill is due"}
          value={days === null ? "Not set" : `${days} day${days === 1 ? "" : "s"}`}
        />
      </div>
      {/* Read-only: adding an agreement can't set these yet (the API's
          create-agreement request doesn't take them). */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <AgreementSwitch label="Payment reminders" on={agreement.remindersEnabled} />
        {isShipper && (
          <>
            <AgreementSwitch label="Auto-send invoices" on={agreement.autoSendInvoices} />
            <AgreementSwitch label="Weekly statement" on={agreement.weeklyStatementEnabled} />
          </>
        )}
      </div>
      {agreement.notes && (
        <p className="text-sm text-content-5 whitespace-pre-wrap">
          <strong className="text-[#343A40]">Notes:</strong> {agreement.notes}
        </p>
      )}
    </div>
  );
}

// The agreement in force on its own panel, a banner for the next change, and
// the rest as rows that open to show their terms. Agreements come newest
// first.
function Agreements({
  agreements,
  current,
  today,
  isShipper,
  onEditSettings,
}: {
  agreements: AgreementView[];
  current: AgreementView | undefined;
  today: string;
  isShipper: boolean;
  // Unset when the user can't edit parties.
  onEditSettings?: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const next = agreements.findLast((a) => agreementState(a, today) === "upcoming");
  const others = agreements.filter((a) => a !== current);
  const shown = showAll ? others : others.slice(0, HISTORY_PREVIEW);

  return (
    <div className="flex flex-col gap-4">
      {next && (
        <AlertBanner
          message={`New terms start ${formatDate(next.effectiveFrom)}: ${
            paymentTermsLabels[next.paymentTerms]
          }, ${next.currency}.`}
        />
      )}

      {current ? (
        <section
          aria-label="Agreement in force"
          className="flex flex-col gap-4 rounded-lg border border-content-10 bg-content-12 p-4"
        >
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <AgreementStateChip state="current" />
            <span className="font-semibold text-[#343A40]">{agreementPeriod(current)}</span>
            {onEditSettings && (
              <BaseButton
                varient="bordered"
                className="ml-auto h-8 px-3 text-base-primary"
                text="Edit settings"
                onPress={onEditSettings}
              />
            )}
          </div>
          <AgreementTerms agreement={current} isShipper={isShipper} />
        </section>
      ) : (
        <p className="text-sm text-content-5 rounded-lg border border-dashed border-content-4 p-4">
          No agreement is in force today.
        </p>
      )}

      {others.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-[#343A40]">
            {current ? "Other agreements" : "Agreements"}
          </h2>
          {shown.map((agreement) => (
            <details
              key={agreement.id}
              className="group text-sm text-[#343A40] border-b border-gray-100 pb-2"
            >
              <summary className="flex flex-wrap items-center gap-2 cursor-pointer list-none py-1 rounded focus-visible:outline-2 focus-visible:outline-base-primary-300">
                <span
                  aria-hidden
                  className="text-content-5 transition-transform group-open:rotate-90"
                >
                  ›
                </span>
                <span className="font-semibold">{agreementPeriod(agreement)}</span>
                <span className="text-content-5">
                  {paymentTermsLabels[agreement.paymentTerms]} · {agreement.currency}
                </span>
                <AgreementStateChip state={agreementState(agreement, today)} />
              </summary>
              <div className="pt-2 pl-4">
                <AgreementTerms agreement={agreement} isShipper={isShipper} />
              </div>
            </details>
          ))}
          {others.length > HISTORY_PREVIEW && (
            <BaseButton
              varient="light"
              className="self-start px-2"
              text={showAll ? "Show fewer" : `Show all ${others.length}`}
              onPress={() => setShowAll((all) => !all)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function PartyInvoices({ party }: { party: PartyView }) {
  const isShipper = party.type === PartyType.Shipper;
  const paging = useServerPaging(party.id);
  const params = { page: paging.page, limit: paging.limit };

  const invoices = useQuery({
    queryKey: [
      "invoices",
      isShipper ? InvoiceDirection.Receivable : InvoiceDirection.Payable,
      "party",
      party.id,
      params,
    ],
    queryFn: ({ signal }): Promise<Paginated<InvoiceView>> =>
      isShipper
        ? listCustomerInvoices({ ...params, customerId: party.id }, signal)
        : listCarrierInvoices({ ...params, carrierId: party.id }, signal),
    placeholderData: keepPreviousData,
  });

  return (
    <BaseCardWrapper heading="Invoices">
      {invoices.isError ? (
        <ErrorState
          message="We couldn't load the invoices. Please try again."
          onAction={() => void invoices.refetch()}
        />
      ) : (
        <BaseTable<InvoiceView>
          ariaLabel="Invoices"
          columns={invoiceColumns}
          data={invoices.data?.items ?? []}
          loading={invoices.isPending}
          refreshing={invoices.isPlaceholderData}
          rowKey={(row) => row.id}
          renderCell={(row, key) =>
            key === "actions" ? (
              <InvoiceViewAction invoice={row} />
            ) : (
              <InvoiceViewCell invoice={row} columnKey={key} />
            )
          }
          meta={paging.tableMeta(invoices.data?.meta)}
          setMeta={paging.setMeta}
          bottomContent="Invoices"
          emptyContent="No invoices"
        />
      )}
    </BaseCardWrapper>
  );
}
