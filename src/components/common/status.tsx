import {
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  InvoiceStatus,
  MatchStatus,
  PaymentDirection,
  PaymentStatus,
  SyncInboxStatus,
} from "@/lib/enums";
import { isZeroMoney } from "@/lib/money";
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
    [InvoiceStatus.Superseded]: { label: "Replaced", tone: "neutral" },
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

const syncStatus: Record<SyncInboxStatus, { label: string; tone: ChipTone }> =
  {
    [SyncInboxStatus.Received]: { label: "Waiting", tone: "secondary" },
    [SyncInboxStatus.Applied]: { label: "Applied", tone: "success" },
    [SyncInboxStatus.Skipped]: { label: "Skipped", tone: "neutral" },
    [SyncInboxStatus.Failed]: { label: "Held", tone: "danger" },
  };

export const SyncStatusChip = ({ status }: { status: SyncInboxStatus }) => (
  <StatusChip text={syncStatus[status].label} tone={syncStatus[status].tone} />
);

// The Accounts API's invoice statuses. Payment is a separate chip beside
// them: a part-payment stays UNPAID, so amountPaid tells "part paid".

const customerInvoiceStatus: Record<
  CustomerInvoiceStatus,
  { label: string; tone: ChipTone }
> = {
  [CustomerInvoiceStatus.Draft]: { label: "Draft", tone: "neutral" },
  [CustomerInvoiceStatus.Issued]: { label: "Issued", tone: "primary" },
  [CustomerInvoiceStatus.Superseded]: { label: "Replaced", tone: "neutral" },
  [CustomerInvoiceStatus.Void]: { label: "Void", tone: "neutral" },
};

export const CustomerInvoiceStatusChip = ({
  status,
}: {
  status: CustomerInvoiceStatus;
}) => (
  <StatusChip
    text={customerInvoiceStatus[status].label}
    tone={customerInvoiceStatus[status].tone}
  />
);

const carrierInvoiceStatus: Record<
  CarrierInvoiceStatus,
  { label: string; tone: ChipTone }
> = {
  [CarrierInvoiceStatus.Expected]: { label: "Awaiting bill", tone: "neutral" },
  [CarrierInvoiceStatus.Received]: { label: "Received", tone: "secondary" },
  [CarrierInvoiceStatus.OnHold]: { label: "On hold", tone: "warning" },
  [CarrierInvoiceStatus.Approved]: { label: "Approved", tone: "primary" },
  [CarrierInvoiceStatus.Superseded]: { label: "Replaced", tone: "neutral" },
  [CarrierInvoiceStatus.Void]: { label: "Void", tone: "neutral" },
};

export const CarrierInvoiceStatusChip = ({
  status,
}: {
  status: CarrierInvoiceStatus;
}) => (
  <StatusChip
    text={carrierInvoiceStatus[status].label}
    tone={carrierInvoiceStatus[status].tone}
  />
);

export const PaymentStatusChip = ({
  status,
  amountPaid,
}: {
  status: PaymentStatus;
  amountPaid: string;
}) =>
  status === PaymentStatus.Paid ? (
    <StatusChip text="Paid" tone="success" />
  ) : isZeroMoney(amountPaid) ? (
    <StatusChip text="Unpaid" tone="neutral" />
  ) : (
    <StatusChip text="Part paid" tone="secondary" />
  );
