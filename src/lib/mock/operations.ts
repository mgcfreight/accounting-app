import { Currency, ReviewKind } from "../enums";
import { ReviewItem } from "../interfaces";

export const mockReviewItems: ReviewItem[] = [
  {
    id: "R-31",
    kind: ReviewKind.AmountChange,
    shipmentId: "SHP-8F2K1",
    invoiceNumber: "INV-10421",
    partyName: "Northwind Distribution",
    currency: Currency.CAD,
    previousAmount: "2450.00",
    newAmount: "2610.00",
    detectedAt: "2026-10-18T13:42:00Z",
  },
  {
    id: "R-30",
    kind: ReviewKind.Cancellation,
    shipmentId: "SHP-8F2P4",
    invoiceNumber: "INV-10431",
    partyName: "Pacific Rim Traders",
    currency: Currency.CAD,
    previousAmount: "1450.00",
    newAmount: "0.00",
    detectedAt: "2026-10-18T18:10:00Z",
  },
];
