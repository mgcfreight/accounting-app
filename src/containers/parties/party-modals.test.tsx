import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreditStatus, Currency, PartyType, Permission } from "@/lib/enums";
import { PartyView } from "@/lib/interfaces";
import { AgreementFormModal, creditFields } from "./party-modals";

const perms = vi.hoisted(() => ({ list: [] as string[] }));

vi.mock("@/components/providers/user-provider", () => ({
  useCan: () => ({ can: (permission: string) => perms.list.includes(permission) }),
}));

// accounting#76: credit fields need parties.edit_credit, and left out they
// carry over from the agreement being replaced (PR #40 review).
describe("creditFields", () => {
  const values = (creditStatus: CreditStatus, creditLimit = "") => ({ creditStatus, creditLimit });

  it("sends nothing when credit is unchanged, so the API carries it over", () => {
    expect(creditFields(values(CreditStatus.Allowed, "25000"), CreditStatus.Allowed, "25000.00")).toEqual({});
    expect(creditFields(values(CreditStatus.Allowed), CreditStatus.Allowed, "")).toEqual({});
    expect(creditFields(values(CreditStatus.NotAllowed), CreditStatus.NotAllowed, "")).toEqual({});
  });

  it("sends the status and the new limit when the limit changes", () => {
    expect(creditFields(values(CreditStatus.Allowed, "30000"), CreditStatus.Allowed, "25000.00")).toEqual({
      creditStatus: CreditStatus.Allowed,
      creditLimit: "30000",
    });
  });

  it("sends the status alone to remove a limit", () => {
    expect(creditFields(values(CreditStatus.Allowed), CreditStatus.Allowed, "25000.00")).toEqual({
      creditStatus: CreditStatus.Allowed,
      creditLimit: undefined,
    });
  });

  it("sends a block without a limit", () => {
    expect(creditFields(values(CreditStatus.Blocked, "25000.00"), CreditStatus.Allowed, "25000.00")).toEqual({
      creditStatus: CreditStatus.Blocked,
      creditLimit: undefined,
    });
  });
});

const shipper = {
  id: "pty_1",
  name: "Prairie Agri Inc.",
  type: PartyType.Shipper,
  defaultCurrency: Currency.CAD,
  agreements: [
    {
      id: "agr_1",
      currency: Currency.CAD,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      creditStatus: CreditStatus.Allowed,
      creditLimit: "25000.00",
    },
  ],
} as unknown as PartyView;

const open = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AgreementFormModal party={shipper} onClose={() => {}} />
    </QueryClientProvider>
  );

describe("AgreementFormModal credit", () => {
  it("shows credit read-only, carried over, without the credit permission", async () => {
    perms.list = [Permission.PartiesEdit];
    open();
    expect(await screen.findByLabelText("Credit limit")).toHaveAttribute("readonly");
    expect(screen.getByText(/Changing credit needs the credit permission/)).toBeInTheDocument();
  });

  it("lets a role with the credit permission change it", async () => {
    perms.list = [Permission.PartiesEdit, Permission.PartiesEditCredit];
    open();
    expect(await screen.findByLabelText("Credit limit")).not.toHaveAttribute("readonly");
    expect(screen.queryByText(/Changing credit needs the credit permission/)).not.toBeInTheDocument();
  });
});
