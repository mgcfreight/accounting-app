import { describe, expect, it } from "vitest";
import { Currency } from "@/lib/enums";
import { PartyView } from "@/lib/interfaces";
import { agreementInForce } from "./agreement-in-force";

// Only the fields agreementInForce reads, newest first as the API sends them.
const party = (
  agreements: { effectiveFrom: string; effectiveTo: string | null; currency: Currency }[] | undefined
) => ({ agreements }) as unknown as PartyView;

const usd = { effectiveFrom: "2026-10-01", effectiveTo: null, currency: Currency.USD };
const cad = { effectiveFrom: "2026-01-01", effectiveTo: "2026-09-30", currency: Currency.CAD };

describe("agreementInForce", () => {
  it("picks the agreement covering the date, ends included", () => {
    expect(agreementInForce(party([usd, cad]), "2026-10-30")?.currency).toBe(Currency.USD);
    expect(agreementInForce(party([usd, cad]), "2026-10-01")?.currency).toBe(Currency.USD);
    expect(agreementInForce(party([usd, cad]), "2026-09-30")?.currency).toBe(Currency.CAD);
    expect(agreementInForce(party([usd, cad]), "2026-01-01")?.currency).toBe(Currency.CAD);
  });

  it("finds none before the first agreement or without agreements", () => {
    expect(agreementInForce(party([usd, cad]), "2025-12-31")).toBeUndefined();
    expect(agreementInForce(party([]), "2026-10-30")).toBeUndefined();
    expect(agreementInForce(party(undefined), "2026-10-30")).toBeUndefined();
    expect(agreementInForce(undefined, "2026-10-30")).toBeUndefined();
  });
});
