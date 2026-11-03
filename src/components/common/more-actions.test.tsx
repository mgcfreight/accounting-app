import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MoreActions from "./more-actions";

const actions = (onVoid = vi.fn()) => [
  { key: "dispute", label: "Flag as disputed", onPress: vi.fn() },
  { key: "void", label: "Void (load cancelled)", danger: true, onPress: onVoid },
];

const trigger = () => screen.getByRole("button", { name: "More" });

describe("MoreActions", () => {
  it("opens on hover without moving focus", () => {
    render(<MoreActions actions={actions()} />);
    fireEvent.mouseEnter(trigger().parentElement!);

    expect(screen.getByRole("button", { name: "Flag as disputed" })).toBeTruthy();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(document.body);
  });

  it("stays open when clicked after hovering", async () => {
    render(<MoreActions actions={actions()} />);
    await userEvent.hover(trigger());
    await userEvent.click(trigger());

    expect(trigger().getAttribute("aria-expanded")).toBe("true");
  });

  it("runs the chosen action and closes", async () => {
    const onVoid = vi.fn();
    render(<MoreActions actions={actions(onVoid)} />);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("button", { name: "Void (load cancelled)" }));

    expect(onVoid).toHaveBeenCalledOnce();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on Escape and returns focus to the button", async () => {
    render(<MoreActions actions={actions()} />);
    await userEvent.click(trigger());
    await userEvent.keyboard("{Escape}");

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger());
  });

  it("shows nothing without actions", () => {
    const { container } = render(<MoreActions actions={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
