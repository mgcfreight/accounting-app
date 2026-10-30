import {
  CarrierInvoiceStatus,
  CustomerInvoiceStatus,
  Permission,
} from "@/lib/enums";
import { paymentTermsLabels } from "@/lib/constants";
import { escapeHtml } from "@/lib/export";
import { CompanySettings } from "@/lib/interfaces";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  invoiceNumberOf,
  InvoiceView,
  isCustomerInvoice,
  isSuperseded,
  owesNothingYet,
  referencesOf,
} from "./invoice-view";

// The printed invoice: one version of it, as the invoice page shows it,
// for the browser to save as a PDF. A stopgap until the API generates the
// PDF (design §10: pdfmake). Every value is the API's, formatted for
// reading; nothing is calculated here, and every value is escaped.

// A draft or an awaited carrier bill has nothing to print yet.
export const isPrintable = (invoice: InvoiceView) =>
  isCustomerInvoice(invoice)
    ? invoice.status !== CustomerInvoiceStatus.Draft
    : invoice.status !== CarrierInvoiceStatus.Expected;

export const canExportPdf = (
  invoice: InvoiceView,
  can: (permission: Permission) => boolean
) =>
  can(
    isCustomerInvoice(invoice)
      ? Permission.CustomerInvoicesExportPdf
      : Permission.CarrierInvoicesExportPdf
  );

// "Version 2 of 3": revision 0 is the first version.
export const versionLabel = (invoice: InvoiceView, count?: number) =>
  `Version ${invoice.revision + 1}${count ? ` of ${count}` : ""}`;

const isVoid = (invoice: InvoiceView) =>
  invoice.status === CustomerInvoiceStatus.Void ||
  invoice.status === CarrierInvoiceStatus.Void;

// A wrong amount on a PDF someone sends on is worse than no PDF: a
// malformed one stops the print rather than showing a dash or 0.00.
export class MalformedAmountError extends Error {}

const moneyOf = (amount: string, invoice: InvoiceView) => {
  const text = formatMoney(amount, invoice.currency);
  if (text === null) {
    throw new MalformedAmountError(`Malformed amount "${amount}"`);
  }
  return escapeHtml(text);
};

const lines = (...parts: (string | null | undefined)[]) =>
  parts
    .filter((part): part is string => !!part)
    .map(escapeHtml)
    .join("<br>");

export type InvoicePdfInput = {
  // One version, from the single-invoice endpoint (it carries the lines).
  invoice: InvoiceView;
  // The carrier's name, or the customer's as billed.
  partyName: string;
  company: CompanySettings;
  // How many versions the invoice has, for "Version 2 of 3".
  versionCount?: number;
  // The version that replaced this one, when it has been replaced.
  replacedBy?: InvoiceView;
  // The version this one replaced.
  replaces?: InvoiceView;
  // Sample data from lib/mock, not the API's: stamped so it's never sent.
  demo?: boolean;
};

// The page title is also the file name "Save as PDF" suggests.
export const invoicePdfTitle = (invoice: InvoiceView) => {
  const number = invoiceNumberOf(invoice) ?? "draft";
  const kind = isCustomerInvoice(invoice) ? "Invoice" : "Carrier bill";
  return `${kind} ${number} - ${versionLabel(invoice)}`;
};

// What stands out across the page when this version isn't the one to pay.
const stampOf = (invoice: InvoiceView) =>
  isSuperseded(invoice) ? "REPLACED" : isVoid(invoice) ? "VOID" : null;

