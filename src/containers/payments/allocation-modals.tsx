import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseInput,
  ErrorState,
  FormModal,
  Money,
  StatusChip,
} from "@/components/common";
import { useCan } from "@/components/providers/user-provider";
import {
  AllocationRule,
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  InvoiceKind,
  PaymentDirection,
  PaymentStatus,
  Permission,
} from "@/lib/enums";
import { Allocation, Payment, SuggestedAllocation } from "@/lib/interfaces";
import { compareMoney, isZeroMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  allocatePayment,
  AllocationLine,
  ApiError,
  errorMessage,
  getAllocationSuggestion,
  listCarrierInvoices,
  listCustomerInvoices,
  reverseAllocation,
  reversePayment,
} from "@/services";

// Allocating a payment to invoices (design §8.5): the API's suggestion, a
// manual split, where a payment went, and reversing. Every figure comes from
// the API; the checks here are for the form only — the API checks again.

export const allocationRuleLabels: Record<AllocationRule, string> = {
  [AllocationRule.InvoiceNumber]: "Invoice # in reference",
  [AllocationRule.ExactAmount]: "Exact amount",
  [AllocationRule.OldestOpen]: "Oldest open invoice",
  [AllocationRule.Manual]: "Manual",
};

const live = (payment: Payment) =>
  payment.allocations.filter((a) => a.reversedAt === null);

// How a payment was matched: each rule its live allocations used, once.
export const matchedBy = (payment: Payment) =>
  [...new Set(live(payment).map((a) => a.rule))]
    .map((rule) => allocationRuleLabels[rule])
    .join(", ");

export const partyLabel = (payment: Payment) =>
  payment.partyName ?? payment.partyId;

const AMOUNT = /^\d{1,12}\.\d{2}$/;

const isIn = (payment: Payment) => payment.direction === PaymentDirection.In;

// Refetch payments and invoices after a change; on a 409 (someone else
// changed the payment) refetch so the screen shows what is true now.
const usePaymentMutation = <T,>(
  action: (values: T) => Promise<Payment>,
  successMessage: (payment: Payment) => string,
  onClose: () => void
) => {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
    void queryClient.invalidateQueries({ queryKey: ["invoices"] });
  };
  return useMutation({
    mutationFn: action,
    onSuccess: (payment) => {
      toast.success(successMessage(payment));
      refresh();
      onClose();
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      if (error instanceof ApiError && error.status === 409) refresh();
    },
  });
};

function PaymentSummary({ payment }: { payment: Payment }) {
  return (
    <p className="text-sm text-[#707070]">
      {payment.number} · {partyLabel(payment)} · paid{" "}
      {formatDate(payment.paidOn)} · unapplied{" "}
      <Money amount={payment.unapplied} currency={payment.currency} />
    </p>
  );
}

type Row = {
  key: string;
  invoiceNumber: string | null;
  balanceBefore: string | null;
  amount: string;
  balanceAfter: string | null;
  rule: AllocationRule;
  reversedAt?: string | null;
};

