import { TaxRate } from "@/lib/interfaces";

export type TaxRateStatus = "current" | "scheduled" | "ended";

// Where a rate stands on `today` (the Toronto calendar date). Taken from the
// dates, not from a missing effectiveTo: adding a future rate ends the one in
// force the day before, so the open row can still be waiting to start.
// YYYY-MM-DD strings compare correctly as text.
export const taxRateStatus = (
  rate: Pick<TaxRate, "effectiveFrom" | "effectiveTo">,
  today: string
): TaxRateStatus => {
  if (rate.effectiveFrom > today) return "scheduled";
  if (rate.effectiveTo !== null && rate.effectiveTo < today) return "ended";
  return "current";
};
