import { Card } from "@heroui/react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  BaseButton,
  BaseInput,
  BaseSelect,
  BaseTable,
  DirectionChip,
  FormModal,
  Money,
  PartyAvatar,
  RowActions,
  StatusChip,
} from "@/components/common";
import { Add } from "@/components/icons";
import { InstallmentStatus, PaymentDirection } from "@/lib/enums";
import { Installment, InstallmentPlan } from "@/lib/interfaces";
import { mockCarriers, mockShippers } from "@/lib/mock";
import { BaseTableColumn } from "@/lib/types";
import { formatDate } from "@/lib/utils";

// Plans to pay invoices in parts (requirement 3). Mock data: creating a plan
// is a demo.

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

const columns: BaseTableColumn[] = [
  { key: "party", label: "Party" },
  { key: "direction", label: "Direction" },
  { key: "invoices", label: "Invoices" },
  { key: "total", label: "Total", align: "end" },
  { key: "paid", label: "Paid", align: "end" },
  { key: "remaining", label: "Remaining", align: "end" },
  { key: "next", label: "Next Installment" },
  { key: "status", label: "Status" },
  { key: "actions", label: "" },
];

export default function InstallmentPlans({
  plans,
  directions,
}: {
  // Only the sides the role may view.
  plans: InstallmentPlan[];
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
        return <span className="font-mono">{plan.invoiceNumbers.join(", ")}</span>;
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
            actions={[{ key: "schedule", label: "View schedule", onPress: () => setViewing(plan) }]}
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
        <BaseTable
          ariaLabel="Installment plans"
          columns={columns}
          data={plans}
          rowKey={(row) => row.id}
          renderCell={renderCell}
          emptyContent="No installment plans"
        />
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
      <p className="text-sm text-[#707070]">
        {plan.partyName} · {plan.invoiceNumbers.join(", ")} · total{" "}
        <Money amount={plan.total} currency={plan.currency} /> · remaining{" "}
        <Money amount={plan.remaining} currency={plan.currency} />
      </p>
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
    </FormModal>
  );
}

type PlanValues = {
  direction: string;
  party: string;
  invoiceNumbers: string;
  count: string;
  firstDue: string;
  frequency: string;
};

const directionOptions = {
  [PaymentDirection.In]: { key: "IN", label: "Money in (a shipper pays)", value: "IN" },
  [PaymentDirection.Out]: { key: "OUT", label: "Money out (MGC pays a carrier)", value: "OUT" },
};

const frequencyOptions = [
  { key: "WEEKLY", label: "Weekly", value: "WEEKLY" },
  { key: "BIWEEKLY", label: "Every 2 weeks", value: "BIWEEKLY" },
  { key: "MONTHLY", label: "Monthly", value: "MONTHLY" },
];

// One or more invoice numbers, comma-separated: INV-10426, CINV-10426, INV-10422a.
const INVOICE_LIST = /^[A-Z]+-\d+[a-z]?(\s*,\s*[A-Z]+-\d+[a-z]?)*$/;

function NewPlanModal({
  directions,
  onClose,
}: {
  directions: PaymentDirection[];
  onClose: () => void;
}) {
  const { control, handleSubmit, setValue } = useForm<PlanValues>({
    defaultValues: {
      direction: directions[0],
      party: "",
      invoiceNumbers: "",
      count: "3",
      firstDue: "",
      frequency: "BIWEEKLY",
    },
  });
  const direction = useWatch({ control, name: "direction" });
  // A shipper chosen before switching to "Money out" is not a carrier, so
  // the choice is cleared rather than submitted against the wrong list.
  useEffect(() => {
    setValue("party", "");
  }, [direction, setValue]);
  const parties = (direction === PaymentDirection.Out ? mockCarriers : mockShippers).map(
    (party) => ({ key: party.id, label: party.name, value: party.id })
  );

  const submit = handleSubmit(() => {
    toast.info("Installment plan created — demo only, nothing was saved.");
    onClose();
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="New Installment Plan"
      confirmText="Create Plan"
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
        <BaseSelect
          className="sm:col-span-2"
          name="party"
          control={control}
          label={direction === PaymentDirection.Out ? "Carrier" : "Shipper"}
          options={parties}
          rules={{ required: "Choose who the plan is with" }}
        />
        <BaseInput
          className="sm:col-span-2"
          name="invoiceNumbers"
          control={control}
          label="Invoices"
          placeholder="INV-10426, INV-10428"
          rules={{
            required: "Enter at least one invoice number",
            pattern: { value: INVOICE_LIST, message: "Invoice numbers separated by commas" },
          }}
        />
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
          rules={{ required: "Choose the first due date" }}
        />
      </div>
      <p className="text-xs text-content-5">
        The API splits the invoices&apos; open balance into the installments;
        no amount is worked out here.
      </p>
    </FormModal>
  );
}
