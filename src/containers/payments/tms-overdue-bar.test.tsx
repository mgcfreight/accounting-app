import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "@/lib/enums";
import { mockTmsOverdue } from "@/lib/mock";
import { TmsOverdueSummary } from "@/lib/interfaces";
import TmsOverdueBar, { TICKER_MS } from "./tms-overdue-bar";

const state = vi.hoisted(() => ({
  canView: true,
  canRecord: true,
  overdue: null as TmsOverdueSummary | null,
  failing: false,
}));

vi.mock("@/components/providers/user-provider", () => ({
  useCan: () => ({
    can: (permission: Permission) =>
      permission === Permission.CustomerInvoicesView
        ? state.canView
        : permission === Permission.CustomerPaymentsCreate && state.canRecord,
  }),
}));

// GET /account/overdue answers with the fixture in lib/mock unless a test
// sets its own.
vi.mock("@/services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services")>();
  return {
    ...actual,
    getOverdueShippers: vi.fn(async () => {
      if (state.failing) throw new Error("Network Error");
      return state.overdue ?? mockTmsOverdue;
    }),
  };
});

let client: QueryClient;
const show = () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<TmsOverdueBar />, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
};
const refetchAll = () => client.refetchQueries();

const bar = () => screen.getByRole("region", { name: "Overdue payments" });
const shown = () => screen.findByRole("region", { name: "Overdue payments" });
// With fake timers: let the API's answer and React Query's updates through.
const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) await vi.advanceTimersByTimeAsync(0);
  });
const shownNow = async () => {
  await settle();
  return bar();
};
const tick = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(TICKER_MS);
  });

const PRAIRIE = "Payment overdue · 1 of 3: Prairie Agri Inc. owes CAD 2,320.50";
const GREAT_LAKES = "Payment overdue · 2 of 3: Great Lakes Supply owes USD 1,475.00";
const NORTHWIND = "Payment overdue · 3 of 3: Northwind Distribution owes CAD 2,816.89";

