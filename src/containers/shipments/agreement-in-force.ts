import { AgreementView, PartyView } from "@/lib/interfaces";

// The party's agreement that covers a calendar date ("YYYY-MM-DD"), or
// undefined when none does (or the party came without its agreements). The
// API picks a shipment's terms and currency the same way, from the invoice
// date.
export const agreementInForce = (
  party: PartyView | undefined,
  date: string
): AgreementView | undefined =>
  party?.agreements?.find(
    (agreement) =>
      agreement.effectiveFrom <= date &&
      (agreement.effectiveTo === null || agreement.effectiveTo >= date)
  );
