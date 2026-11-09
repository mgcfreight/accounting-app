import { ReactNode } from "react";
import { LuX } from "react-icons/lu";
import BaseButton from "./base-button";

// The light-blue strip that holds a list page's search box and filters, as on
// mokal-app's invoice pages.
export default function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div
      data-filter-bar
      className="p-4 flex flex-wrap items-center gap-4 bg-layout-stats rounded-lg"
    >
      {children}
    </div>
  );
}

// The first control in the bar, skipping hidden ones (a HeroUI Select's
// native <select> has tabindex -1).
const FOCUSABLE =
  "input:not([type=hidden]):not([tabindex='-1']):not([disabled]), button:not([tabindex='-1']):not([disabled])";

// Placed after a page's filters inside FilterBar; shown only while one is set.
// Clearing unmounts it, so focus moves to the first filter instead of
// dropping to <body>.
export function ClearFiltersButton({
  active,
  onClear,
}: {
  active: boolean;
  onClear: () => void;
}) {
  if (!active) return null;
  return (
    <BaseButton
      text="Clear filters"
      varient="light"
      className="text-base-primary px-3"
      startContent={<LuX className="text-sm" />}
      onPress={(event) => {
        const bar = event.target.closest("[data-filter-bar]");
        const first = [...(bar?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].find(
          (element) => element !== event.target
        );
        first?.focus();
        onClear();
      }}
    />
  );
}
