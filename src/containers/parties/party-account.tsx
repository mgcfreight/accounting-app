import { useQuery } from "@tanstack/react-query";
import { BaseCardWrapper, DetailRow, Money, StatusChip } from "@/components/common";
import { PartyType } from "@/lib/enums";
import { PartyView } from "@/lib/interfaces";
import { formatDate } from "@/lib/utils";
import { getAccountSummary } from "@/services";

const None = ({ text = "None" }: { text?: string }) => (
  <span className="text-gray-400">{text}</span>
);

// The party's account as the API works it out (/account/summary): what is
// owed, what of it is overdue, money not yet matched to an invoice, this
// year's business and how it pays. Shown only to roles that may view the
// side's invoices; unapplied is left out without its payments view.
export default function PartyAccount({ party }: { party: PartyView }) {
  const isShipper = party.type === PartyType.Shipper;
  const summary = useQuery({
    queryKey: ["accounts", "summary", party.id],
    queryFn: ({ signal }) => getAccountSummary(party.id, signal),
  });

  if (summary.isError) {
    return (
      <BaseCardWrapper heading="Account">
        <p className="text-sm text-base-danger">
          Couldn&apos;t load the account figures.{" "}
          <button type="button" className="underline" onClick={() => void summary.refetch()}>
            Try again
          </button>
        </p>
      </BaseCardWrapper>
    );
  }
  if (summary.isPending) {
    return (
      <BaseCardWrapper heading="Account">
        <p className="text-sm text-gray-500">Loading…</p>
      </BaseCardWrapper>
    );
  }

  const data = summary.data;
  const { currency } = data;

  return (
    <BaseCardWrapper heading="Account">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
        <DetailRow
          strong
          label={isShipper ? "Owes MGC" : "MGC owes"}
          value={<Money amount={data.balance} currency={currency} />}
        />
        <DetailRow
          strong
          label="Overdue"
          value={
            data.oldestOverdueDays > 0 ? (
              <span className="flex flex-wrap items-center justify-end gap-2">
                <Money amount={data.overdue} currency={currency} />
                <StatusChip text={`oldest ${data.oldestOverdueDays} days past due`} tone="danger" />
              </span>
            ) : (
              <None />
            )
          }
        />
        {data.unapplied !== null && (
          <DetailRow
            label={isShipper ? "Received, not yet applied" : "Paid, not yet applied"}
            value={<Money amount={data.unapplied} currency={currency} />}
          />
        )}
        <DetailRow
          label="Business this year"
          value={
            <span>
              <Money amount={data.businessVolume} currency={currency} /> ·{" "}
              {data.shipmentCount} shipments
            </span>
          }
        />
        <DetailRow
          label="Last payment"
          value={
            data.lastPayment ? (
              <span>
                <Money amount={data.lastPayment.amount} currency={currency} /> on{" "}
                {formatDate(data.lastPayment.paidOn)} · {data.lastPayment.paymentNumber}
                {" · "}
                {data.lastPayment.invoiceRef ?? "not applied yet"}
              </span>
            ) : (
              <None text="No payments yet" />
            )
          }
        />
        <DetailRow
          label="Average days to pay"
          value={
            data.averagePaymentDays === null ? (
              <None text="—" />
            ) : (
              `${data.averagePaymentDays} days`
            )
          }
        />
        {isShipper && (
          <DetailRow
            label="Weekly statement"
            value={
              data.weeklyStatement
                ? `On${data.statementEmail ? ` · ${data.statementEmail}` : ""}`
                : "Off"
            }
          />
        )}
      </div>
    </BaseCardWrapper>
  );
}