export const toInvoicePdfHtml = ({
  invoice,
  partyName,
  company,
  versionCount,
  replacedBy,
  replaces,
  demo = false,
}: InvoicePdfInput): string => {
  const customer = isCustomerInvoice(invoice);
  const number = invoiceNumberOf(invoice);
  const stamp = demo ? "DEMO" : stampOf(invoice);
  const money = (amount: string) => moneyOf(amount, invoice);

  const from = lines(
    company.legalName,
    company.addressLine1,
    company.addressLine2,
    [company.city, company.province, company.postalCode].filter(Boolean).join(" "),
    company.country,
    company.gstHstNumber && `GST/HST # ${company.gstHstNumber}`
  );

  const party = customer
    ? lines(
        invoice.billTo.name,
        invoice.billTo.legal_name,
        invoice.billTo.address_line1,
        invoice.billTo.address_line2,
        [invoice.billTo.city, invoice.billTo.province, invoice.billTo.postal_code]
          .filter(Boolean)
          .join(" "),
        invoice.billTo.country,
        invoice.billTo.gst_hst_number &&
          `GST/HST # ${invoice.billTo.gst_hst_number}`
      )
    : lines(
        partyName,
        invoice.carrierInvoiceNumber && `Carrier bill # ${invoice.carrierInvoiceNumber}`
      );

  const facts: [string, string][] = [
    [customer ? "Invoice #" : "Reference #", number ?? "No number yet"],
    ["Version", versionLabel(invoice, versionCount)],
    ["Invoice date", formatDate(invoice.invoiceDate ?? undefined) ?? "—"],
    ["Due date", formatDate(invoice.dueDate ?? undefined) ?? "—"],
    ["Terms", paymentTermsLabels[invoice.paymentTerms]],
    ["Currency", invoice.currency],
    ...(invoice.fxRateToCad !== null
      ? [["Rate to CAD", invoice.fxRateToCad] as [string, string]]
      : []),
    ...referencesOf(invoice).map(
      (ref) => [ref.label, ref.value] as [string, string]
    ),
  ];

  // Why this version exists, or why it's no longer the one to pay.
  const notices: string[] = [];
  if (demo) {
    notices.push("Demo data: a sample invoice, not a real one. Do not send it.");
  }
  if (replaces) {
    notices.push(
      `Revised invoice: replaces ${invoiceNumberOf(replaces) ?? "the earlier version"} (${versionLabel(replaces)}).`
    );
  }
  if (isSuperseded(invoice)) {
    notices.push(
      `This version was replaced${
        replacedBy
          ? ` by ${invoiceNumberOf(replacedBy) ?? "a newer version"} (${versionLabel(replacedBy)})`
          : ""
      }${
        invoice.supersededAt ? ` on ${formatDateTime(invoice.supersededAt)}` : ""
      }. It is kept as it was sent; do not pay against it.`
    );
  }
  if (isVoid(invoice)) notices.push("This invoice is void; nothing is owed on it.");

  // Markup: the words are plain, the amount escaped by money().
  const balance = isVoid(invoice)
    ? "—"
    : isSuperseded(invoice)
      ? "Replaced"
      : owesNothingYet(invoice)
        ? "Not issued"
        : money(invoice.balanceDue);

  const lineRows = (invoice.lines ?? [])
    .map(
      (line) => `<tr><td>${escapeHtml(line.description)}<div class="sub">${escapeHtml(
        line.chargeTypeCode
      )}${line.isTaxable ? "" : " · not taxed"}</div></td><td class="num">${escapeHtml(
        line.quantity
      )}</td><td class="num">${escapeHtml(
        // A rate with its own precision ("1100.0000"), not an amount: shown
        // as sent, beside its currency, as the invoice page shows it.
        `${invoice.currency} ${line.unitPrice}`
      )}</td><td class="num">${money(
        line.amount
      )}</td></tr>`
    )
    .join("");

  const taxRows = invoice.taxes
    .map(
      (tax) =>
        `<tr><td>${escapeHtml(
          `${tax.code} ${tax.rate_percent}%${tax.jurisdiction ? ` (${tax.jurisdiction})` : ""}`
        )} on ${money(tax.taxable_amount)}</td><td class="num">${money(
          tax.tax_amount
        )}</td></tr>`
    )
    .join("");

  const title = invoicePdfTitle(invoice);

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page{margin:16mm}
body{font-family:Lato,Arial,sans-serif;color:#1f2937;margin:24px;font-size:12px;position:relative}
h1{font-size:22px;margin:0}
.top{display:flex;justify-content:space-between;gap:24px;margin-bottom:24px}
.label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:4px}
.facts td{padding:2px 0 2px 16px;text-align:right}.facts td:first-child{color:#6b7280}
.notice{border:1px solid #f59e0b;background:#fffbeb;padding:8px 12px;margin-bottom:16px}
table.lines{border-collapse:collapse;width:100%;margin-top:16px}
.lines th,.lines td{border-bottom:1px solid #e5e7eb;padding:6px 8px;text-align:left;vertical-align:top}
.lines th{background:#f3f4f6}
.num{text-align:right;white-space:nowrap}
.sub{color:#6b7280;font-size:10px}
table.totals{margin-left:auto;margin-top:16px;border-collapse:collapse;min-width:50%}
.totals td{padding:4px 8px}.totals .grand td{font-size:15px;font-weight:bold;border-top:2px solid #1f2937}
.stamp{position:fixed;top:40%;left:0;right:0;text-align:center;font-size:96px;font-weight:bold;color:rgba(220,38,38,.15);transform:rotate(-24deg);pointer-events:none}
</style></head><body>
${stamp ? `<div class="stamp">${stamp}</div>` : ""}
<div class="top">
<div><h1>${customer ? "Invoice" : "Carrier bill"}${number ? ` ${escapeHtml(number)}` : ""}</h1>
${from ? `<p>${from}</p>` : ""}</div>
<table class="facts">${facts
    .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`)
    .join("")}</table>
</div>
${notices.map((notice) => `<div class="notice">${escapeHtml(notice)}</div>`).join("")}
<div class="label">${customer ? "Bill to" : "Carrier"}</div>
<p>${party}</p>
<table class="lines"><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead>
<tbody>${lineRows || "<tr><td colspan=\"4\">No charges.</td></tr>"}</tbody></table>
<table class="totals">
<tr><td>Subtotal</td><td class="num">${money(invoice.subtotal)}</td></tr>
${taxRows}
<tr><td>${customer ? "Tax" : "Tax (input tax credit)"}</td><td class="num">${money(invoice.taxTotal)}</td></tr>
<tr class="grand"><td>Total</td><td class="num">${money(invoice.total)}</td></tr>
<tr><td>Paid</td><td class="num">${money(invoice.amountPaid)}</td></tr>
<tr><td>Balance due</td><td class="num">${balance}</td></tr>
</table>
</body></html>`;
};
