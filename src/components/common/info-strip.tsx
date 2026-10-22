import { ReactNode } from "react";

export type InfoItem = { label: string; value: ReactNode };

// The row of label/value pairs across the top of mokal-app's invoice detail
// page (Invoice Date, Due Date, Invoice Amount, ...).
export default function InfoStrip({ items }: { items: InfoItem[] }) {
  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="flex flex-wrap justify-between items-center py-5 px-3 gap-6">
        {items.map((item) => (
          <div key={item.label}>
            {/* mokal-app has `text-md`, which is not a Tailwind class and
                renders at the base size — `text-base` is what it looks like. */}
            <h6 className="mb-3 text-[#707070] text-base">{item.label}</h6>
            <div className="text-base-primary-600 text-sm">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
