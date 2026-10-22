import {
  InvoiceStatus,
  MatchStatus,
  PaymentDirection,
  SyncRunStatus,
} from "@/lib/enums";
import StatusChip, { ChipTone } from "./status-chip";

// One chip per status, so every table and detail page shows a status the same
// way. Overdue and Disputed are flags, not statuses (design §7), so they get
// their own chip beside the status.

const invoiceStatus: Record<InvoiceStatus, { label: string; tone: ChipTone }> =
  {
    [InvoiceStatus.Draft]: { label: "Draft", tone: "neutral" },
    [InvoiceStatus.Issued]: { label: "Issued", tone: "primary" },
    [InvoiceStatus.PartiallyPaid]: { label: "Partially paid", tone: "secondary" },
    [InvoiceStatus.Paid]: { label: "Paid", tone: "success" },
    [InvoiceStatus.Void]: { label: "Void", tone: "neutral" },
    [InvoiceStatus.WrittenOff]: { label: "Written off", tone: "neutral" },
  };

export const InvoiceStatusChip = ({ status }: { status: InvoiceStatus }) => (
  <StatusChip
    text={invoiceStatus[status].label}
    tone={invoiceStatus[status].tone}
  />
);

export const InvoiceFlags = ({
  overdueDays,
  disputed,
}: {
  overdueDays: number;
  disputed: boolean;
}) => (
  <div className="flex flex-wrap gap-1">
    {overdueDays > 0 && (
      <StatusChip text={`Overdue ${overdueDays}d`} tone="danger" />
    )}
    {disputed && <StatusChip text="Disputed" tone="warning" />}
  </div>
);

const matchStatus: Record<MatchStatus, { label: string; tone: ChipTone }> = {
  [MatchStatus.Matched]: { label: "Matched", tone: "success" },
  [MatchStatus.Partial]: { label: "Partly matched", tone: "secondary" },
  [MatchStatus.Unmatched]: { label: "Unmatched", tone: "warning" },
};

export const MatchStatusChip = ({ status }: { status: MatchStatus }) => (
  <StatusChip text={matchStatus[status].label} tone={matchStatus[status].tone} />
);

export const DirectionChip = ({
  direction,
}: {
  direction: PaymentDirection;
}) =>
  direction === PaymentDirection.In ? (
    <StatusChip text="Money in" tone="success" />
  ) : (
    <StatusChip text="Money out" tone="primary" />
  );

const syncStatus: Record<SyncRunStatus, { label: string; tone: ChipTone }> = {
  [SyncRunStatus.Success]: { label: "Success", tone: "success" },
  [SyncRunStatus.Failed]: { label: "Failed", tone: "danger" },
  [SyncRunStatus.Running]: { label: "Running", tone: "secondary" },
};

export const SyncStatusChip = ({ status }: { status: SyncRunStatus }) => (
  <StatusChip text={syncStatus[status].label} tone={syncStatus[status].tone} />
);
