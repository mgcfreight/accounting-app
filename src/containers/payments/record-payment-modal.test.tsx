import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Currency, Permission } from "@/lib/enums";
import RecordPaymentModal from "./record-payment-modal";

const recordPayment = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return { ...actual, toast: { ...actual.toast, error: toastError, success: vi.fn() } };
});
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
    // A complete form, so it gets past the required fields to the check
    // (PR #40 review); submitting is refused, not sent.
    const dialog = screen.getByRole("dialog");
    // HeroUI keeps a hidden native <select> in step with its picker.
    const method = [...dialog.querySelectorAll("select")].find((select) =>
      [...select.options].some((option) => option.value === "EFT")
    )!;
    await userEvent.selectOptions(method, "EFT");
    await userEvent.type(within(dialog).getByLabelText(/^Amount/), "100.00");
    await userEvent.type(within(dialog).getByLabelText("Paid on"), "2026-11-01");
    await userEvent.click(within(dialog).getByRole("button", { name: "Record Payment" }));
    expect(toastError).toHaveBeenCalledWith(
      "This debt's currency doesn't match the party's, so it can't be recorded here."
    );
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
