import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { openPrintWindow, printInto } from "@/lib/export";
import { CompanySettings } from "@/lib/interfaces";
import { errorMessage, getCompanySettings } from "@/services";
import { SETTINGS_QUERY } from "../settings/company-information";
import { fetchInvoice, isDemoInvoice } from "./demo-invoices";
import { MalformedAmountError, toInvoicePdfHtml } from "./invoice-pdf";
import { directionOf, InvoiceView } from "./invoice-view";

const NO_COMPANY: CompanySettings = {
  legalName: null,
  gstHstNumber: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  province: null,
  postalCode: null,
  country: null,
  accountsNotificationEmail: null,
  updatedAt: null,
  updatedBy: null,
};

export type InvoicePdfRequest = {
  invoice: InvoiceView;
  partyName: string;
  // Every version of the invoice, oldest first, when known: for "Version 2
  // of 3" and the versions this one replaced and was replaced by.
  versions?: InvoiceView[];
};

// Prints one version of an invoice for the browser to save as a PDF. The
// version is read again from the API, so the PDF carries its lines and
// what the API holds now, not a list row.
export default function useInvoicePdf() {
  const queryClient = useQueryClient();

  return async ({ invoice, partyName, versions }: InvoicePdfRequest) => {
    // Opened in the click, before any await, or a pop-up blocker stops it.
    const view = openPrintWindow();
    if (!view) {
      toast.error("The print window was blocked. Allow pop-ups for this site and try again.");
      return;
    }
    try {
      const [full, company] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ["invoices", directionOf(invoice), "detail", invoice.id],
          queryFn: ({ signal }) =>
            fetchInvoice(directionOf(invoice), invoice.id, signal),
        }),
        queryClient
          .fetchQuery({
            queryKey: SETTINGS_QUERY.company,
            queryFn: ({ signal }) => getCompanySettings(signal),
            staleTime: 5 * 60_000,
          })
          .catch((error: unknown) => error as Error),
      ]);
      const demo = isDemoInvoice(full);
      // A real invoice isn't printed without MGC's details; a demo one,
      // stamped DEMO, can be.
      if (company instanceof Error && !demo) throw company;
      printInto(
        view,
        toInvoicePdfHtml({
          invoice: full,
          demo,
          partyName,
          company: company instanceof Error ? NO_COMPANY : company,
          versionCount: versions?.length,
          replaces: versions?.find((version) => version.id === full.parentInvoiceId),
          replacedBy: versions?.find((version) => version.parentInvoiceId === full.id),
        })
      );
    } catch (error) {
      view.close();
      toast.error(
        error instanceof MalformedAmountError
          ? "This invoice has an amount that couldn't be read, so no PDF was made. Please report it."
          : `Couldn't make the PDF: ${errorMessage(error)}`
      );
    }
  };
}
