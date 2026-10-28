import { useQuery } from "@tanstack/react-query";
import { BaseTable, ErrorState } from "@/components/common";
import { CustomerInvoiceView } from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import { listCustomerInvoices } from "@/services";
import InvoiceViewCell from "../invoices/invoice-view";

const columns: BaseTableColumn[] = [
  { key: "number", label: "Invoice #" },
  { key: "party", label: "Shipper" },
  { key: "dueDate", label: "Due Date" },
  { key: "total", label: "Total" },
  { key: "balance", label: "Balance" },
  { key: "status", label: "Status" },
];

const params = { page: 1, limit: 5 };

// The latest shipper invoices, from the Accounts API: the one live panel on
// the dashboard. The caller shows it only to those who may view them.
export default function RecentInvoices() {
  const invoices = useQuery({
    queryKey: ["invoices", "dashboard", params],
    queryFn: ({ signal }) => listCustomerInvoices(params, signal),
  });

  if (invoices.isError) {
    return (
      <ErrorState
        message="We couldn't load the invoices. Please try again."
        onAction={() => void invoices.refetch()}
      />
    );
  }

  return (
    <BaseTable<CustomerInvoiceView>
      ariaLabel="Recent shipper invoices"
      columns={columns}
      data={invoices.data?.items ?? []}
      loading={invoices.isPending}
      rowKey={(row) => row.id}
      renderCell={(row, key) => <InvoiceViewCell invoice={row} columnKey={key} />}
      emptyContent="No shipper invoices yet"
    />
  );
}
