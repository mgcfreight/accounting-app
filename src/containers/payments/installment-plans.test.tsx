import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Control, FieldValues, Path, useController } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { Currency, InvoiceKind, PaymentDirection } from "@/lib/enums";
import { NewPlanModal } from "./installment-plans";

const createInstallmentPlan = vi.hoisted(() => vi.fn());

// A plain select in place of the API-searched picker: two shippers.
vi.mock("../shipments/party-picker", () => ({
  default: function PartyPicker<T extends FieldValues>({
    control,
    name,
    label,
  }: {
    control: Control<T>;
    name: Path<T>;
    label: string;
  }) {
    const { field } = useController({ control, name });
    return (
      <label>
        {label}
        <select value={field.value} onChange={(event) => field.onChange(event.target.value)}>
          <option value="">None</option>
          <option value="pty_a">Prairie Agri Inc.</option>
          <option value="pty_b">Northwind Distribution</option>
        </select>
      </label>
    );
  },
}));

const invoice = (id: string, currency: Currency) => ({
  id,
  invoiceNumber: id,
  dueDate: "2026-12-01",
  balanceDue: "100.00",
  currency,
  kind: InvoiceKind.Standard,
  disputed: false,
});

vi.mock("@/services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services")>();
  return {
    ...actual,
    createInstallmentPlan,
    // Shipper A owes in two currencies; shipper B in one.
    listCustomerInvoices: vi.fn(async ({ customerId }: { customerId: string }) => ({
      items:
        customerId === "pty_a"
          ? [invoice("sin_A1", Currency.CAD), invoice("sin_A2", Currency.USD)]
          : [invoice("sin_B1", Currency.CAD)],
      meta: { totalItems: 2, itemCount: 2, itemsPerPage: 100, totalPages: 1, currentPage: 1 },
    })),
  };
});

const open = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NewPlanModal directions={[PaymentDirection.In]} onClose={() => {}} />
    </QueryClientProvider>
  );

const pickShipper = (name: string) =>
  userEvent.selectOptions(screen.getByLabelText("Shipper"), name);

describe("NewPlanModal", () => {
  it("starts with no invoices ticked when another shipper is chosen", async () => {
    open();
    await pickShipper("Prairie Agri Inc.");
    await userEvent.click(await screen.findByRole("checkbox", { name: /sin_A1/ }));
    expect(screen.getByRole("checkbox", { name: /sin_A1/ })).toBeChecked();

    await pickShipper("Northwind Distribution");
    expect(await screen.findByRole("checkbox", { name: /sin_B1/ })).not.toBeChecked();
    await pickShipper("Prairie Agri Inc.");
    expect(await screen.findByRole("checkbox", { name: /sin_A1/ })).not.toBeChecked();
  });

  it("keeps a plan to one currency, and clears the message once fixed", async () => {
    open();
    await pickShipper("Prairie Agri Inc.");
    await userEvent.click(await screen.findByRole("checkbox", { name: /sin_A1/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /sin_A2/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create Plan" }));

    expect(await screen.findByText(/A plan is in one currency/)).toBeInTheDocument();
    expect(createInstallmentPlan).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("checkbox", { name: /sin_A2/ }));
    expect(screen.queryByText(/A plan is in one currency/)).not.toBeInTheDocument();
  });
});
