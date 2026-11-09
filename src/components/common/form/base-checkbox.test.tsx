import { CheckboxGroup } from "@heroui/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BaseCheckbox from "./base-checkbox";

describe("BaseCheckbox", () => {
  it("toggles on its own", async () => {
    const onValueChange = vi.fn();
    render(<BaseCheckbox onValueChange={onValueChange}>Show ended rates</BaseCheckbox>);

    await userEvent.click(screen.getByRole("checkbox", { name: "Show ended rates" }));

    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it("joins a CheckboxGroup's value", async () => {
    const onValueChange = vi.fn();
    render(
      <CheckboxGroup aria-label="Documents" defaultValue={["bol"]} onValueChange={onValueChange}>
        <BaseCheckbox value="bol">BOL</BaseCheckbox>
        <BaseCheckbox value="pod">POD</BaseCheckbox>
      </CheckboxGroup>
    );

    expect((screen.getByRole("checkbox", { name: "BOL" }) as HTMLInputElement).checked).toBe(true);
    await userEvent.click(screen.getByRole("checkbox", { name: "POD" }));

    expect(onValueChange).toHaveBeenCalledWith(["bol", "pod"]);
  });
});
