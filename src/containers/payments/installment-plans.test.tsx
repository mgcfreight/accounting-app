import { QueryClient, QueryClientProvider, UseQueryResult } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Control, FieldValues, Path, useController } from "react-hook-form";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CarrierInvoiceStatus,
  Currency,
  InstallmentFrequency,
  InstallmentPlanAttention,
  InstallmentStatus,
  InvoiceKind,
  PaymentDirection,
} from "@/lib/enums";
import { InstallmentPlan, Paginated } from "@/lib/interfaces";
import InstallmentPlans, { NewPlanModal } from "./installment-plans";

const createInstallmentPlan = vi.hoisted(() => vi.fn());
const listCarrierInvoices = vi.hoisted(() => vi.fn());

// A plain select in place of the API-searched picker: two shippers or two
// carriers, by the label it is given.
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
          {label === "Carrier" ? (
            <option value="pty_c">Polar Haulage</option>
          ) : (
            <>
              <option value="pty_a">Prairie Agri Inc.</option>
              <option value="pty_b">Northwind Distribution</option>
              <option value="pty_many">Big Shipper Ltd.</option>
            </>
          )}
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
    // Shipper A owes in two currencies; shipper B in one; "many" owes 21.
    listCustomerInvoices: vi.fn(async ({ customerId }: { customerId: string }) => {
      const items =
        customerId === "pty_a"
          ? [invoice("sin_A1", Currency.CAD), invoice("sin_A2", Currency.USD)]
          : customerId === "pty_many"
            ? Array.from({ length: 21 }, (_, n) => invoice(`sin_M${n + 1}`, Currency.CAD))
            : [invoice("sin_B1", Currency.CAD)];
      return {
        items,
        meta: {
          totalItems: items.length,
          itemCount: items.length,
          itemsPerPage: 100,
          totalPages: 1,
          currentPage: 1,
        },
      };
    }),
    listCarrierInvoices,
  };
});

beforeEach(() => {
  createInstallmentPlan.mockReset();
  listCarrierInvoices.mockReset();
  listCarrierInvoices.mockImplementation(async () => ({
    items: [{ ...invoice("cri_C1", Currency.CAD), referenceNumber: "PH-1001" }],
    meta: { totalItems: 1, itemCount: 1, itemsPerPage: 100, totalPages: 1, currentPage: 1 },
  }));
});

const open = (directions = [PaymentDirection.In]) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NewPlanModal directions={directions} onClose={() => {}} />
    </QueryClientProvider>
  );

const pickShipper = (name: string) =>
  userEvent.selectOptions(screen.getByLabelText("Shipper"), name);

// Opens the Direction select and clicks an option. The option is found by
// its key, not by role: the modal marks everything outside it aria-hidden,
// the select's popover included, so role queries can't see it in jsdom.
const pickDirection = async (direction: PaymentDirection) => {
  await userEvent.click(screen.getByRole("button", { name: /Direction/ }));
  const option = document.querySelector(`[role="option"][data-key="${direction}"]`);
  if (!(option instanceof HTMLElement)) throw new Error(`No ${direction} option`);
  await userEvent.click(option);
};

describe("NewPlanModal", () => {
  it("offers a carrier's approved bills only, as the API accepts", async () => {
    open([PaymentDirection.Out]);
    await userEvent.selectOptions(screen.getByLabelText("Carrier"), "Polar Haulage");
    expect(await screen.findByRole("checkbox", { name: /PH-1001/ })).toBeInTheDocument();
    expect(listCarrierInvoices).toHaveBeenCalled();
    for (const [params] of listCarrierInvoices.mock.calls) {
      expect(params.status).toBe(CarrierInvoiceStatus.Approved);
    }
  });

  it("clears the party and the ticks when the direction changes", async () => {
    open([PaymentDirection.In, PaymentDirection.Out]);
    await pickShipper("Prairie Agri Inc.");
    await userEvent.click(await screen.findByRole("checkbox", { name: /sin_A1/ }));

    await pickDirection(PaymentDirection.Out);
    expect(await screen.findByLabelText("Carrier")).toHaveValue("");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText("Choose who the plan is with first.")).toBeInTheDocument();

    await pickDirection(PaymentDirection.In);
    await pickShipper("Prairie Agri Inc.");
    expect(await screen.findByRole("checkbox", { name: /sin_A1/ })).not.toBeChecked();
  });

  it("stops at 20 invoices, the most the API takes in one plan", async () => {
    open();
    await pickShipper("Big Shipper Ltd.");
    await screen.findByRole("checkbox", { name: /sin_M1\b/ });
    // fireEvent: 21 userEvent clicks are slow enough to time out the test.
    for (const box of screen.getAllByRole("checkbox")) fireEvent.click(box);
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(21);
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Create Plan" })
    );
    expect(await screen.findByText("A plan takes at most 20 invoices")).toBeInTheDocument();
    expect(createInstallmentPlan).not.toHaveBeenCalled();
  });

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

