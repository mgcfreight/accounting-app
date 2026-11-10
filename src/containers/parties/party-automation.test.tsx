import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PartyType } from "@/lib/enums";
import { PartyAutomation } from "@/lib/interfaces";
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
