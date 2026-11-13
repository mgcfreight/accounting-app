import { InstallmentFrequency, InstallmentPlanStatus, PaymentDirection } from "@/lib/enums";
import { apiClient, parseBody } from "./api-client";
import { envelope, installmentPlanSchema, paginated } from "./schemas";

// Installment plans (/installment-plan): a party's invoices, their open
// balance split into installments. Each side is listed only for a role with
// its payments view; making a plan needs the side's payments create.

export type InstallmentPlanListParams = {
  page: number;
  // At most 100.
  limit: number;
  // Omitted: both, as far as the role may see.
  direction?: PaymentDirection;
  // Omitted: running and cancelled. Live for any count or total, which
  // leave cancelled plans out (accounts, 13 Nov 2026).
  status?: InstallmentPlanStatus;
};

export type NewInstallmentPlan = {
  direction: PaymentDirection;
  partyId: string;
  // The party's owing invoices, in one currency, each in no other plan.
  invoiceIds: string[];
  // 2-12.
  count: number;
  frequency: InstallmentFrequency;
  // "YYYY-MM-DD", today or later.
  firstDueDate: string;
};

// Newest first.
export const listInstallmentPlans = (
  params: InstallmentPlanListParams,
  signal?: AbortSignal
) =>
  apiClient
    .get("/installment-plan/all", {
      params: {
        page: params.page,
        limit: params.limit,
        direction: params.direction,
        status: params.status,
      },
      signal,
    })
    .then((res) => parseBody(envelope(paginated(installmentPlanSchema)), res.data).data);

// The API works out the total and the split; nothing is calculated here.
export const createInstallmentPlan = (plan: NewInstallmentPlan) =>
  apiClient
    .post("/installment-plan", plan)
    .then((res) => parseBody(envelope(installmentPlanSchema), res.data).data);