describe("TmsOverdueBar", () => {
  beforeEach(() => {
    state.canView = true;
    state.canRecord = true;
    state.overdue = null;
    state.failing = false;
  });

  it("shows the API's overdue shippers, with no demo label", async () => {
    show();
    expect(await shown()).toHaveTextContent(/^Payment overdue · 1 of 3/);
    expect(bar()).not.toHaveTextContent(/demo/i);
    await userEvent.click(screen.getByRole("button", { name: "View All" }));
    expect(await screen.findByRole("dialog", { name: "Overdue Payments" })).toBeInTheDocument();
  });

  it("shows nothing to those who can't view shipper invoices", async () => {
    state.canView = false;
    show();
    await act(async () => {});
    expect(screen.queryByRole("region", { name: "Overdue payments" })).not.toBeInTheDocument();
  });

  it("hides older amounts when a refresh fails", async () => {
    show();
    await shown();
    state.failing = true;
    await act(async () => {
      await refetchAll();
    });
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Overdue payments" })).not.toBeInTheDocument()
    );
  });

  it("lists every shipper the totals count, even one at zero", async () => {
    state.overdue = {
      ...mockTmsOverdue,
      shippers: [
        ...mockTmsOverdue.shippers,
        {
          partyId: "USR_00ZZ",
          partyName: "Zero Balance Ltd.",
          currency: mockTmsOverdue.shippers[0].currency,
          amount: "0.00",
          invoiceCount: 0,
          oldestOverdueDays: 0,
        },
      ],
    };
    show();
    await shown();
    await userEvent.click(screen.getByRole("button", { name: "View All" }));
    const rows = within(await screen.findByRole("dialog")).getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    expect(rows[3]).toHaveTextContent("Zero Balance Ltd.");
  });

  it("stays hidden when the list can't be read", async () => {
    state.failing = true;
    show();
    await act(async () => {});
    expect(screen.queryByRole("region", { name: "Overdue payments" })).not.toBeInTheDocument();
  });

  describe("rotating", () => {
    // Plain fake timers: only tick() moves the clock, however slow the run.
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("shows each overdue shipper in turn, then starts over", async () => {
      show();
      expect(await shownNow()).toHaveTextContent(PRAIRIE);
      await tick();
      expect(bar()).toHaveTextContent(GREAT_LAKES);
      await tick();
      expect(bar()).toHaveTextContent(NORTHWIND);
      await tick();
      expect(bar()).toHaveTextContent(PRAIRIE);
    });

    it("keeps screen readers quiet while it rotates", async () => {
      show();
      expect((await shownNow()).querySelector("[aria-live]")).toHaveAttribute("aria-live", "off");
    });

    it("holds still under the pointer or focus, and after Pause", async () => {
      show();
      await shownNow();
      fireEvent.mouseEnter(bar());
      await tick();
      expect(bar()).toHaveTextContent(PRAIRIE);
      fireEvent.mouseLeave(bar());

      const clear = screen.getByRole("button", { name: "Clear payment for Prairie Agri Inc." });
      fireEvent.focus(clear);
      await tick();
      expect(bar()).toHaveTextContent(PRAIRIE);
      fireEvent.blur(clear);

      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
      await tick();
      expect(bar()).toHaveTextContent(PRAIRIE);
      expect(bar().querySelector("[aria-live]")).toHaveAttribute("aria-live", "polite");

      fireEvent.click(screen.getByRole("button", { name: "Play" }));
      await tick();
      expect(bar()).toHaveTextContent(GREAT_LAKES);
    });

    it("keeps the same shipper when a refresh re-sorts the list", async () => {
      const { rerender } = show();
      await shownNow();
      fireEvent.click(screen.getByRole("button", { name: "Next overdue payment" }));
      expect(bar()).toHaveTextContent(GREAT_LAKES);
      fireEvent.mouseEnter(bar());

      // Great Lakes moves to the end, and Prairie has paid.
      const [, greatLakes, northwind] = mockTmsOverdue.shippers;
      state.overdue = { ...mockTmsOverdue, shippers: [northwind, greatLakes] };
      await act(async () => {
        await refetchAll();
      });
      rerender(<TmsOverdueBar />);
      expect(bar()).toHaveTextContent("Great Lakes Supply owes USD 1,475.00");
    });

    it("keeps the first shipper when a refresh re-sorts before any rotation (PR #40 review)", async () => {
      const { rerender } = show();
      expect(await shownNow()).toHaveTextContent(PRAIRIE);
      fireEvent.mouseEnter(bar());

      // Prairie moves to the end before the bar has moved at all.
      const [prairie, greatLakes, northwind] = mockTmsOverdue.shippers;
      state.overdue = {
        ...mockTmsOverdue,
        shippers: [greatLakes, northwind, prairie],
      };
      await act(async () => {
        await refetchAll();
      });
      rerender(<TmsOverdueBar />);
      expect(bar()).toHaveTextContent("Prairie Agri Inc. owes CAD 2,320.50");
    });

    it("re-pins when the shown shipper leaves the list (PR #40 review)", async () => {
      const { rerender } = show();
      await shownNow();
      fireEvent.click(screen.getByRole("button", { name: "Next overdue payment" }));
      expect(bar()).toHaveTextContent(GREAT_LAKES);
      fireEvent.mouseEnter(bar());

      // Great Lakes pays and leaves; the bar falls back to the first row.
      const [prairie, greatLakes, northwind] = mockTmsOverdue.shippers;
      void greatLakes;
      state.overdue = { ...mockTmsOverdue, shippers: [prairie, northwind] };
      await act(async () => {
        await refetchAll();
      });
      rerender(<TmsOverdueBar />);
      expect(bar()).toHaveTextContent("Prairie Agri Inc. owes CAD 2,320.50");

      // A later refresh re-sorts: Prairie stays under the pointer.
      state.overdue = { ...mockTmsOverdue, shippers: [northwind, prairie] };
      await act(async () => {
        await refetchAll();
      });
      rerender(<TmsOverdueBar />);
      expect(bar()).toHaveTextContent("Prairie Agri Inc. owes CAD 2,320.50");
    });

    it("steps back and forward with the arrows", async () => {
      show();
      await shownNow();
      fireEvent.click(screen.getByRole("button", { name: "Previous overdue payment" }));
      expect(bar()).toHaveTextContent(NORTHWIND);
      fireEvent.click(screen.getByRole("button", { name: "Next overdue payment" }));
      expect(bar()).toHaveTextContent(PRAIRIE);
    });
  });

  it("lists every shipper, with the totals per currency", async () => {
    show();
    await shown();
    await userEvent.click(screen.getByRole("button", { name: "View All" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Total overdue: CAD 5,137.39 · USD 1,475.00");
    const rows = within(dialog).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Prairie Agri Inc."),
      expect.stringContaining("Great Lakes Supply"),
      expect.stringContaining("Northwind Distribution"),
    ]);
    expect(rows[1]).toHaveTextContent("USD 1,475.00");
  });

  it("lists a shipper owing in two currencies once per currency", async () => {
    const prairie = mockTmsOverdue.shippers[0];
    state.overdue = {
      shippers: [prairie, { ...prairie, currency: mockTmsOverdue.shippers[1].currency, amount: "10.00" }],
      totals: mockTmsOverdue.totals,
      oldestOverdueDays: prairie.oldestOverdueDays,
    };
    show();
    await shown();
    await userEvent.click(screen.getByRole("button", { name: "View All" }));
    const rows = within(await screen.findByRole("dialog")).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent("USD 10.00");
  });

  it("opens Record Payment on money in for the chosen shipper", async () => {
    show();
    await shown();
    await userEvent.click(screen.getByRole("button", { name: "View All" }));
    const rows = within(await screen.findByRole("dialog")).getAllByRole("listitem");
    await userEvent.click(within(rows[1]).getByRole("button", { name: "Clear Payment" }));

    const form = await screen.findByRole("dialog", { name: "Record Payment" });
    // What the direction select shows as chosen (every option is also in the
    // DOM, in HeroUI's hidden <select>, so the dialog's text alone proves
    // nothing).
    const chosen = [...form.querySelectorAll("[data-slot=value]")].map((el) => el.textContent);
    expect(chosen[0]).toBe("Money in (from a shipper)");
  });

  it("names a single overdue shipper, with no count or controls", async () => {
    state.overdue = {
      ...mockTmsOverdue,
      shippers: [mockTmsOverdue.shippers[0]],
      totals: [{ currency: mockTmsOverdue.shippers[0].currency, amount: "2320.50" }],
    };
    show();
    expect(await shown()).toHaveTextContent(
      "Payment overdue: Prairie Agri Inc. owes CAD 2,320.50 on 1 invoice, the oldest 66 days past due."
    );
    expect(screen.queryByRole("button", { name: "View All" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clear payment for Prairie Agri Inc." })
    ).toBeInTheDocument();
  });

  it("hides Clear Payment from those who can't record payments, but still lists", async () => {
    state.canRecord = false;
    show();
    await shown();
    expect(screen.queryByRole("button", { name: /Clear payment/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View All" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Clear Payment" })).not.toBeInTheDocument();
  });

  it("shows nothing when no one is overdue, and goes away when dismissed", async () => {
    state.overdue = { shippers: [], totals: [], oldestOverdueDays: 0 };
    const { unmount } = show();
    await act(async () => {});
    expect(screen.queryByRole("region", { name: "Overdue payments" })).not.toBeInTheDocument();
    unmount();

    state.overdue = null;
    show();
    await shown();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("region", { name: "Overdue payments" })).not.toBeInTheDocument();
  });
});
