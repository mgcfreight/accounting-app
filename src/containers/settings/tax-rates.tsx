import { toast } from "sonner";
import { AlertBanner, BaseTable, RowActions } from "@/components/common";
import { EditSm } from "@/components/icons";
import { TaxRate } from "@/lib/interfaces";
import { mockTaxRates } from "@/lib/mock";
import { BaseTableColumn } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const columns: BaseTableColumn[] = [
  { key: "code", label: "Code" },
  { key: "province", label: "Applies To" },
  { key: "taxType", label: "Type" },
  { key: "ratePercent", label: "Rate" },
  { key: "effectiveFrom", label: "Effective From" },
  { key: "actions", label: "" },
];

// The tax table (design §8.3). Rates are settings so finance can change them
// without a release; a new rate gets a new effective date rather than
// overwriting history.
export default function TaxRates() {
  return (
    <div className="border-t-1 py-6">
      <AlertBanner message="Starting rates — verify with MGC's accountant before go-live. Whether provincial PST applies to freight is still to be confirmed." />
      <BaseTable<TaxRate>
        ariaLabel="Tax rates"
        columns={columns}
        data={mockTaxRates}
        rowKey={(row) => row.id}
        renderCell={(row, key) => {
          switch (key) {
            case "code":
              return <span className="font-bold text-base-primary-300">{row.code}</span>;
            case "ratePercent":
              return `${row.ratePercent}%`;
            case "effectiveFrom":
              return formatDate(row.effectiveFrom);
            case "actions":
              return (
                <RowActions
                  actions={[
                    {
                      key: "new-rate",
                      label: "Add new rate from a date",
                      icon: <EditSm />,
                      onPress: () => toast.info("New tax rate — demo only, nothing was saved."),
                    },
                  ]}
                />
              );
            default:
              return String(row[key as keyof TaxRate]);
          }
        }}
      />
    </div>
  );
}
