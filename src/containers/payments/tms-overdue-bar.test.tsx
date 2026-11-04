import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockTmsOverdue } from "@/lib/mock";
import { TmsOverdueSummary } from "@/lib/interfaces";
import TmsOverdueBar, { TICKER_MS } from "./tms-overdue-bar";

const state = vi.hoisted(() => ({
  canRecord: true,
  overdue: null as TmsOverdueSummary | null,
}));

vi.mock("@/components/providers/user-provider", () => ({
  useCan: () => ({ can: () => state.canRecord }),
}));

vi.mock("@/lib/mock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mock")>();
  return {
    ...actual,
    get mockTmsOverdue() {
      return state.overdue ?? actual.mockTmsOverdue;
    },
  };
});

const bar = () => screen.getByRole("region", { name: "Overdue payments" });
const tick = () => act(() => vi.advanceTimersByTime(TICKER_MS));

const PRAIRIE = "Payment overdue in the TMS · 1 of 3: Prairie Agri Inc. owes CAD 2,320.50";
const GREAT_LAKES = "Payment overdue in the TMS · 2 of 3: Great Lakes Supply owes USD 1,475.00";
const NORTHWIND = "Payment overdue in the TMS · 3 of 3: Northwind Distribution owes CAD 2,816.89";

describe("TmsOverdueBar", () => {
  beforeEach(() => {
    state.canRecord = true;
    state.overdue = null;
  });

  describe("rotating", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("shows each overdue shipper in turn, then starts over", () => {
      render(<TmsOverdueBar />);
      expect(bar()).toHaveTextContent(PRAIRIE);
      tick();
      expect(bar()).toHaveTextContent(GREAT_LAKES);
      tick();
      expect(bar()).toHaveTextContent(NORTHWIND);
      tick();
      expect(bar()).toHaveTextContent(PRAIRIE);
    });

    it("keeps screen readers quiet while it rotates", () => {
      render(<TmsOverdueBar />);
      expect(bar().querySelector("[aria-live]")).toHaveAttribute("aria-live", "off");
    });

    it("holds still under the pointer or focus, and after Pause", () => {
      render(<TmsOverdueBar />);
      fireEvent.mouseEnter(bar());
      tick();
      expect(bar()).toHaveTextContent(PRAIRIE);
      fireEvent.mouseLeave(bar());

      const clear = screen.getByRole("button", { name: "Clear payment for Prairie Agri Inc." });
      fireEvent.focus(clear);
      tick();
      expect(bar()).toHaveTextContent(PRAIRIE);
      fireEvent.blur(clear);

      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
      tick();
      expect(bar()).toHaveTextContent(PRAIRIE);
      expect(bar().querySelector("[aria-live]")).toHaveAttribute("aria-live", "polite");

      fireEvent.click(screen.getByRole("button", { name: "Play" }));
      tick();
      expect(bar()).toHaveTextContent(GREAT_LAKES);
    });

    it("steps back and forward with the arrows", () => {
      render(<TmsOverdueBar />);
      fireEvent.click(screen.getByRole("button", { name: "Previous overdue payment" }));
      expect(bar()).toHaveTextContent(NORTHWIND);
      fireEvent.click(screen.getByRole("button", { name: "Next overdue payment" }));
      expect(bar()).toHaveTextContent(PRAIRIE);
    });
  });

  it("lists every shipper, with the totals per currency", async () => {
    render(<TmsOverdueBar />);
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

  it("opens Record Payment for the chosen shipper in their currency", async () => {
    render(<TmsOverdueBar />);
    await userEvent.click(screen.getByRole("button", { name: "View All" }));
    const rows = within(await screen.findByRole("dialog")).getAllByRole("listitem");
    await userEvent.click(within(rows[1]).getByRole("button", { name: "Clear Payment" }));

    const form = await screen.findByRole("dialog", { name: "Record Payment" });
    // What each select shows as chosen (every option is also in the DOM, in
    // HeroUI's hidden <select>, so the dialog's text alone proves nothing).
    const chosen = [...form.querySelectorAll("[data-slot=value]")].map((el) => el.textContent);
    expect(chosen).toEqual(["Money in (from a shipper)", "Great Lakes Supply", "", "USD"]);
  });

  it("names a single overdue shipper, with no count or controls", () => {
    state.overdue = {
      ...mockTmsOverdue,
      shippers: [mockTmsOverdue.shippers[0]],
      totals: [{ currency: mockTmsOverdue.shippers[0].currency, amount: "2320.50" }],
    };
    render(<TmsOverdueBar />);
    expect(bar()).toHaveTextContent(
      "Payment overdue in the TMS: Prairie Agri Inc. owes CAD 2,320.50 on 1 invoice, the oldest 66 days past due."
    );
    expect(screen.queryByRole("button", { name: "View All" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clear payment for Prairie Agri Inc." })
    ).toBeInTheDocument();
  });

  it("hides Clear Payment from those who can't record payments, but still lists", async () => {
    state.canRecord = false;
    render(<TmsOverdueBar />);
    expect(screen.queryByRole("button", { name: /Clear payment/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View All" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Clear Payment" })).not.toBeInTheDocument();
  });

  it("shows nothing when no one is overdue, and goes away when dismissed", async () => {
    state.overdue = { shippers: [], totals: [], oldestOverdueDays: 0 };
    const { unmount } = render(<TmsOverdueBar />);
    expect(screen.queryByRole("region", { name: "Overdue payments" })).not.toBeInTheDocument();
    unmount();

    state.overdue = null;
    render(<TmsOverdueBar />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("region", { name: "Overdue payments" })).not.toBeInTheDocument();
  });
});
