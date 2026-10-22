import { BaseTable } from "@/components/common";
import { Invoice } from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import InvoiceCell from "../invoices/invoice-cell";

const columns: BaseTableColumn[] = [
  { key: "number", label: "Invoice #" },
  { key: "party", label: "Shipper" },
  { key: "dueDate", label: "Due Date" },
  { key: "total", label: "Total" },
  { key: "balance", label: "Balance" },
  { key: "status", label: "Status" },
];

export default function RecentInvoices({ invoices }: { invoices: Invoice[] }) {
  return (
    <BaseTable
      ariaLabel="Recent shipper invoices"
      columns={columns}
      data={invoices}
      rowKey={(row) => row.id}
      renderCell={(row, key) => <InvoiceCell invoice={row} columnKey={key} />}
    />
  );
}
