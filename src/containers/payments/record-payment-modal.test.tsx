import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Currency, Permission } from "@/lib/enums";
import RecordPaymentModal from "./record-payment-modal";

const recordPayment = vi.hoisted(() => vi.fn());
// The shipper is billed in CAD, unless a test says otherwise.
const getParty = vi.hoisted(() =>
  vi.fn(async (id: string): Promise<object> => ({
    id,
    name: "Prairie Agri Inc.",
    defaultCurrency: "CAD",
  }))
);

vi.mock("@/components/providers/user-provider", () => ({
  useCan: () => ({
    can: (permission: Permission) => permission === Permission.CustomerPaymentsCreate,
  }),
}));

vi.mock("@/services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services")>();
  return {
    ...actual,
    getParty,
    recordPayment,
  };
});

const open = (currency: Currency) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RecordPaymentModal isOpen onClose={() => {}} shipper={{ id: "pty_1", currency }} />
    </QueryClientProvider>
  );

describe("RecordPaymentModal opened for a debt", () => {
  it("refuses a debt in a currency the shipper isn't billed in", async () => {
    open(Currency.USD);
    expect(
      await screen.findByText(/This debt is in USD, but Prairie Agri Inc\. is billed in CAD/)
    ).toBeInTheDocument();
    // Submitting is refused, not sent.
    await userEvent.click(screen.getByRole("button", { name: "Record Payment" }));
    expect(recordPayment).not.toHaveBeenCalled();
  });

  it("uses the agreement's currency before the party's default (PR #40 review)", async () => {
    getParty.mockResolvedValueOnce({
      id: "pty_1",
      name: "Prairie Agri Inc.",
      defaultCurrency: Currency.CAD,
      agreements: [{ currency: Currency.USD }],
    });
    open(Currency.USD);
    expect(await screen.findByText(/Paid in USD/)).toBeInTheDocument();
    expect(screen.queryByText(/This debt is in/)).not.toBeInTheDocument();
  });

  it("says nothing when the currencies match", async () => {
    open(Currency.CAD);
    expect(await screen.findByText(/Paid in CAD/)).toBeInTheDocument();
    expect(screen.queryByText(/This debt is in/)).not.toBeInTheDocument();
  });
});