const plan = (overrides: Partial<InstallmentPlan>): InstallmentPlan => ({
  id: "ipl_4fK9qZ0aB1",
  direction: PaymentDirection.In,
  partyId: "pty_a",
  partyName: "Prairie Agri Inc.",
  invoices: [{ id: "cin_1", number: "sin_230" }],
  currency: Currency.CAD,
  total: "300.00",
  paid: "0.00",
  remaining: "300.00",
  attention: [],
  frequency: InstallmentFrequency.Monthly,
  agreedOn: "2026-10-01",
  installments: [
    { number: 1, dueDate: "2026-10-15", amount: "100.00", status: InstallmentStatus.Late, paidOn: null },
    { number: 2, dueDate: "2026-11-15", amount: "100.00", status: InstallmentStatus.Due, paidOn: null },
    { number: 3, dueDate: "2026-12-15", amount: "100.00", status: InstallmentStatus.Due, paidOn: null },
  ],
  createdAt: "2026-10-01T14:00:00.000Z",
  cancelledAt: null,
  cancelReason: null,
  ...overrides,
});

const showPlans = (items: InstallmentPlan[]) => {
  const meta = {
    totalItems: items.length,
    itemCount: items.length,
    itemsPerPage: 10,
    totalPages: 1,
    currentPage: 1,
  };
  const query = {
    data: { items, meta },
    isError: false,
    isPending: false,
    isPlaceholderData: false,
  } as unknown as UseQueryResult<Paginated<InstallmentPlan>>;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <InstallmentPlans
          query={query}
          paging={{ tableMeta: () => meta, setMeta: () => {} }}
          directions={[]}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("InstallmentPlans", () => {
  it("shows a plan with a voided invoice as needing attention, not late", async () => {
    showPlans([plan({ attention: [InstallmentPlanAttention.InvoiceVoided] })]);
    const row = screen.getByRole("row", { name: /Prairie Agri/ });
    expect(within(row).getByText("Needs attention")).toBeInTheDocument();
    expect(within(row).queryByText("Late")).not.toBeInTheDocument();

    // One action, so RowActions shows it as a button rather than a menu.
    await userEvent.click(within(row).getByRole("button", { name: "View schedule" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/An invoice in this plan was voided/)).toBeInTheDocument();
    expect(within(dialog).getByText("Installment Plan · Prairie Agri Inc.")).toBeInTheDocument();
    expect(within(dialog).queryByText(/ipl_4fK9qZ0aB1/)).not.toBeInTheDocument();
  });

  it("shows a late plan with nothing to look at as late", () => {
    showPlans([plan({})]);
    const row = screen.getByRole("row", { name: /Prairie Agri/ });
    expect(within(row).getByText("Late")).toBeInTheDocument();
    expect(within(row).queryByText("Needs attention")).not.toBeInTheDocument();
  });

  it("shows a cancelled plan as cancelled, ahead of late and attention (PR #43 review)", async () => {
    showPlans([
      plan({
        attention: [InstallmentPlanAttention.AmountChanged],
        cancelledAt: "2026-11-05T15:00:00.000Z",
        cancelReason: "Shipper paid in full",
      }),
    ]);
    const row = screen.getByRole("row", { name: /Prairie Agri/ });
    expect(within(row).getByText("Cancelled")).toBeInTheDocument();
    for (const status of ["Late", "On track", "Needs attention"]) {
      expect(within(row).queryByText(status)).not.toBeInTheDocument();
    }
    // Still owed (product, Q17), but no next installment.
    // Total and Remaining, both 300.00.
    expect(within(row).getAllByText("CAD 300.00")).toHaveLength(2);
    expect(within(row).queryByText(/Nov 15, 2026/)).not.toBeInTheDocument();

    await userEvent.click(within(row).getByRole("button", { name: "View schedule" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Cancelled Nov 5, 2026: Shipper paid in full/)
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("Late")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Due")).not.toBeInTheDocument();
  });
});
