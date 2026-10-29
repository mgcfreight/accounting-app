import { ReactNode } from "react";
import { LuX } from "react-icons/lu";
import BaseButton from "./base-button";

// The light-blue strip that holds a list page's search box and filters, as on
// mokal-app's invoice pages.
export default function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 flex flex-wrap items-center gap-4 bg-layout-stats rounded-lg">
      {children}
    </div>
  );
}

// Placed after a page's filters inside FilterBar; shown only while one is set.
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
      onPress={onClear}
    />
  );
}
