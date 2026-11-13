import { CarrierInvoiceStatus, CustomerInvoiceStatus, ReviewChange, ReviewKind } from "@/lib/enums";
import { ReviewItem } from "@/lib/interfaces";

// Needs Review's MGC changes: what each asks of staff, and what changed, in
// words. Pure, so it can be tested.

// Not issued yet (a draft, or a carrier bill still awaited): its amounts are
// changed on its page, the old ones kept in its history.
const NOT_ISSUED: string[] = [CustomerInvoiceStatus.Draft, CarrierInvoiceStatus.Expected];
// A carrier bill in, not yet approved: it keeps the carrier's amount, so a
// change only needs a note (accounts, 13 Nov 2026).
const NOTE_ONLY: string[] = [CarrierInvoiceStatus.Received, CarrierInvoiceStatus.OnHold];

const changeLabels: Record<ReviewChange, string> = {
  [ReviewChange.Total]: "Total",
  [ReviewChange.Currency]: "Currency",
  [ReviewChange.Shipper]: "Shipper",
  [ReviewChange.References]: "References",
  [ReviewChange.Addresses]: "Addresses",
  [ReviewChange.ChargeLines]: "Charge lines",
  [ReviewChange.Carrier]: "Carrier",
};

// What MGC Freight changed, in words; empty for a change flagged before the
// API said.
export const changedText = (item: ReviewItem) =>
  item.changes.map((change) => changeLabels[change]).join(", ");

// What each change asks of staff (accounts, 13 Nov 2026), for a role that
// may act on the side: `link` opens the invoice page with what it offers
// (null: nothing to do there), `resolve` names the Resolve button. A role
// that may only look gets "View invoice".
export const changeAction = (
  item: ReviewItem,
  canAct: boolean
): { link: string | null; resolve: string } => {
  if (!canAct) return { link: "View invoice", resolve: "Resolve" };
  if (item.kind === ReviewKind.Cancellation) {
    return {
      link: NOT_ISSUED.includes(item.invoiceStatus) ? "Void" : "Void or Credit",
      resolve: "Resolve",
    };
  }
  // Already at MGC Freight's figure: only needs confirming.
  if (item.updatedFromTms) return { link: null, resolve: "Confirm" };
  if (NOTE_ONLY.includes(item.invoiceStatus)) return { link: null, resolve: "Add a Note" };
  if (NOT_ISSUED.includes(item.invoiceStatus)) return { link: "Change Amounts", resolve: "Resolve" };
  return { link: "Revise or Note", resolve: "Resolve" };
};
