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
        <DropdownMenu aria-label="Row actions">
          {actions.map((action) => (
            <DropdownItem
              key={action.key}
              color={action.danger ? "danger" : "default"}
              className={action.danger ? "text-danger" : ""}
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
