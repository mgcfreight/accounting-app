import { PaymentTerms } from "@/lib/enums";
import { AgreementView, NoticeSettings } from "@/lib/interfaces";
import { addDays } from "@/lib/utils";
import { InvoiceView, isCustomerInvoice, isOwed } from "./invoice-view";

export type PaymentReminder = { remindOn: string; daysBefore: number };

// When an owed invoice's payment reminder goes out, counted back from its
// due date: a shipper's email by the agreement's noticeDaysBefore, else
// Settings' default for its terms (COD and prepaid have none); a carrier
// bill's team alert by the agreement's alertDaysBefore, else Settings'.
// null when none will go: reminders are off in the agreement, no days are
// set, or the day has passed. YYYY-MM-DD strings compare correctly as text.
// TODO: none for a disputed invoice either, once the API records disputes.
export const paymentReminder = (
  invoice: InvoiceView,
  agreement: Pick<
    AgreementView,
    "remindersEnabled" | "noticeDaysBefore" | "alertDaysBefore"
  >,
  settings: Pick<NoticeSettings, "defaultNoticeDays" | "carrierAlertDaysBefore">,
  today: string
): PaymentReminder | null => {
  if (!isOwed(invoice) || !invoice.dueDate || !agreement.remindersEnabled) {
    return null;
  }
  const defaultDays: Partial<Record<PaymentTerms, number>> =
    settings.defaultNoticeDays;
  const daysBefore = isCustomerInvoice(invoice)
    ? agreement.noticeDaysBefore ?? defaultDays[invoice.paymentTerms] ?? null
    : agreement.alertDaysBefore ?? settings.carrierAlertDaysBefore;
  if (daysBefore === null) return null;
  const remindOn = addDays(invoice.dueDate, -daysBefore);
  return remindOn < today ? null : { remindOn, daysBefore };
};
