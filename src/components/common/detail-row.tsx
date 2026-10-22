import { ReactNode } from "react";

// Label …………… value, with a dotted leader — the Payment Details rows on
// mokal-app's invoice page.
export default function DetailRow({
  label,
  value,
  strong = false,
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        strong ? "text-sm font-semibold" : "text-xs"
      }`}
    >
      <span className="text-base-primary">{label}</span>
      <span className="flex-1 border-b border-dotted border-gray-300" />
      <span>{value}</span>
    </div>
  );
}
