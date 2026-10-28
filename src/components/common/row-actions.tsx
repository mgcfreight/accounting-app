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

// The "…" menu at the end of mokal-app's table rows. A row with one action
// shows it as a button instead: a menu of one is a click for nothing.
export default function RowActions({ actions }: { actions: RowAction[] }) {
  if (actions.length === 1) {
    const [action] = actions;
    return (
      <div className="flex items-center justify-center">
        <button
          type="button"
          disabled={action.disabled}
          title={action.hint}
          onClick={action.onPress}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-md border border-base-default px-2.5 py-1.5 text-xs hover:bg-content-12 disabled:opacity-50 disabled:cursor-not-allowed ${
            action.danger ? "text-danger" : "text-base-primary"
          }`}
        >
          {action.icon}
          {action.label}
        </button>
      </div>
    );
  }

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
