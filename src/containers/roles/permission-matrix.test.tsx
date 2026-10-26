import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Permission } from "@/lib/enums";
import { PermissionCatalog } from "@/lib/interfaces";
import PermissionMatrix from "./permission-matrix";

// Two modules from the real catalog: parties has no Issue, invoices does.
const catalog: PermissionCatalog = {
  modules: [
    {
      module: "parties",
      label: "Customers and carriers",
      description: "Parties and their agreed terms",
      actions: [
        { action: "view", label: "View", permission: Permission.PartiesView },
        { action: "edit", label: "Edit", permission: Permission.PartiesEdit },
      ],
    },
    {
      module: "customer_invoices",
      label: "Customer invoices",
      description: "Money in",
      actions: [
        {
          action: "view",
          label: "View",
          permission: Permission.CustomerInvoicesView,
        },
        {
          action: "issue",
          label: "Issue",
          permission: Permission.CustomerInvoicesIssue,
        },
      ],
    },
  ],
  actions: [
    { action: "view", label: "View" },
    { action: "edit", label: "Edit" },
    { action: "issue", label: "Issue" },
  ],
};

function Harness({
  initial = [],
  isReadOnly,
}: {
  initial?: Permission[];
  isReadOnly?: boolean;
}) {
  const [selected, setSelected] = useState(new Set(initial));
  return (
    <PermissionMatrix
      catalog={catalog}
      selected={selected}
      onChange={setSelected}
      isReadOnly={isReadOnly}
    />
  );
}

const box = (name: string) => screen.getByRole("checkbox", { name });

describe("PermissionMatrix", () => {
  it("shows a checkbox only where a module has the action", () => {
    render(<Harness />);
    expect(box("Customer invoices: Issue")).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Customers and carriers: Issue" })
    ).not.toBeInTheDocument();
  });

  it("ticks View along with any other action", async () => {
    render(<Harness />);
    await userEvent.click(box("Customers and carriers: Edit"));
    expect(box("Customers and carriers: Edit")).toBeChecked();
    expect(box("Customers and carriers: View")).toBeChecked();
  });

  it("clears the row when View is unticked", async () => {
    render(
      <Harness initial={[Permission.PartiesView, Permission.PartiesEdit]} />
    );
    await userEvent.click(box("Customers and carriers: View"));
    expect(box("Customers and carriers: View")).not.toBeChecked();
    expect(box("Customers and carriers: Edit")).not.toBeChecked();
  });

  it("toggles a whole module from its row checkbox", async () => {
    render(<Harness />);
    await userEvent.click(box("All in Customer invoices"));
    expect(box("Customer invoices: View")).toBeChecked();
    expect(box("Customer invoices: Issue")).toBeChecked();
    expect(box("Customers and carriers: View")).not.toBeChecked();
  });

  it("toggles a column, adding View where it adds an action", async () => {
    render(<Harness />);
    await userEvent.click(box("All: Issue"));
    expect(box("Customer invoices: Issue")).toBeChecked();
    expect(box("Customer invoices: View")).toBeChecked();
    expect(box("Customers and carriers: View")).not.toBeChecked();
  });

  it("can't be changed when read-only", () => {
    render(<Harness initial={[Permission.PartiesView]} isReadOnly />);
    expect(box("Customers and carriers: View")).toBeDisabled();
    expect(box("All in Customer invoices")).toBeDisabled();
  });
});
