import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseInput,
  FormModal,
  Money,
  StatusChip,
} from "@/components/common";
import {
  AllocationRule,
  DisputeStatus,
  InvoiceStatus,
  PaymentDirection,
} from "@/lib/enums";
import { Allocation, Invoice, Payment } from "@/lib/interfaces";
import {
  mockCarrierInvoices,
  mockDisputes,
  mockShipperInvoices,
} from "@/lib/mock";
import { compareMoney, isZeroMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

// Allocating a payment to invoices (design §8.5): the auto-match suggestion,
// a manual split, and the read-only view of where a payment went. Nothing is
// saved: every confirm is a demo.

export const allocationRuleLabels: Record<AllocationRule, string> = {
  [AllocationRule.InvoiceNumber]: "Invoice # in reference",
  [AllocationRule.ExactAmount]: "Exact amount",
  [AllocationRule.OldestOpen]: "Oldest open invoice",
  [AllocationRule.Manual]: "Manual",
};

// How a payment was matched: each rule its allocations used, once.
export const matchedBy = (payment: Payment) =>
  [...new Set(payment.allocations.map((a) => a.rule))]
    .map((rule) => allocationRuleLabels[rule])
    .join(", ");

const AMOUNT = /^\d{1,9}\.\d{2}$/;

const isOpenDispute = (invoiceNumber: string) =>
  mockDisputes.some(
    (dispute) =>
      dispute.invoiceNumber === invoiceNumber &&
      dispute.status === DisputeStatus.Open
  );

// The party's invoices that still owe something, in the payment's currency.
const openInvoicesFor = (payment: Payment): Invoice[] =>
  (payment.direction === PaymentDirection.In
    ? mockShipperInvoices
    : mockCarrierInvoices
  ).filter(
    (invoice) =>
      invoice.partyName === payment.partyName &&
      invoice.currency === payment.currency &&
      ![InvoiceStatus.Draft, InvoiceStatus.Void, InvoiceStatus.Superseded].includes(
        invoice.status
      ) &&
      !isZeroMoney(invoice.balance)
  );

// Each allocation with the invoice's balance before and after it. A part
// payment leaves the invoice part paid.
function AllocationList({
  allocations,
  payment,
}: {
  allocations: Allocation[];
  payment: Payment;
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
          </tr>
        </thead>
        <tbody>
          {allocations.map((allocation) => (
            <tr key={allocation.invoiceNumber}>
              <td className="py-2 pr-3 font-semibold">{allocation.invoiceNumber}</td>
              <td className="py-2 px-2 text-right">
                <Money amount={allocation.invoiceBalanceBefore} currency={payment.currency} />
              </td>
              <td className="py-2 px-2 text-right">
                <Money amount={allocation.amount} currency={payment.currency} className="font-semibold" />
              </td>
              <td className="py-2 px-2 text-right">
                <div className="flex flex-col items-end gap-1">
                  <Money amount={allocation.invoiceBalanceAfter} currency={payment.currency} />
                  {isZeroMoney(allocation.invoiceBalanceAfter) ? (
                    <StatusChip text="Paid" tone="success" />
                  ) : (
                    <StatusChip text="Part paid" tone="secondary" />
                  )}
                </div>
              </td>
              <td className="py-2 pl-2">{allocationRuleLabels[allocation.rule]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentSummary({ payment }: { payment: Payment }) {
  return (
    <p className="text-sm text-[#707070]">
      {payment.number} · {payment.partyName} · paid{" "}
      {formatDate(payment.paidOn)} · unapplied{" "}
      <Money amount={payment.unapplied} currency={payment.currency} />
    </p>
  );
}

type Amounts = Record<string, string>;

// An unmatched payment: apply what auto-matching suggests, or split it by
// hand over the party's open invoices. Each amount is checked against the
// invoice's balance and the payment's unapplied amount here; the API checks
// that the amounts add up to no more than the payment.
export function AllocateModal({
  payment,
  onClose,
}: {
  payment: Payment;
  onClose: () => void;
}) {
  const invoices = openInvoicesFor(payment);
  const { control, handleSubmit, setError } = useForm<Amounts>({
    defaultValues: Object.fromEntries(invoices.map((invoice) => [invoice.id, ""])),
  });
  const disputed = payment.suggested.filter((a) => isOpenDispute(a.invoiceNumber));

  const applySuggestion = () => {
    toast.info("Suggested allocation applied — demo only, nothing was saved.");
    onClose();
  };

  const submit = handleSubmit((values) => {
    if (!Object.values(values).some((value) => value.trim())) {
      const [first] = invoices;
      if (first) setError(first.id, { message: "Enter an amount for at least one invoice" });
      return;
    }
    toast.info("Payment allocated — demo only, nothing was saved.");
    onClose();
  });

  const validate = (invoice: Invoice) => (raw: string) => {
    const value = raw.trim();
    if (!value) return true;
    if (!AMOUNT.test(value)) return "Enter the amount with cents, e.g. 500.00";
    if (isZeroMoney(value)) return "Enter more than 0.00";
    if (compareMoney(value, invoice.balance) > 0) return "More than the invoice's balance";
    if (compareMoney(value, payment.unapplied) > 0) return "More than the payment's unapplied amount";
    return true;
  };

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Allocate Payment"
      confirmText="Allocate"
      onConfirm={submit}
      size="2xl"
    >
      <PaymentSummary payment={payment} />

      {payment.suggested.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base-primary font-semibold">Suggested match</h3>
            <BaseButton
              text="Apply suggestion"
              varient="bordered"
              className="rounded-xl px-3 text-base-primary"
              onPress={applySuggestion}
            />
          </div>
          <AllocationList allocations={payment.suggested} payment={payment} />
          {disputed.length > 0 && (
            <AlertBanner
              message={`${disputed.map((a) => a.invoiceNumber).join(", ")} is disputed. Check the dispute before applying money to it.`}
            />
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="text-base-primary font-semibold">Or allocate by hand</h3>
        {invoices.length === 0 ? (
          <p className="text-sm text-content-5">
            {payment.partyName} has no open {payment.currency} invoices.
          </p>
        ) : (
          <>
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start"
              >
                <div className="text-xs">
                  <p className="font-semibold">
                    {invoice.number}
                    {isOpenDispute(invoice.number) && (
                      <StatusChip text="Disputed" tone="warning" className="ml-2" />
                    )}
                  </p>
                  <p className="text-content-5">
                    Due {formatDate(invoice.dueDate)} · balance{" "}
                    <Money amount={invoice.balance} currency={invoice.currency} />
                  </p>
                </div>
                <BaseInput
                  name={invoice.id}
                  control={control}
                  aria-label={`Amount for ${invoice.number}`}
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

// Where a matched payment went. Read-only.
export function ViewAllocationModal({
  payment,
  onClose,
}: {
  payment: Payment;
  onClose: () => void;
}) {
  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`Allocation of ${payment.number}`}
      confirmText="Done"
      onConfirm={onClose}
      size="2xl"
    >
      <PaymentSummary payment={payment} />
      {payment.allocations.length > 0 ? (
        <AllocationList allocations={payment.allocations} payment={payment} />
      ) : (
        <p className="text-sm text-content-5">Not allocated to any invoice.</p>
      )}
    </FormModal>
  );
}

// Leaves an unmatched payment on the party's account, to allocate later.
export function UnappliedCreditModal({
  payment,
  onClose,
}: {
  payment: Payment;
  onClose: () => void;
}) {
  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Keep as Unapplied Credit"
      confirmText="Keep as Credit"
      onConfirm={() => {
        toast.info("Unapplied credit — demo only, nothing was saved.");
        onClose();
      }}
    >
      <PaymentSummary payment={payment} />
      <p className="text-sm">
        The payment stays on {payment.partyName}&apos;s account as credit and
        leaves the Unmatched list. It can be allocated to an invoice later.
      </p>
    </FormModal>
  );
}
