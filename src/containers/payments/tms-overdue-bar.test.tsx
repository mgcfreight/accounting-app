import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
}));

vi.mock("@/components/providers/user-provider", () => ({
  useCan: () => ({
    can: (permission: Permission) =>
      permission === Permission.CustomerPaymentsView
        ? state.canView
        : permission === Permission.CustomerPaymentsCreate && state.canRecord,
  }),
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
    state.canView = true;
    state.canRecord = true;
    state.overdue = null;
  });

  it("labels its figures as demo data before anything else", async () => {
    render(<TmsOverdueBar />);
    expect(bar()).toHaveTextContent(/^Demo data · Payment overdue in the TMS/);
    await userEvent.click(screen.getByRole("button", { name: "View All" }));
    expect(
      await screen.findByRole("dialog", { name: "Overdue Payments in the TMS (Demo Data)" })
    ).toBeInTheDocument();
  });

  it("shows nothing to those who can't view customer payments", () => {
    state.canView = false;
    render(<TmsOverdueBar />);
    expect(screen.queryByRole("region", { name: "Overdue payments" })).not.toBeInTheDocument();
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
    render(<TmsOverdueBar />);
    await userEvent.click(screen.getByRole("button", { name: "View All" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Total overdue: CAD 5,137.39 · USD 1,475.00");
    const rows = within(dialog).getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    expect(rows[3]).toHaveTextContent("Zero Balance Ltd.");
  });

  it("opens a demo Record Payment for the chosen shipper in their currency", async () => {
    render(<TmsOverdueBar />);
    await userEvent.click(screen.getByRole("button", { name: "View All" }));
    const rows = within(await screen.findByRole("dialog")).getAllByRole("listitem");
    await userEvent.click(within(rows[1]).getByRole("button", { name: "Clear Payment" }));

    // Filled in for the shipper, and saves nothing: its ids are mock ones.
    const form = await screen.findByRole("dialog", { name: "Record Payment (Demo Data)" });
    const fields = Object.fromEntries(
      [...form.querySelectorAll("dt")].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent])
    );
    expect(fields).toEqual({
      Direction: "Money in (from a shipper)",
      Shipper: "Great Lakes Supply",
      Currency: "USD",
      Overdue: "USD 1,475.00",
    });
    expect(form).toHaveTextContent("nothing is recorded from this bar");
  });

  it("names a single overdue shipper, with no count or controls", () => {
    state.overdue = {
      ...mockTmsOverdue,
      shippers: [mockTmsOverdue.shippers[0]],
      totals: [{ currency: mockTmsOverdue.shippers[0].currency, amount: "2320.50" }],
    };
    render(<TmsOverdueBar />);
    expect(bar()).toHaveTextContent(
      "Demo data · Payment overdue in the TMS: Prairie Agri Inc. owes CAD 2,320.50 on 1 invoice, the oldest 66 days past due."
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
