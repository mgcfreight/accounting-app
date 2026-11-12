import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PartyType } from "@/lib/enums";
import { PartyAutomationContacts } from "./party-detail";

const state = vi.hoisted(() => ({ automationFails: false, noticesFail: false }));

vi.mock("@/services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services")>();
  return {
    ...actual,
    // Shown word for word, so the test can tell the two failures apart.
    listContacts: vi.fn(async () => []),
    getAutomation: vi.fn(async () => {
      if (state.automationFails) throw new actual.UserFacingError("Automation unavailable");
      return {
        partyId: "pty_1",
        automation: null,
        updatedAt: null,
        updatedBy: null,
      };
    }),
    getNoticeSettings: vi.fn(async () => {
      if (state.noticesFail) throw new actual.UserFacingError("Settings unavailable");
      return {
        defaultNoticeDays: {},
        carrierAlertDaysBefore: null,
        updatedAt: null,
        updatedBy: null,
      };
    }),
  };
});

const show = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PartyAutomationContacts
        partyId="pty_1"
        type={PartyType.Shipper}
        agreement={undefined}
        canEdit
      />
    </QueryClientProvider>
  );
  return client;
};

describe("PartyAutomationContacts (PR #41 review)", () => {
  beforeEach(() => {
    state.automationFails = false;
    state.noticesFail = false;
  });

  it("keeps the card when a refetch fails with data present", async () => {
    const client = show();
    expect(await screen.findByRole("switch", { name: "Reminders before due" })).toBeInTheDocument();

    state.automationFails = true;
    await act(async () => {
      await client.refetchQueries();
    });
    expect(screen.getByRole("switch", { name: "Reminders before due" })).toBeInTheDocument();
    expect(screen.queryByText("Automation unavailable")).not.toBeInTheDocument();
  });

  it("shows the error of the query that failed, not an older one beside data", async () => {
    const client = show();
    await screen.findByRole("switch", { name: "Reminders before due" });

    // The automation refetch fails but keeps its data; then Settings is
    // dropped and fails to load at all.
    state.automationFails = true;
    await act(async () => {
      await client.refetchQueries({ queryKey: ["parties", "automation", "pty_1"] });
    });
    state.noticesFail = true;
    await act(async () => {
      await client.resetQueries({ queryKey: ["settings", "notices"] });
    });

    expect(await screen.findByText("Settings unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Automation unavailable")).not.toBeInTheDocument();
  });
});
