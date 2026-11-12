import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AutomationKind, PartyType } from "@/lib/enums";
import { ContactView, PartyAutomation } from "@/lib/interfaces";
import { seedAutomation, SettingsDays } from "./automation-rules";
import PartyAutomationCard from "./party-automation";

const saveAutomation = vi.hoisted(() => vi.fn());

vi.mock("@/services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services")>();
  return { ...actual, saveAutomation };
});

const NO_DAYS: SettingsDays = { billingNoticeDays: null, carrierAlertDays: null };

const answer = (automation: PartyAutomation) => ({
  automation,
  updatedAt: "2026-11-10T10:00:00.000Z",
  updatedBy: null,
});

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PartyAutomationCard
        partyId="pty_1"
        type={PartyType.Shipper}
        agreement={undefined}
        saved={null}
        savedAt={null}
        days={NO_DAYS}
        contacts={{ status: "success", contacts: [] }}
        canEdit
      />
    </QueryClientProvider>
  );

const reminders = () => screen.getByRole("switch", { name: "Reminders before due" });

describe("PartyAutomationCard saves", () => {
  beforeEach(() => saveAutomation.mockReset());

  it("puts the card back to what the server confirmed when a save fails", async () => {
    saveAutomation.mockRejectedValueOnce(new Error("Network Error"));
    show();
    expect(reminders()).toBeChecked();
    await userEvent.click(reminders());
    await waitFor(() => expect(reminders()).toBeChecked());
    expect(saveAutomation).toHaveBeenCalledTimes(1);
  });

  it("saves one change at a time", async () => {
    let finish: (value: unknown) => void = () => {};
    saveAutomation.mockImplementationOnce(
      (_id: string, next: PartyAutomation) =>
        new Promise((resolve) => (finish = () => resolve(answer(next))))
    );
    show();
    await userEvent.click(reminders());
    // While the first save is pending, the controls wait.
    await userEvent.click(screen.getByRole("switch", { name: "Overdue reminders" }));
    expect(saveAutomation).toHaveBeenCalledTimes(1);
    finish(undefined);
    await waitFor(() => expect(reminders()).not.toBeChecked());
  });

  it("keeps the Customise form open, with the edits, when its save fails", async () => {
    saveAutomation.mockRejectedValueOnce(new Error("Network Error"));
    show();
    const row = reminders().closest("div.flex.flex-wrap") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Customise" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("switch", { name: /Customise for this party/ }));
    const subject = within(dialog).getByLabelText("Subject");
    await userEvent.clear(subject);
    await userEvent.type(subject, "Please pay soon");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByText(/Not saved/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(within(dialog).getByLabelText("Subject")).toHaveValue("Please pay soon");
  });
});

// Keeps the fixture honest: the card starts from the seeded settings.
it("starts from the company defaults for a party with nothing saved", () => {
  const seeded = seedAutomation(PartyType.Shipper, undefined, NO_DAYS);
  expect(seeded.rules.length).toBeGreaterThan(0);
});

describe("PartyAutomationCard after the PR #41 re-review", () => {
  beforeEach(() => saveAutomation.mockReset());

  const contact = (id: string): ContactView => ({
    id,
    partyId: "pty_1",
    name: id,
    email: `${id}@example.com`,
    phone: null,
    receivesInvoices: true,
    receivesReminders: true,
    receivesStatements: true,
    isActive: true,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
  });

  type Props = Partial<ComponentProps<typeof PartyAutomationCard>>;
  const mount = (props: Props = {}) => {
    const client = new QueryClient();
    const card = (more: Props) => (
      <QueryClientProvider client={client}>
        <PartyAutomationCard
          partyId="pty_1"
          type={PartyType.Shipper}
          agreement={undefined}
          saved={null}
          savedAt={null}
          days={NO_DAYS}
          contacts={{ status: "success", contacts: [] }}
          canEdit
          {...props}
          {...more}
        />
      </QueryClientProvider>
    );
    const view = render(card({}));
    return { ...view, update: (more: Props) => view.rerender(card(more)) };
  };

  const sent = (call = 0) => saveAutomation.mock.calls[call][1] as PartyAutomation;
  const sentRule = (kind: AutomationKind, call = 0) =>
    sent(call).rules.find((rule) => rule.kind === kind)!;

  it("ignores settings older than the last save, and takes in newer ones", async () => {
    const before = seedAutomation(PartyType.Shipper, undefined, NO_DAYS);
    saveAutomation.mockImplementationOnce(async (_id: string, next: PartyAutomation) => ({
      automation: next,
      updatedAt: "2026-11-12T10:00:00.000Z",
      updatedBy: null,
    }));
    const { update } = mount({ saved: before, savedAt: "2026-11-11T10:00:00.000Z" });
    await userEvent.click(reminders());
    await waitFor(() => expect(reminders()).not.toBeChecked());

    // A GET that started during the save lands with the old settings.
    update({ saved: before, savedAt: "2026-11-11T10:00:00.000Z" });
    expect(reminders()).not.toBeChecked();

    // Someone else switches them back on later.
    update({ saved: before, savedAt: "2026-11-12T11:00:00.000Z" });
    expect(reminders()).toBeChecked();
  });

  it("drops contacts no longer active before saving, and says so", async () => {
    saveAutomation.mockImplementation(async (_id: string, next: PartyAutomation) => answer(next));
    const saved = seedAutomation(PartyType.Shipper, undefined, NO_DAYS);
    saved.rules = saved.rules.map((rule) =>
      rule.kind === AutomationKind.Overdue
        ? { ...rule, custom: true, contactIds: ["con_active", "con_gone"] }
        : rule
    );
    mount({
      saved,
      savedAt: "2026-11-10T10:00:00.000Z",
      contacts: { status: "success", contacts: [contact("con_active")] },
    });
    expect(screen.getByText(/A contact chosen here is no longer active/)).toBeInTheDocument();

    // Any save for the party, not only this rule's.
    await userEvent.click(reminders());
    await waitFor(() => expect(saveAutomation).toHaveBeenCalled());
    expect(sentRule(AutomationKind.Overdue).contactIds).toEqual(["con_active"]);
  });

  it("saves a default rule with today's Settings days", async () => {
    saveAutomation.mockImplementation(async (_id: string, next: PartyAutomation) => answer(next));
    // Saved when Settings said 5 days; Settings now says 10.
    const saved = seedAutomation(PartyType.Shipper, undefined, {
      billingNoticeDays: 5,
      carrierAlertDays: null,
    });
    mount({
      saved,
      savedAt: "2026-11-10T10:00:00.000Z",
      days: { billingNoticeDays: 10, carrierAlertDays: null },
    });
    await userEvent.click(reminders());
    await waitFor(() => expect(saveAutomation).toHaveBeenCalled());
    expect(sentRule(AutomationKind.BillingNotice).steps).toEqual([10]);
  });

  it("labels where each default comes from", () => {
    mount({ days: { billingNoticeDays: 10, carrierAlertDays: null } });
    expect(screen.getByText("Default, days from Settings")).toBeInTheDocument();
    expect(screen.getAllByText("Built-in default").length).toBeGreaterThan(0);
  });

  it("keeps the pause form open, with the reason, when its save fails", async () => {
    saveAutomation.mockRejectedValueOnce(new Error("Network Error"));
    mount();
    await userEvent.click(screen.getByRole("switch", { name: /Pause all notifications/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Reason (optional)"), "Account review");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saveAutomation).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(within(dialog).getByLabelText("Reason (optional)")).toHaveValue("Account review");
  });

  it("keeps the Customise buttons in place, disabled, while a save is pending", async () => {
    saveAutomation.mockImplementationOnce(() => new Promise(() => {}));
    mount();
    const before = screen.getAllByRole("button", { name: "Customise" }).length;
    await userEvent.click(reminders());
    const buttons = screen.getAllByRole("button", { name: "Customise" });
    expect(buttons).toHaveLength(before);
    buttons.forEach((button) => expect(button).toBeDisabled());
  });
});
