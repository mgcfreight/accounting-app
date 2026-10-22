import { ReactNode } from "react";

// The light-blue strip that holds a list page's search box and filters, as on
// mokal-app's invoice pages.
export default function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 flex flex-wrap items-center gap-4 bg-layout-stats rounded-lg mb-6">
      {children}
    </div>
  );
}
