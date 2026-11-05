import { AlertBanner } from "@/components/common";

// Says the figures on screen are lib/mock's, not the API's (demo-invoices.ts).
export function DemoInvoicesBanner({ list = false }: { list?: boolean }) {
  return (
    <AlertBanner
      message={
        list
          ? "Demo data: the Accounts API has no invoices to show, so these are sample invoices. Search and the payment filter don't apply to them, and nothing here can be changed."
          : "Demo data: this is a sample invoice, not one from the Accounts API. Its PDF is stamped DEMO, and nothing here can be changed."
      }
    />
  );
}
