import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { ReactNode } from "react";
import { MoreHoriz } from "../icons";

export type RowAction = {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  // Shown but not selectable; `hint` says why.
  disabled?: boolean;
  hint?: string;
  onPress: () => void;
};

// The "…" menu at the end of mokal-app's table rows.
export default function RowActions({ actions }: { actions: RowAction[] }) {
  return (
    <div className="flex items-center justify-center">
      <Dropdown>
        <DropdownTrigger>
          <button type="button" aria-label="Row actions" className="p-1">
            <MoreHoriz className="cursor-pointer" />
          </button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Row actions"
          disabledKeys={actions
            .filter((action) => action.disabled)
            .map((action) => action.key)}
        >
          {actions.map((action) => (
            <DropdownItem
              key={action.key}
              color={action.danger ? "danger" : "default"}
              className={action.danger ? "text-danger" : ""}
              description={action.hint}
              classNames={{ title: "flex gap-2 items-center" }}
              onPress={action.onPress}
            >
              {action.icon}
              {action.label}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
    </div>
  );
}
