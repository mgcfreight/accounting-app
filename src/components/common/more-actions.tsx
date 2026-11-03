import { useEffect, useId, useRef, useState } from "react";
import { MoreHoriz } from "../icons";
import { RowAction } from "./row-actions";

// How long the menu stays open after the pointer leaves, so moving from the
// button down to an item doesn't close it on the way.
const CLOSE_DELAY_MS = 200;

// A page's "More" menu (a detail page's header), opened by hovering the
// button as well as by clicking it, focusing it or tapping it. Not HeroUI's
// Dropdown: that moves focus into the menu and traps it there when it opens,
// which on hover takes focus from wherever it was (see RowActionsMenu).
// Opening here moves no focus; Esc or a click outside closes it.
export default function MoreActions({
  actions,
  label = "More",
}: {
  actions: RowAction[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const menuId = useId();

  const cancelClose = () => clearTimeout(closeTimer.current);
  const show = () => {
    cancelClose();
    setOpen(true);
  };
  const hideSoon = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);
  useEffect(() => cancelClose, []);

  if (actions.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hideSoon}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          rootRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
        }
      }}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        className={`flex h-10 items-center gap-1.5 rounded-xl border-medium px-4 text-xs text-base-primary transition-colors hover:bg-content-12 focus-visible:outline-2 focus-visible:outline-focus ${
          open ? "border-base-primary bg-content-12" : "border-base-primary/60"
        }`}
        // Opens, never toggles: hovering has usually opened it already, and a
        // toggle would close it under the click.
        onClick={show}
        onFocus={show}
      >
        <MoreHoriz aria-hidden className="h-5 w-5 [&_path]:fill-current" />
        {label}
      </button>
      {open && (
        <ul
          id={menuId}
          aria-label={label}
          className="absolute right-0 top-full z-50 mt-1 min-w-56 rounded-medium border border-base-default bg-white p-1 shadow-medium"
        >
          {actions.map((action) => (
            <li key={action.key}>
              <button
                type="button"
                disabled={action.disabled}
                className={`flex w-full flex-col items-start gap-0.5 rounded-small px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-focus ${
                  action.danger
                    ? "text-danger hover:bg-danger-50"
                    : "text-content-6 hover:bg-content-12"
                }`}
                onClick={() => {
                  setOpen(false);
                  action.onPress();
                }}
              >
                <span className="flex items-center gap-2">
                  {action.icon}
                  {action.label}
                </span>
                {action.hint && (
                  <span className="text-xs text-content-5">{action.hint}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
