import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import ChargeLines, { ChargeValues, emptyCharge } from "./charge-lines";

vi.mock("@/services", () => ({
  getInvoiceChargeTypes: vi.fn().mockResolvedValue([]),
}));

const line = (description: string): ChargeValues => ({
  ...emptyCharge,
  description,
});

function Form({
  lines,
  layout,
  showQuantity,
}: {
  lines: ChargeValues[];
  layout?: "rows" | "table";
  showQuantity?: boolean;
}) {
  const { control } = useForm({ defaultValues: { lines }, mode: "onChange" });
  return (
    <ChargeLines
      control={control}
      name="lines"
      layout={layout}
      showQuantity={showQuantity}
      footer={<p>Subtotal footer</p>}
    />
  );
}

const renderLines = (
  lines: ChargeValues[],
  layout?: "rows" | "table",
  showQuantity?: boolean
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Form lines={lines} layout={layout} showQuantity={showQuantity} />
    </QueryClientProvider>
  );

const descriptions = () =>
  screen
    .getAllByRole("textbox", { name: "Description" })
    .map((input) => (input as HTMLInputElement).value);

describe("ChargeLines", () => {
  it("removes only the line whose remove button was pressed", async () => {
    renderLines([line("Freight"), line("Fuel"), line("Liftgate")]);

    const removes = screen.getAllByRole("button", { name: "Remove charge" });
    await userEvent.click(removes[1]);

    expect(descriptions()).toEqual(["Freight", "Liftgate"]);
  });

  it("keeps the last line, with no remove button on it", async () => {
    renderLines([line("Freight"), line("Fuel")]);

    await userEvent.click(screen.getAllByRole("button", { name: "Remove charge" })[0]);

    expect(descriptions()).toEqual(["Fuel"]);
    expect(screen.queryByRole("button", { name: "Remove charge" })).toBeNull();
  });

  describe("the price", () => {
    const typePrice = async (value: string) => {
      const price = screen.getByRole("textbox", { name: /Unit price|Amount/ });
      await userEvent.type(price, value);
    };

    it("takes a unit price to 4 decimals beside a quantity", async () => {
      renderLines([line("Freight")]);

      await typePrice("100.1255");

      expect(screen.queryByText("Up to 4 decimals")).toBeNull();
    });

    it("takes a line amount to the cent only, without a quantity", async () => {
      renderLines([line("Freight")], "table", false);

      await typePrice("100.125");

      expect(screen.getByText("Up to 2 decimals")).toBeTruthy();
    });

    it("accepts a line amount with 2 decimals", async () => {
      renderLines([line("Freight")], "table", false);

      await typePrice("100.12");

      expect(screen.queryByText("Up to 2 decimals")).toBeNull();
    });
  });

  it("shows the footer in the rows layout too", () => {
    renderLines([line("Freight")]);

    expect(screen.getByText("Subtotal footer")).toBeTruthy();
  });

  // FormModal is a real form: Enter after typing a price would save the
  // whole bill with one line.
  it.each(["rows", "table"] as const)("doesn't submit the form on Enter in a %s field", async (layout) => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <QueryClientProvider client={new QueryClient()}>
        <form onSubmit={onSubmit}>
          <Form lines={[line("Freight")]} layout={layout} />
          <button type="submit">Save</button>
        </form>
      </QueryClientProvider>
    );

    await userEvent.type(screen.getByRole("textbox", { name: /Unit price/ }), "100{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  describe("as a table", () => {
    const tableDescriptions = () =>
      screen
        .getAllByRole("textbox", { name: /^Description \d+$/ })
        .map((input) => (input as HTMLInputElement).value);

    it("numbers the rows and removes only the chosen one", async () => {
      renderLines([line("Freight"), line("Fuel"), line("Liftgate")], "table");

      await userEvent.click(screen.getByRole("button", { name: "Remove charge 2" }));

      expect(tableDescriptions()).toEqual(["Freight", "Liftgate"]);
    });

    it("adds a row and shows the footer", async () => {
      renderLines([line("Freight")], "table");

      await userEvent.click(screen.getByRole("button", { name: "Add Additional Charges" }));

      expect(tableDescriptions()).toEqual(["Freight", ""]);
      expect(screen.getByText("Subtotal footer")).toBeTruthy();
    });
  });
});
