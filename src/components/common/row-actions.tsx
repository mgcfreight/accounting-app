import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Tooltip,
} from "@heroui/react";
import { ReactNode } from "react";
import { MoreHoriz } from "../icons";

export type RowAction = {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  // Keeps the label beside the icon on a single-action button. Set it on
  // actions that change something; danger actions always keep theirs.
  labelled?: boolean;
  // Shown but not selectable; `hint` says why.
  disabled?: boolean;
  hint?: string;
  onPress: () => void;
};

// The "…" menu at the end of mokal-app's table rows. A row with one action
// shows it as a button instead: a menu of one is a click for nothing.
export default function RowActions({ actions }: { actions: RowAction[] }) {
  if (actions.length === 1) {
    return <RowActionButton action={actions[0]} />;
  }
  return <RowActionsMenu actions={actions} />;
}

// An icon alone is kept for actions that only look (view, open); on touch
// there is no tooltip to name it, and an icon can read as the row's status.
// Danger and labelled actions show the icon and the label.
function RowActionButton({ action }: { action: RowAction }) {
  const iconOnly = !!action.icon && !action.danger && !action.labelled;
  const tip = iconOnly
    ? [action.label, action.hint].filter(Boolean).join(" — ")
    : action.hint;

  return (
    <div className="flex items-center justify-center">
      <Tooltip content={tip} isDisabled={!tip} closeDelay={0}>
        {/* A disabled button fires no pointer events, so the span carries
            the tooltip's hover. */}
        <span className="inline-flex">
          <button
            type="button"
            disabled={action.disabled}
            aria-label={iconOnly ? action.label : undefined}
            onClick={action.onPress}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md text-xs hover:bg-content-12 disabled:opacity-50 disabled:cursor-not-allowed ${
              iconOnly ? "p-1.5 text-base" : "border border-base-default px-2.5 py-1.5"
            } ${action.danger ? "text-danger" : "text-base-primary"}`}
          >
            {action.icon}
            {!iconOnly && action.label}
          </button>
        </span>
      </Tooltip>
    </div>
  );
}

// Opens on click (or Enter/Space) only. Opening on hover took focus from
// wherever it was and held the menu open against Esc and trigger clicks.
function RowActionsMenu({ actions }: { actions: RowAction[] }) {
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
