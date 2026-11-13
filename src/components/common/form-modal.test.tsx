import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FormModal from "./form-modal";

const renderModal = (isDirty: boolean, onOpenChange = vi.fn()) => {
  render(
    <FormModal
      isOpen
      onOpenChange={onOpenChange}
      title="Enter Carrier Bill"
      onConfirm={vi.fn()}
      isDirty={isDirty}
    >
      <input aria-label="Bill number" />
    </FormModal>
  );
  return onOpenChange;
};

describe("FormModal, unsaved edits", () => {
  it("closes straight away on Cancel when nothing was typed", async () => {
    const onOpenChange = renderModal(false);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Discard changes?")).toBeNull();
  });

  it("asks before Esc throws away typed data, and Keep Editing keeps it open", async () => {
    const onOpenChange = renderModal(true);
    await userEvent.click(screen.getByRole("textbox", { name: "Bill number" }));
    await userEvent.keyboard("{Escape}");

    expect(await screen.findByText("Discard changes?")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Keep Editing" }));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes the form once Discard is chosen", async () => {
    const onOpenChange = renderModal(true);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
