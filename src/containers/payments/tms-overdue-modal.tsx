import { ReactNode } from "react";
import { BaseButton, FormModal, Money, PartyAvatar, StatusChip } from "@/components/common";
import { ChipTone } from "@/components/common/status-chip";
import { TmsOverdueShipper, TmsOverdueSummary } from "@/lib/interfaces";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// Days past due in the aging buckets (design §8.6). The colour is
// presentation only: amber up to 60 days, red beyond.
const pastDue = (days: number): { range: string; tone: ChipTone } => {
  if (days <= 0) return { range: "Current", tone: "neutral" };
  if (days <= 30) return { range: "1–30 days", tone: "warning" };
  if (days <= 60) return { range: "31–60 days", tone: "warning" };
  if (days <= 90) return { range: "61–90 days", tone: "danger" };
  return { range: "90+ days", tone: "danger" };
};

const Tile = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="rounded-lg border border-content-10 bg-content-12 px-4 py-3">
    <p className="text-[#707070] text-xs font-semibold uppercase tracking-wide">{label}</p>
    <p className="mt-1 text-base-primary-600 text-lg font-bold">{children}</p>
  </div>
);

const th = "py-2 px-3 text-xs font-semibold uppercase tracking-wide text-[#707070]";

// Every shipper with a payment overdue in the TMS, behind the overdue bar's
// View All. Rows and totals are shown exactly as the summary sends them (see
// TmsOverdueBar); the shipper count is the rows. Demo data.
export default function TmsOverdueModal({
  isOpen,
  onClose,
  overdue,
  onRecord,
}: {
  isOpen: boolean;
  onClose: () => void;
  overdue: TmsOverdueSummary;
  // Unset for those who can't record payments: no Clear Payment column.
  onRecord?: (shipper: TmsOverdueShipper) => void;
}) {
  const { shippers, totals } = overdue;

  return (
    <FormModal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Overdue Payments in the TMS"
      size="3xl"
    >
      <p className="text-sm text-content-5 -mt-2">Most overdue first.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {totals.map((total) => (
          <Tile key={total.currency} label={`Overdue · ${total.currency}`}>
            <Money amount={total.amount} currency={total.currency} />
          </Tile>
        ))}
        <Tile label="Shippers">{shippers.length}</Tile>
        <Tile label="Oldest">{plural(overdue.oldestOverdueDays, "day")}</Tile>
      </div>

      <div className="overflow-x-auto rounded-lg border border-content-10">
        <table className="w-full text-sm text-[#343A40]">
          <caption className="sr-only">Overdue payments by shipper</caption>
          <thead className="bg-content-12 text-left">
            <tr>
              <th scope="col" className={th}>
                Shipper
              </th>
              <th scope="col" className={th}>
                Past due
              </th>
              <th scope="col" className={`${th} text-right`}>
                Amount
              </th>
              {onRecord && (
                <th scope="col" className={th}>
                  <span className="sr-only">Action</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {shippers.map((shipper) => {
              const due = pastDue(shipper.oldestOverdueDays);
              return (
                <tr key={shipper.partyId} className="border-t border-content-10">
                  <td className="py-3 px-3">
                    <PartyAvatar
                      name={shipper.partyName}
                      subtitle={`${plural(shipper.invoiceCount, "overdue invoice")}`}
                    />
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex flex-col items-start gap-1">
                      <StatusChip
                        text={plural(shipper.oldestOverdueDays, "day")}
                        tone={due.tone}
                      />
                      <span className="text-xs text-content-5">{due.range}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-semibold whitespace-nowrap">
                    <Money amount={shipper.amount} currency={shipper.currency} />
                  </td>
                  {onRecord && (
                    <td className="py-3 px-3 text-right">
                      <BaseButton
                        text="Clear Payment"
                        size="sm"
                        className="h-8 px-3"
                        aria-label={`Clear payment for ${shipper.partyName}`}
                        onPress={() => onRecord(shipper)}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </FormModal>
  );
}
