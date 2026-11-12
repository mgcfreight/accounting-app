import { Card } from "@heroui/react";
import { useMutation, useQuery, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseCheckbox,
  BaseInput,
  BaseSelect,
  BaseTable,
  DirectionChip,
  ErrorState,
  FormModal,
  Money,
  PartyAvatar,
  RowActions,
  StatusChip,
} from "@/components/common";
import { Add, EyeIcon } from "@/components/icons";
import {
  CarrierInvoiceStatus,
  Currency,
  CustomerInvoiceStatus,
  InstallmentFrequency,
  InstallmentPlanAttention,
  InstallmentStatus,
  InvoiceDirection,
  InvoiceKind,
  PartyType,
  PaymentDirection,
  PaymentStatus,
} from "@/lib/enums";
import { Installment, InstallmentPlan, Paginated } from "@/lib/interfaces";
import { compareMoney } from "@/lib/money";
import { BaseTableColumn } from "@/lib/types";
import { addMonths, formatDate, torontoToday } from "@/lib/utils";
import { useServerPaging } from "@/hooks";
import {
  createInstallmentPlan,
  errorMessage,
  listCarrierInvoices,
  listCustomerInvoices,
  readAllPages,
} from "@/services";
import { invoiceListHref } from "../invoices/invoice-view";
import PartyPicker from "../shipments/party-picker";

// Plans to pay invoices in parts (requirement 3), on the API: it splits the
// invoices' open balance and says where each plan stands. Nothing is worked
// out here.

const installmentStatus: Record<
  InstallmentStatus,
  { label: string; tone: "success" | "secondary" | "danger" }
> = {
  [InstallmentStatus.Paid]: { label: "Paid", tone: "success" },
  [InstallmentStatus.Due]: { label: "Due", tone: "secondary" },
  [InstallmentStatus.Late]: { label: "Late", tone: "danger" },
};

const InstallmentChip = ({ status }: { status: InstallmentStatus }) => (
  <StatusChip text={installmentStatus[status].label} tone={installmentStatus[status].tone} />
);

const nextInstallment = (plan: InstallmentPlan): Installment | undefined =>
  plan.installments.find((item) => item.status !== InstallmentStatus.Paid);

const attentionReason: Record<InstallmentPlanAttention, string> = {
  [InstallmentPlanAttention.InvoiceVoided]: "An invoice in this plan was voided.",
  [InstallmentPlanAttention.AmountChanged]: "An invoice in this plan was revised to a different total.",
};

// Why the plan's figures can't be taken as they stand, in words staff read.
const attentionText = (plan: InstallmentPlan) =>
  plan.attention.map((item) => attentionReason[item]).join(" ");

// Cancelled comes before everything: the API still works out paid, late and
// due for a cancelled plan, but none of it is agreed any more. Then a voided
// or re-totalled invoice: the plan's remaining and its late or on-track
// status no longer mean what they say. Otherwise a late installment makes
// the plan late; all paid, it's complete.
const PlanStatus = ({ plan }: { plan: InstallmentPlan }) =>
  plan.cancelledAt ? (
    <span title={plan.cancelReason ?? undefined}>
      <StatusChip text="Cancelled" tone="secondary" />
    </span>
  ) : plan.attention.length > 0 ? (
    <span title={attentionText(plan)}>
      <StatusChip text="Needs attention" tone="warning" />
    </span>
  ) : plan.installments.some((item) => item.status === InstallmentStatus.Late) ? (
    <StatusChip text="Late" tone="danger" />
  ) : nextInstallment(plan) ? (
    <StatusChip text="On track" tone="primary" />
  ) : (
    <StatusChip text="Completed" tone="success" />
  );

const invoiceDirection = (direction: PaymentDirection) =>
  direction === PaymentDirection.In ? InvoiceDirection.Receivable : InvoiceDirection.Payable;

function InvoiceLinks({ plan }: { plan: InstallmentPlan }) {
  const list = invoiceListHref(invoiceDirection(plan.direction));
  return (
    <span className="flex flex-wrap gap-x-2 font-mono">
      {plan.invoices.map((invoice) => (
        <Link
          key={invoice.id}
          to={`${list}view/?id=${encodeURIComponent(invoice.id)}`}
          className="text-base-primary-300 hover:underline whitespace-nowrap"
        >
          {invoice.number ?? "No number yet"}
        </Link>
      ))}
    </span>
  );
}

