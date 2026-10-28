import { ReactNode } from "react";

export type InfoItem = { label: string; value: ReactNode };

// The row of label/value pairs across the top of mokal-app's invoice detail
// page (Invoice Date, Due Date, Invoice Amount, ...).
export default function InfoStrip({ items }: { items: InfoItem[] }) {
  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="flex flex-wrap justify-between items-center p-4 gap-6">
        {items.map((item) => (
          <div key={item.label}>
            {/* mokal-app sets the label larger than the value. Here the value
                is what the reader came for, so it leads and the label sits
                small above it. */}
            <h6 className="mb-1.5 text-[#707070] text-xs font-semibold uppercase tracking-wide">
              {item.label}
            </h6>
            <div className="text-base-primary-600 text-base font-semibold">
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
