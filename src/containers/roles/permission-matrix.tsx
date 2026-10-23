import { Checkbox } from "@heroui/react";
import { Permission } from "@/lib/enums";
import { PermissionCatalog } from "@/lib/interfaces";

type Module = PermissionCatalog["modules"][number];

const VIEW = "view";

const viewOf = (row: Module) =>
  row.actions.find((cell) => cell.action === VIEW)?.permission;

// A UI rule, not the API's: any action in a module needs its View, so ticking
// one ticks View too, and unticking View clears the module.
const withCell = (
  selected: Set<Permission>,
  row: Module,
  permission: Permission,
  on: boolean
) => {
  const next = new Set(selected);
  const view = viewOf(row);
  if (on) {
    next.add(permission);
    if (view) next.add(view);
  } else if (permission === view) {
    row.actions.forEach((cell) => next.delete(cell.permission));
  } else {
    next.delete(permission);
  }
  return next;
};

// Rows are modules, columns are actions, in the catalog's order. A module has
// a checkbox only for the actions it lists; the other cells are blank.
export default function PermissionMatrix({
  catalog,
  selected,
  onChange,
  isReadOnly = false,
}: {
  catalog: PermissionCatalog;
  selected: Set<Permission>;
  onChange: (next: Set<Permission>) => void;
  isReadOnly?: boolean;
}) {
  const allOn = (cells: Permission[]) =>
    cells.length > 0 && cells.every((p) => selected.has(p));
  const someOn = (cells: Permission[]) => cells.some((p) => selected.has(p));

  const toggleRow = (row: Module) => {
    const cells = row.actions.map((cell) => cell.permission);
    const next = new Set(selected);
    if (allOn(cells)) cells.forEach((p) => next.delete(p));
    else cells.forEach((p) => next.add(p));
    onChange(next);
  };

  const toggleColumn = (action: string) => {
    const rows = catalog.modules.filter((row) =>
      row.actions.some((cell) => cell.action === action)
    );
    const cells = rows.map(
      (row) => row.actions.find((cell) => cell.action === action)!.permission
    );
    const on = !allOn(cells);
    onChange(
      rows.reduce(
        (next, row, i) => withCell(next, row, cells[i], on),
        new Set(selected)
      )
    );
  };

  const columnCells = (action: string) =>
    catalog.modules.flatMap((row) =>
      row.actions
        .filter((cell) => cell.action === action)
        .map((cell) => cell.permission)
    );

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-[#F4F6FA] text-base-primary">
          <tr>
            <th className="text-left font-semibold p-3 min-w-56">Module</th>
            {catalog.actions.map((column) => {
              const cells = columnCells(column.action);
              return (
                <th
                  key={column.action}
                  className="font-semibold p-3 text-center whitespace-nowrap"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>{column.label}</span>
                    <Checkbox
                      size="sm"
                      aria-label={`All: ${column.label}`}
                      isDisabled={isReadOnly || cells.length === 0}
                      isSelected={allOn(cells)}
                      isIndeterminate={!allOn(cells) && someOn(cells)}
                      onValueChange={() => toggleColumn(column.action)}
                    />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {catalog.modules.map((row) => {
            const cells = row.actions.map((cell) => cell.permission);
            return (
              <tr key={row.module} className="border-t">
                <td className="p-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      size="sm"
                      aria-label={`All in ${row.label}`}
                      isDisabled={isReadOnly}
                      isSelected={allOn(cells)}
                      isIndeterminate={!allOn(cells) && someOn(cells)}
                      onValueChange={() => toggleRow(row)}
                    />
                    <div>
                      <p className="font-semibold text-base-primary-900">
                        {row.label}
                      </p>
                      <p className="text-xs text-content-5">{row.description}</p>
                    </div>
                  </div>
                </td>
                {catalog.actions.map((column) => {
                  const cell = row.actions.find(
                    (item) => item.action === column.action
                  );
                  return (
                    <td key={column.action} className="p-3 text-center">
                      {cell && (
                        <Checkbox
                          size="sm"
                          aria-label={`${row.label}: ${cell.label}`}
                          isDisabled={isReadOnly}
                          isSelected={selected.has(cell.permission)}
                          onValueChange={(on) =>
                            onChange(withCell(selected, row, cell.permission, on))
                          }
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