const columns: BaseTableColumn[] = [
  { key: "party", label: "Party" },
  { key: "direction", label: "Direction" },
  { key: "invoices", label: "Invoices" },
  { key: "total", label: "Total", align: "end" },
  { key: "paid", label: "Paid", align: "end" },
  { key: "remaining", label: "Remaining", align: "end" },
  { key: "next", label: "Next Installment" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", align: "center" },
];

export default function InstallmentPlans({
  query,
  paging,
  directions,
}: {
  // GET /installment-plan/all: only the sides the role may view.
  query: UseQueryResult<Paginated<InstallmentPlan>>;
  // Its page, from useServerPaging.
  paging: Pick<ReturnType<typeof useServerPaging>, "tableMeta" | "setMeta">;
  // The sides the role may record payments for.
  directions: PaymentDirection[];
}) {
  const [viewing, setViewing] = useState<InstallmentPlan | null>(null);
  const [creating, setCreating] = useState(false);

  const renderCell = (plan: InstallmentPlan, key: string) => {
    switch (key) {
      case "party":
        return (
          <PartyAvatar
            name={plan.partyName}
            subtitle={`Agreed ${formatDate(plan.agreedOn)}`}
            tone={plan.direction === PaymentDirection.In ? "success" : "primary"}
          />
        );
      case "direction":
        return <DirectionChip direction={plan.direction} />;
      case "invoices":
        return <InvoiceLinks plan={plan} />;
      case "total":
        return <Money amount={plan.total} currency={plan.currency} />;
      case "paid":
        return <Money amount={plan.paid} currency={plan.currency} />;
      // A cancelled plan's remaining is still owed, on the invoices' own due
      // dates (product, Q17); it just has no next installment.
      case "remaining":
        return <Money amount={plan.remaining} currency={plan.currency} className="font-semibold" />;
      case "next": {
        const next = plan.cancelledAt ? undefined : nextInstallment(plan);
        return next ? (
          <span className="whitespace-nowrap">
            {formatDate(next.dueDate)} ·{" "}
            <Money amount={next.amount} currency={plan.currency} />
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        );
      }
      case "status":
        return <PlanStatus plan={plan} />;
      case "actions":
        return (
          <RowActions
            actions={[{ key: "schedule", label: "View schedule", icon: <EyeIcon />, onPress: () => setViewing(plan) }]}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {directions.length > 0 && (
        <div className="flex justify-end">
          <BaseButton
            text="New Installment Plan"
            className="rounded-xl px-4"
            startContent={<Add />}
            onPress={() => setCreating(true)}
          />
        </div>
      )}
      <Card>
        {query.isError ? (
          <ErrorState message={errorMessage(query.error)} onAction={() => void query.refetch()} />
        ) : (
          <BaseTable<InstallmentPlan>
            ariaLabel="Installment plans"
            columns={columns}
            data={query.data?.items ?? []}
            loading={query.isPending}
            refreshing={query.isPlaceholderData}
            rowKey={(row) => row.id}
            renderCell={renderCell}
            meta={paging.tableMeta(query.data?.meta)}
            setMeta={paging.setMeta}
            bottomContent="Plans"
            emptyContent="No installment plans"
          />
        )}
      </Card>
      {viewing && <ScheduleModal plan={viewing} onClose={() => setViewing(null)} />}
      {creating && (
        <NewPlanModal directions={directions} onClose={() => setCreating(false)} />
      )}
    </>
  );
}

function ScheduleModal({ plan, onClose }: { plan: InstallmentPlan; onClose: () => void }) {
  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`Installment Plan · ${plan.partyName}`}
      confirmText="Done"
      size="xl"
    >
      {plan.cancelledAt && (
        <AlertBanner
          message={`Cancelled ${formatDate(plan.cancelledAt)}${plan.cancelReason ? `: ${plan.cancelReason}` : "."} The remaining amount is owed on the invoices' own due dates.`}
        />
      )}
      {!plan.cancelledAt && plan.attention.length > 0 && (
        <AlertBanner
          message={`Needs attention. ${attentionText(plan)} The paid, remaining and installment figures below may no longer be right.`}
        />
      )}
      <div className="text-sm text-[#707070] flex flex-col gap-1">
        <span>
          {plan.partyName} · total <Money amount={plan.total} currency={plan.currency} /> ·
          paid <Money amount={plan.paid} currency={plan.currency} /> · remaining{" "}
          <Money amount={plan.remaining} currency={plan.currency} />
        </span>
        <InvoiceLinks plan={plan} />
      </div>
      <ol className="flex flex-col gap-3">
        {plan.installments.map((item) => (
          <li key={item.number} className="flex flex-wrap justify-between items-center gap-3 text-sm">
            <span>
              <strong>#{item.number}</strong> due {formatDate(item.dueDate)}
              {item.paidOn && (
                <span className="text-content-5"> · paid {formatDate(item.paidOn)}</span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <Money amount={item.amount} currency={plan.currency} />
              {!plan.cancelledAt && <InstallmentChip status={item.status} />}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-content-5">
        Paid is what these invoices came down since the plan was agreed (payments,
        credit notes, write-offs); installments are paid in order.
      </p>
    </FormModal>
  );
}

type PlanValues = {
  direction: PaymentDirection;
  party: string;
  count: string;
  firstDue: string;
  frequency: InstallmentFrequency;
};

type OwingInvoice = {
  id: string;
  number: string | null;
  dueDate: string | null;
  balance: string;
  currency: Currency;
  disputed: boolean;
};

const directionOptions = {
  [PaymentDirection.In]: {
    key: PaymentDirection.In,
    label: "Money in (a shipper pays)",
    value: PaymentDirection.In,
  },
  [PaymentDirection.Out]: {
    key: PaymentDirection.Out,
    label: "Money out (MGC pays a carrier)",
    value: PaymentDirection.Out,
  },
};

const TOO_MANY_OWING =
  "This party has too many unpaid invoices to list here. Ask for help with this plan.";

const frequencyOptions = [
  { key: InstallmentFrequency.Weekly, label: "Weekly", value: InstallmentFrequency.Weekly },
  { key: InstallmentFrequency.Biweekly, label: "Every 2 weeks", value: InstallmentFrequency.Biweekly },
  { key: InstallmentFrequency.Monthly, label: "Monthly", value: InstallmentFrequency.Monthly },
];

// The API's limits on a new plan (CreateInstallmentPlanDto and the service
// in mgcfreight/accounting#78), checked here for a clearer message.
const MAX_PLAN_INVOICES = 20;
const MAX_FIRST_DUE_MONTHS = 12;

// The party's invoices a plan can take: owing, not credit notes; issued
// shipper invoices, or approved carrier bills (the API refuses an unapproved
// bill, whose amount is still in question). Every page, so a party with more
// than 100 loses none.
const useOwingInvoices = (direction: PaymentDirection, partyId: string) =>
  useQuery({
    queryKey: ["invoices", direction, "owing", partyId],
    enabled: !!partyId,
    queryFn: async ({ signal }): Promise<OwingInvoice[]> => {
      const base = { limit: 100, paymentStatus: PaymentStatus.Unpaid };
      const rows =
        direction === PaymentDirection.In
          ? (
              await readAllPages(
                (page) =>
                  listCustomerInvoices(
                    { ...base, page, customerId: partyId, status: CustomerInvoiceStatus.Issued },
                    signal
                  ),
                TOO_MANY_OWING
              )
            ).map((i) => ({ ...i, number: i.invoiceNumber }))
          : (
              await readAllPages(
                (page) =>
                  listCarrierInvoices(
                    { ...base, page, carrierId: partyId, status: CarrierInvoiceStatus.Approved },
                    signal
                  ),
                TOO_MANY_OWING
              )
            ).map((i) => ({ ...i, number: i.referenceNumber }));
      return rows
        .filter((i) => i.kind !== InvoiceKind.CreditNote && compareMoney(i.balanceDue, "0.00") > 0)
        .map((i) => ({
          id: i.id,
          number: i.number,
          dueDate: i.dueDate,
          balance: i.balanceDue,
          currency: i.currency,
          disputed: i.disputed ?? false,
        }));
    },
  });

export function NewPlanModal({
  directions,
  onClose,
}: {
  directions: PaymentDirection[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { control, handleSubmit, setValue } = useForm<PlanValues>({
    defaultValues: {
      direction: directions[0],
      party: "",
      count: "3",
      firstDue: torontoToday(),
      frequency: InstallmentFrequency.Biweekly,
    },
  });
  const direction = useWatch({ control, name: "direction" });
  const partyId = useWatch({ control, name: "party" });
  // Ticked invoices belong to the party they were ticked for: choosing
  // another party (or direction, which clears the party) starts with none,
  // and so does coming back to the first.
  const [ticked, setTicked] = useState<{ partyId: string; ids: string[] }>({
    partyId: "",
    ids: [],
  });
  if (ticked.partyId !== partyId) setTicked({ partyId, ids: [] });
  const chosen = ticked.partyId === partyId ? ticked.ids : [];
  const [chosenError, setChosenError] = useState<string | null>(null);
  // Ticking clears a message about the choice: it may be fixed now.
  const setChosen = (update: (prev: string[]) => string[]) => {
    setTicked({ partyId, ids: update(chosen) });
    setChosenError(null);
  };
  // A shipper chosen before switching to "Money out" is not a carrier, so
  // the choice is cleared rather than submitted against the wrong side.
  useEffect(() => {
    setValue("party", "");
  }, [direction, setValue]);

  const invoices = useOwingInvoices(direction, partyId);
  const currencies = new Set(
    (invoices.data ?? []).filter((i) => chosen.includes(i.id)).map((i) => i.currency)
  );

  const create = useMutation({
    mutationFn: (values: PlanValues) =>
      createInstallmentPlan({
        direction,
        partyId: values.party,
        invoiceIds: chosen,
        count: Number(values.count),
        frequency: values.frequency,
        firstDueDate: values.firstDue,
      }),
    onSuccess: (plan) => {
      const numbers = plan.invoices.map((invoice) => invoice.number ?? "an invoice").join(", ");
      toast.success(
        `Plan agreed with ${plan.partyName} for ${numbers}: ${plan.installments.length} installments.`
      );
      void queryClient.invalidateQueries({ queryKey: ["installment-plans"] });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const submit = handleSubmit((values) => {
    if (chosen.length === 0) {
      setChosenError("Choose at least one invoice");
      return;
    }
    if (chosen.length > MAX_PLAN_INVOICES) {
      setChosenError(`A plan takes at most ${MAX_PLAN_INVOICES} invoices`);
      return;
    }
    if (currencies.size > 1) {
      setChosenError("A plan is in one currency: choose invoices in the same currency");
      return;
    }
    setChosenError(null);
    create.mutate(values);
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="New Installment Plan"
      confirmText="Create Plan"
      isConfirming={create.isPending}
      onConfirm={submit}
      size="xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BaseSelect
          className="sm:col-span-2"
          name="direction"
          control={control}
          label="Direction"
          options={directions.map((item) => directionOptions[item])}
          disallowEmptySelection
        />
        <div className="sm:col-span-2">
          <PartyPicker
            key={direction}
            control={control}
            name="party"
            type={direction === PaymentDirection.Out ? PartyType.Carrier : PartyType.Shipper}
            label={direction === PaymentDirection.Out ? "Carrier" : "Shipper"}
            isRequired
          />
        </div>
        <div className="sm:col-span-2 flex flex-col gap-2">
          <p className="text-sm font-semibold text-base-primary-900">Invoices</p>
          {!partyId ? (
            <p className="text-xs text-content-5">Choose who the plan is with first.</p>
          ) : invoices.isError ? (
            <p className="text-sm text-base-danger">
              Couldn&apos;t load the invoices.{" "}
              <button type="button" className="underline" onClick={() => void invoices.refetch()}>
                Try again
              </button>
            </p>
          ) : invoices.isPending ? (
            <p className="text-xs text-content-5">Loading invoices…</p>
          ) : invoices.data.length === 0 ? (
            <p className="text-xs text-content-5">Nothing owing that a plan can take.</p>
          ) : (
            <ul className="flex flex-col gap-1 max-h-56 overflow-y-auto">
              {invoices.data.map((invoice) => (
                <li key={invoice.id}>
                  <BaseCheckbox
                    isSelected={chosen.includes(invoice.id)}
                    onValueChange={(on) =>
                      setChosen((prev) =>
                        on ? [...prev, invoice.id] : prev.filter((id) => id !== invoice.id)
                      )
                    }
                  >
                    <span className="text-sm">
                      <span className="font-mono">{invoice.number ?? "No number yet"}</span>
                      {invoice.dueDate && ` · due ${formatDate(invoice.dueDate)}`} · owing{" "}
                      <Money amount={invoice.balance} currency={invoice.currency} />
                      {invoice.disputed && (
                        <StatusChip text="Disputed" tone="warning" className="ml-2" />
                      )}
                    </span>
                  </BaseCheckbox>
                </li>
              ))}
            </ul>
          )}
          {chosenError && <p className="text-xs text-base-danger">{chosenError}</p>}
        </div>
        <BaseInput
          name="count"
          control={control}
          type="number"
          label="Number of installments"
          rules={{
            required: "Enter how many",
            validate: (value) =>
              (/^\d{1,2}$/.test(value) && +value >= 2 && +value <= 12) ||
              "A whole number from 2 to 12",
          }}
        />
        <BaseSelect
          name="frequency"
          control={control}
          label="Frequency"
          options={frequencyOptions}
          disallowEmptySelection
        />
        <BaseInput
          name="firstDue"
          control={control}
          type="date"
          label="First installment due"
          placeholder=" "
          min={torontoToday()}
          max={addMonths(torontoToday(), MAX_FIRST_DUE_MONTHS)}
          rules={{
            required: "Choose the first due date",
            validate: (value) =>
              value < torontoToday()
                ? "Today or later"
                : value > addMonths(torontoToday(), MAX_FIRST_DUE_MONTHS)
                  ? "No more than a year from today"
                  : true,
          }}
        />
      </div>
      <p className="text-xs text-content-5">
        The API splits the chosen invoices&apos; open balance into the installments
        (the last one takes any cents left over); nothing is worked out here.
      </p>
    </FormModal>
  );
}
