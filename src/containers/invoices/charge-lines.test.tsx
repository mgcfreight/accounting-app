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
}: {
  lines: ChargeValues[];
  layout?: "rows" | "table";
}) {
  const { control } = useForm({ defaultValues: { lines } });
  return (
    <ChargeLines
      control={control}
      name="lines"
      layout={layout}
      footer={<p>Subtotal footer</p>}
    />
  );
}

const renderLines = (lines: ChargeValues[], layout?: "rows" | "table") =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Form lines={lines} layout={layout} />
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
