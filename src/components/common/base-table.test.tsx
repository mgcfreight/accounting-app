import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BaseTable from "./base-table";

type Row = { id: string; name: string };

const rows: Row[] = [
  { id: "a", name: "Acme" },
  { id: "b", name: "Bolt" },
];

const columns = [
  { key: "name", label: "Name" },
  { key: "link", label: "Link" },
];

const renderTable = (onRowClick: (row: Row) => void) =>
  render(
    <BaseTable<Row>
      ariaLabel="Rows"
      columns={columns}
      data={rows}
      rowKey={(row) => row.id}
      onRowClick={onRowClick}
      renderCell={(row, key) =>
        key === "link" ? <a href={`#${row.id}`}>Open {row.name}</a> : row.name
      }
    />
  );

describe("BaseTable onRowClick", () => {
  it("opens the row clicked anywhere in it", async () => {
    const onRowClick = vi.fn();
    renderTable(onRowClick);

    await userEvent.click(screen.getByText("Bolt"));

    expect(onRowClick).toHaveBeenCalledOnce();
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });

  it("leaves a click on a link inside the row to the link", async () => {
    const onRowClick = vi.fn();
    renderTable(onRowClick);

    await userEvent.click(screen.getByText("Open Acme"));

    expect(onRowClick).not.toHaveBeenCalled();
  });
});
