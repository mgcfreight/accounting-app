import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Tooltip,
} from "@heroui/react";
import { ReactNode, useEffect, useRef, useState } from "react";
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
// shows it as a button instead: a menu of one is a click for nothing. With
// an icon, the button is the icon alone and the label is its name and
// tooltip; without one, it shows the label.
export default function RowActions({ actions }: { actions: RowAction[] }) {
  if (actions.length === 1) {
    return <RowActionButton action={actions[0]} />;
  }
  return <RowActionsMenu actions={actions} />;
}

function RowActionButton({ action }: { action: RowAction }) {
  const iconOnly = !!action.icon;
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

// Opens on hover as well as click (click keeps it usable on touch and from
// the keyboard), as the profile menu does.
function RowActionsMenu({ actions }: { actions: RowAction[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveringTrigger = useRef(false);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const open = () => {
    cancelClose();
    setIsOpen(true);
  };
  // The popover sits a few pixels from the trigger, so closing waits long
  // enough for the pointer to cross the gap.
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setIsOpen(false), 150);
  };

  useEffect(() => cancelClose, []);

  return (
    <div className="flex items-center justify-center">
      <Dropdown
        isOpen={isOpen}
        onOpenChange={(next) => {
          if (!next && isHoveringTrigger.current) return;
          cancelClose();
          setIsOpen(next);
        }}
      >
        <DropdownTrigger>
          <button
            type="button"
            aria-label="Row actions"
            className="p-1"
            onMouseEnter={() => {
              isHoveringTrigger.current = true;
              open();
            }}
            onMouseLeave={() => {
              isHoveringTrigger.current = false;
              scheduleClose();
            }}
          >
            <MoreHoriz className="cursor-pointer" />
          </button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Row actions"
          onMouseEnter={open}
          onMouseLeave={scheduleClose}
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