// Each line with the invoice's balance before and after it. A part payment
// leaves the invoice part paid.
function AllocationTable({
  rows,
  currency,
  action,
}: {
  rows: Row[];
  currency: Payment["currency"];
  action?: (row: Row) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-default-500">
            <th className="py-2 pr-3 font-medium">Invoice</th>
            <th className="py-2 px-2 font-medium text-right">Balance before</th>
            <th className="py-2 px-2 font-medium text-right">Applied</th>
            <th className="py-2 px-2 font-medium text-right">Balance after</th>
            <th className="py-2 pl-2 font-medium">Matched by</th>
            {action && <th className="py-2 pl-2" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={row.reversedAt ? "text-gray-400 line-through" : undefined}
            >
              <td className="py-2 pr-3 font-semibold">
                {row.invoiceNumber ?? "No number yet"}
              </td>
              <td className="py-2 px-2 text-right">
                {row.balanceBefore ? (
                  <Money amount={row.balanceBefore} currency={currency} />
                ) : (
                  "—"
                )}
              </td>
              <td className="py-2 px-2 text-right">
                <Money amount={row.amount} currency={currency} className="font-semibold" />
              </td>
              <td className="py-2 px-2 text-right">
                {row.balanceAfter ? (
                  <div className="flex flex-col items-end gap-1">
                    <Money amount={row.balanceAfter} currency={currency} />
                    {!row.reversedAt &&
                      (isZeroMoney(row.balanceAfter) ? (
                        <StatusChip text="Paid" tone="success" />
                      ) : (
                        <StatusChip text="Part paid" tone="secondary" />
                      ))}
                  </div>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-2 pl-2">
                {row.reversedAt
                  ? `Reversed ${formatDateTime(row.reversedAt)}`
                  : allocationRuleLabels[row.rule]}
              </td>
              {action && <td className="py-2 pl-2 text-right">{action(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const suggestionRows = (lines: SuggestedAllocation[]): Row[] =>
  lines.map((line) => ({
    key: line.invoiceId,
    invoiceNumber: line.invoiceNumber,
    balanceBefore: line.invoiceBalanceBefore,
    amount: line.amount,
    balanceAfter: line.invoiceBalanceAfter,
    rule: line.rule,
  }));

const allocationRows = (allocations: Allocation[]): Row[] =>
  allocations.map((a) => ({
    key: a.id,
    invoiceNumber: a.invoiceNumber,
    balanceBefore: a.invoiceBalanceBefore,
    amount: a.amount,
    balanceAfter: a.invoiceBalanceAfter,
    rule: a.rule,
    reversedAt: a.reversedAt,
  }));

type OpenInvoice = {
  id: string;
  number: string | null;
  dueDate: string | null;
  balance: string;
  disputed: boolean;
};

// The party's invoices that can take money and still owe some, in the
// payment's currency: issued shipper invoices, approved carrier bills.
const useOpenInvoices = (payment: Payment) => {
  const params = {
    page: 1,
    limit: 100,
    paymentStatus: PaymentStatus.Unpaid,
  };
  return useQuery({
    queryKey: ["invoices", payment.direction, "open", payment.partyId],
    queryFn: async ({ signal }): Promise<OpenInvoice[]> => {
      const rows = isIn(payment)
        ? (
            await listCustomerInvoices(
              {
                ...params,
                customerId: payment.partyId,
                status: CustomerInvoiceStatus.Issued,
              },
              signal
            )
          ).items.map((i) => ({ ...i, number: i.invoiceNumber }))
        : (
            await listCarrierInvoices(
              {
                ...params,
                carrierId: payment.partyId,
                status: CarrierInvoiceStatus.Approved,
              },
              signal
            )
          ).items.map((i) => ({ ...i, number: i.referenceNumber }));
      return rows
        .filter(
          (i) =>
            i.kind !== InvoiceKind.CreditNote &&
            i.currency === payment.currency &&
            compareMoney(i.balanceDue, "0.00") > 0
        )
        .map((i) => ({
          id: i.id,
          number: i.number,
          dueDate: i.dueDate,
          balance: i.balanceDue,
          disputed: i.disputed ?? false,
        }));
    },
  });
};

type Amounts = Record<string, string>;

// A payment with money unapplied: apply what matching suggests, or split it
// by hand over the party's open invoices. Whatever is left stays on the
// payment as unapplied credit.
export function AllocateModal({
  payment,
  onClose,
}: {
  payment: Payment;
  onClose: () => void;
}) {
  const suggestion = useQuery({
    queryKey: ["payments", payment.direction, "suggestion", payment.id],
    queryFn: ({ signal }) =>
      getAllocationSuggestion(payment.direction, payment.id, signal),
  });
  const invoices = useOpenInvoices(payment);
  const open = invoices.data ?? [];
  const { control, handleSubmit, setError } = useForm<Amounts>();

  const allocate = usePaymentMutation(
    (allocations: AllocationLine[]) =>
      allocatePayment(payment.direction, payment.id, {
        version: payment.version,
        allocations,
      }),
    (saved) =>
      isZeroMoney(saved.unapplied)
        ? `${saved.number} allocated in full.`
        : `${saved.number} allocated; ${saved.unapplied} ${saved.currency} stays as unapplied credit.`,
    onClose
  );

  const suggested = suggestion.data?.allocations ?? [];
  const disputedSuggested = suggested.filter(
    (line) => open.find((i) => i.id === line.invoiceId)?.disputed
  );

  const applySuggestion = () =>
    allocate.mutate(
      suggested.map((line) => ({
        invoiceId: line.invoiceId,
        amount: line.amount,
        rule: line.rule,
      }))
    );

  const submit = handleSubmit((values) => {
    const lines = open
      .map((invoice) => ({
        invoiceId: invoice.id,
        amount: (values[invoice.id] ?? "").trim(),
      }))
      .filter((line) => line.amount);
    if (lines.length === 0) {
      const [first] = open;
      if (first) {
        setError(first.id, { message: "Enter an amount for at least one invoice" });
      }
      return;
    }
    allocate.mutate(
      lines.map((line) => ({ ...line, rule: AllocationRule.Manual }))
    );
  });

  const validate = (invoice: OpenInvoice) => (raw: string | undefined) => {
    const value = (raw ?? "").trim();
    if (!value) return true;
    if (!AMOUNT.test(value)) return "Enter the amount with cents, e.g. 500.00";
    if (isZeroMoney(value)) return "Enter more than 0.00";
    if (compareMoney(value, invoice.balance) > 0) return "More than the invoice's balance";
    if (compareMoney(value, payment.unapplied) > 0) {
      return "More than the payment's unapplied amount";
    }
    return true;
  };

  return (
    <FormModal
      isOpen
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title="Allocate Payment"
      confirmText="Allocate"
      onConfirm={submit}
      isConfirming={allocate.isPending}
      size="2xl"
    >
      <PaymentSummary payment={payment} />

      {suggestion.isError ? (
        <ErrorState
          message="We couldn't load the suggested match."
          onAction={() => void suggestion.refetch()}
        />
      ) : (
        suggested.length > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base-primary font-semibold">Suggested match</h3>
              <BaseButton
                text="Apply suggestion"
                varient="bordered"
                className="rounded-xl px-3 text-base-primary"
                isLoading={allocate.isPending}
                onPress={applySuggestion}
              />
            </div>
            <AllocationTable rows={suggestionRows(suggested)} currency={payment.currency} />
            {suggestion.data && !isZeroMoney(suggestion.data.leftOver) && (
              <p className="text-xs text-content-5">
                <Money amount={suggestion.data.leftOver} currency={payment.currency} /> would
                stay as unapplied credit.
              </p>
            )}
            {disputedSuggested.length > 0 && (
              <AlertBanner
                message={`${disputedSuggested
                  .map((line) => line.invoiceNumber ?? "An invoice")
                  .join(", ")} is disputed. Check the dispute before applying money to it.`}
              />
            )}
          </div>
        )
      )}

      <div className="flex flex-col gap-3">
        <h3 className="text-base-primary font-semibold">Or allocate by hand</h3>
        {invoices.isError ? (
          <ErrorState
            message="We couldn't load the open invoices."
            onAction={() => void invoices.refetch()}
          />
        ) : invoices.isPending ? (
          <p className="text-sm text-content-5">Loading open invoices…</p>
        ) : open.length === 0 ? (
          <p className="text-sm text-content-5">
            {partyLabel(payment)} has no open {payment.currency} invoices
            {isIn(payment) ? "" : " approved for payment"}.
          </p>
        ) : (
          <>
            {open.map((invoice) => (
              <div
                key={invoice.id}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start"
              >
                <div className="text-xs">
                  <p className="font-semibold">
                    {invoice.number ?? "No number yet"}
                    {invoice.disputed && (
                      <StatusChip text="Disputed" tone="warning" className="ml-2" />
                    )}
                  </p>
                  <p className="text-content-5">
                    Due {formatDate(invoice.dueDate ?? undefined) ?? "—"} · balance{" "}
                    <Money amount={invoice.balance} currency={payment.currency} />
                  </p>
                </div>
                <BaseInput
                  name={invoice.id}
                  control={control}
                  aria-label={`Amount for ${invoice.number ?? "invoice"}`}
                  placeholder="0.00"
                  rules={{ validate: validate(invoice) }}
                />
              </div>
            ))}
            <p className="text-xs text-content-5">
              Less than an invoice&apos;s balance leaves it part paid. The API
              checks the amounts add up to no more than the payment; anything
              left stays as unapplied credit.
            </p>
          </>
        )}
      </div>
    </FormModal>
  );
}

// Where a payment went. Each live allocation can be reversed by a role
// that may void payments: the money goes back to unapplied.
export function ViewAllocationModal({
  payment,
  onClose,
}: {
  payment: Payment;
  onClose: () => void;
}) {
  const { can } = useCan();
  const canVoid = can(
    isIn(payment)
      ? Permission.CustomerPaymentsVoid
      : Permission.CarrierPaymentsVoid
  );
  const reverse = usePaymentMutation(
    (allocationId: string) =>
      reverseAllocation(payment.direction, allocationId, {
        version: payment.version,
      }),
    (saved) => `Allocation reversed: ${saved.unapplied} ${saved.currency} unapplied on ${saved.number}.`,
    onClose
  );

  return (
    <FormModal
      isOpen
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title={`Allocation of ${payment.number}`}
      confirmText="Done"
      size="2xl"
    >
      <PaymentSummary payment={payment} />
      {payment.allocations.length > 0 ? (
        <AllocationTable
          rows={allocationRows(payment.allocations)}
          currency={payment.currency}
          action={
            canVoid && !payment.reversedAt
              ? (row) =>
                  row.reversedAt ? null : (
                    <BaseButton
                      text="Reverse"
                      varient="bordered"
                      className="h-8 rounded-lg px-2 text-xs text-danger"
                      isLoading={reverse.isPending && reverse.variables === row.key}
                      isDisabled={reverse.isPending}
                      onPress={() => reverse.mutate(row.key)}
                    />
                  )
              : undefined
          }
        />
      ) : (
        <p className="text-sm text-content-5">Not allocated to any invoice.</p>
      )}
    </FormModal>
  );
}

// A bounced cheque or the wrong party: the whole payment and every
// allocation are reversed. The record stays, with the reason.
export function ReversePaymentModal({
  payment,
  onClose,
}: {
  payment: Payment;
  onClose: () => void;
}) {
  const { control, handleSubmit } = useForm<{ reason: string }>({
    defaultValues: { reason: "" },
  });
  const reverse = usePaymentMutation(
    (reason: string) =>
      reversePayment(payment.direction, payment.id, {
        version: payment.version,
        reason,
      }),
    (saved) => `${saved.number} reversed.`,
    onClose
  );
  const liveCount = live(payment).length;

  return (
    <FormModal
      isOpen
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title="Reverse Payment"
      confirmText="Reverse Payment"
      onConfirm={handleSubmit((values) => reverse.mutate(values.reason.trim()))}
      isConfirming={reverse.isPending}
    >
      <PaymentSummary payment={payment} />
      <p className="text-sm">
        The payment of{" "}
        <Money amount={payment.amount} currency={payment.currency} /> is
        reversed and kept on record with the reason.
        {liveCount > 0 &&
          ` Its ${liveCount} allocation${liveCount === 1 ? " is" : "s are"} reversed too, so those invoices owe the money again.`}
      </p>
      <BaseInput
        name="reason"
        control={control}
        label="Reason"
        placeholder="Cheque returned NSF"
        rules={{
          validate: (value) => {
            const length = value.trim().length;
            if (length < 3) return "Give a reason (at least 3 characters)";
            return length <= 255 || "At most 255 characters";
          },
        }}
      />
    </FormModal>
  );
}
