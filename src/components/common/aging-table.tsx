import { AgingRow } from "@/lib/interfaces";
import Money from "./money";

// Aging buckets by due date (design §8.6), disputed in its own column.
const buckets: { key: keyof AgingRow; label: string }[] = [
  { key: "current", label: "Current" },
  { key: "days1to30", label: "1–30" },
  { key: "days31to60", label: "31–60" },
  { key: "days61to90", label: "61–90" },
  { key: "days90plus", label: "90+" },
  { key: "disputed", label: "Disputed" },
  { key: "total", label: "Total" },
];

export default function AgingTable({ rows }: { rows: AgingRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-default-500">
            <th className="py-2 pr-3 font-medium" />
            {buckets.map((bucket) => (
              <th key={bucket.key} className="py-2 px-2 font-medium text-right">
                {bucket.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="py-2 pr-3 font-semibold text-base-primary whitespace-nowrap">
                {row.label}
              </td>
              {buckets.map((bucket) => (
                <td
                  key={bucket.key}
                  className={`py-2 px-2 text-right ${
                    bucket.key === "total" ? "font-semibold" : ""
                  }`}
                >
                  <Money
                    amount={row[bucket.key] as string}
                    currency={row.currency}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
