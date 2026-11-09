import { Card } from "@heroui/react";
import { useMutation, useQuery, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router";
import { toast } from "sonner";
import {
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
import { formatDate, torontoToday } from "@/lib/utils";
import {
  createInstallmentPlan,
  errorMessage,
  listCarrierInvoices,
  listCustomerInvoices,
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

// A late installment makes the plan late; all paid, it's complete.
const PlanStatus = ({ plan }: { plan: InstallmentPlan }) =>
  plan.installments.some((item) => item.status === InstallmentStatus.Late) ? (
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
  directions,
}: {
  // GET /installment-plan/all: only the sides the role may view.
  query: UseQueryResult<Paginated<InstallmentPlan>>;
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
      case "remaining":
        return <Money amount={plan.remaining} currency={plan.currency} className="font-semibold" />;
      case "next": {
        const next = nextInstallment(plan);
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
            rowKey={(row) => row.id}
            renderCell={renderCell}
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
      title={`Installment Plan ${plan.id}`}
      confirmText="Done"
      size="xl"
    >
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
              <InstallmentChip status={item.status} />
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
  direction: string;
  party: string;
  count: string;
  firstDue: string;
  frequency: string;
};

type OwingInvoice = {
  id: string;
  number: string | null;
  dueDate: string | null;
  balance: string;
  currency: Currency;
};

const directionOptions = {
  [PaymentDirection.In]: { key: "IN", label: "Money in (a shipper pays)", value: "IN" },
  [PaymentDirection.Out]: { key: "OUT", label: "Money out (MGC pays a carrier)", value: "OUT" },
};

const frequencyOptions = [
  { key: InstallmentFrequency.Weekly, label: "Weekly", value: InstallmentFrequency.Weekly },
  { key: InstallmentFrequency.Biweekly, label: "Every 2 weeks", value: InstallmentFrequency.Biweekly },
  { key: InstallmentFrequency.Monthly, label: "Monthly", value: InstallmentFrequency.Monthly },
];

// The party's invoices a plan can take: owing, not credit notes; issued
// shipper invoices, or received, on-hold or approved carrier bills.
const useOwingInvoices = (direction: PaymentDirection, partyId: string) =>
  useQuery({
    queryKey: ["invoices", direction, "owing", partyId],
    enabled: !!partyId,
    queryFn: async ({ signal }): Promise<OwingInvoice[]> => {
      const base = { page: 1, limit: 100, paymentStatus: PaymentStatus.Unpaid };
      const rows =
        direction === PaymentDirection.In
          ? (
              await listCustomerInvoices(
                { ...base, customerId: partyId, status: CustomerInvoiceStatus.Issued },
                signal
              )
            ).items.map((i) => ({ ...i, number: i.invoiceNumber }))
          : (
              await Promise.all(
                [
                  CarrierInvoiceStatus.Received,
                  CarrierInvoiceStatus.OnHold,
                  CarrierInvoiceStatus.Approved,
                ].map((status) =>
                  listCarrierInvoices({ ...base, carrierId: partyId, status }, signal)
                )
              )
            )
              .flatMap((page) => page.items)
              .map((i) => ({ ...i, number: i.referenceNumber }));
      return rows
        .filter((i) => i.kind !== InvoiceKind.CreditNote && compareMoney(i.balanceDue, "0.00") > 0)
        .map((i) => ({
          id: i.id,
          number: i.number,
          dueDate: i.dueDate,
          balance: i.balanceDue,
          currency: i.currency,
        }));
    },
  });

function NewPlanModal({
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
  const direction = useWatch({ control, name: "direction" }) as PaymentDirection;
  const partyId = useWatch({ control, name: "party" });
  // Ticked invoices belong to the party they were ticked for: choosing
  // another party starts with none.
  const [ticked, setTicked] = useState<{ partyId: string; ids: string[] }>({
    partyId: "",
    ids: [],
  });
  const chosen = ticked.partyId === partyId ? ticked.ids : [];
  const setChosen = (update: (prev: string[]) => string[]) =>
    setTicked({ partyId, ids: update(chosen) });
  const [chosenError, setChosenError] = useState<string | null>(null);
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
        frequency: values.frequency as InstallmentFrequency,
        firstDueDate: values.firstDue,
      }),
    onSuccess: (plan) => {
      toast.success(`Installment plan ${plan.id} agreed: ${plan.installments.length} installments.`);
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
          rules={{
            required: "Choose the first due date",
            validate: (value) => value >= torontoToday() || "Today or later",
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
