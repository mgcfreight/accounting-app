import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { ReactNode, useState } from "react";
import {
  BaseButton,
  BaseCardWrapper,
  BaseTable,
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
import InvoiceViewCell, { InvoiceView } from "../invoices/invoice-view";
import { AgreementFormModal } from "./party-modals";

const invoiceColumns: BaseTableColumn[] = [
  { key: "number", label: "Invoice #" },
  { key: "reference", label: "Load Ref" },
  { key: "invoiceDate", label: "Invoice Date" },
  { key: "dueDate", label: "Due Date" },
  { key: "total", label: "Total" },
  { key: "balance", label: "Balance" },
  { key: "status", label: "Status" },
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
        {can(Permission.PartiesEdit) && (
          <BaseButton
            text="Add Agreement"
            className="rounded-xl px-4"
            startContent={<Add />}
            onPress={() => setAddingAgreement(true)}
          />
        )}
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

      <BaseCardWrapper heading="Agreements">
        {agreements.length === 0 ? (
          <p className="text-sm text-content-5">
            No agreement yet. Invoices can&apos;t be made for this {what.toLowerCase()} until
            one is added.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {agreements.map((agreement) => (
              <AgreementRow
                key={agreement.id}
                agreement={agreement}
                state={agreementState(agreement, today)}
                isShipper={isShipper}
              />
            ))}
          </div>
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
    </div>
  );
}

const AgreementSwitch = ({ label, on }: { label: string; on: boolean }) => (
  <StatusChip text={`${label}: ${on ? "on" : "off"}`} tone={on ? "success" : "neutral"} />
);

function AgreementRow({
  agreement,
  state,
  isShipper,
}: {
  agreement: AgreementView;
  state: ReturnType<typeof agreementState>;
  isShipper: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm text-[#343A40] border-b border-gray-100 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">
          {formatDate(agreement.effectiveFrom)} –{" "}
          {agreement.effectiveTo ? formatDate(agreement.effectiveTo) : "open-ended"}
        </span>
        {state === "current" && <StatusChip text="In force" tone="success" />}
        {state === "upcoming" && <StatusChip text="Starts later" tone="secondary" />}
        {state === "ended" && <StatusChip text="Ended" tone="neutral" />}
      </div>
      <span>
        {paymentTermsLabels[agreement.paymentTerms]} · {agreement.currency} · Tax{" "}
        {taxTreatmentLabels[agreement.taxTreatment].toLowerCase()}, rate from{" "}
        {taxBasisLabels[agreement.taxBasis].toLowerCase()}
        {agreement.billingTrigger &&
          ` · ${billingTriggerLabels[agreement.billingTrigger]}`}
      </span>
      {/* Read-only: adding an agreement can't set these yet (the API's
          create-agreement request doesn't take them). */}
      <div className="flex flex-wrap gap-1">
        <AgreementSwitch label="Payment reminders" on={agreement.remindersEnabled} />
        {isShipper && (
          <>
            <AgreementSwitch label="Auto-send invoices" on={agreement.autoSendInvoices} />
            <AgreementSwitch label="Weekly statement" on={agreement.weeklyStatementEnabled} />
          </>
        )}
      </div>
      {agreement.notes && (
        <span className="text-content-5 whitespace-pre-wrap">{agreement.notes}</span>
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
    <BaseCardWrapper heading="Invoices" className="mb-5">
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
          rowKey={(row) => row.id}
          renderCell={(row, key) => <InvoiceViewCell invoice={row} columnKey={key} />}
          meta={paging.tableMeta(invoices.data?.meta)}
          setMeta={paging.setMeta}
          bottomContent="Invoices"
          emptyContent="No invoices"
        />
      )}
    </BaseCardWrapper>
  );
}
