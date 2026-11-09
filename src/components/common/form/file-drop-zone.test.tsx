import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FileDropZone, { formatFileSize } from "./file-drop-zone";

const pdf = (name = "pod.pdf") =>
  new File(["%PDF"], name, { type: "application/pdf" });

const renderZone = (props: Partial<Parameters<typeof FileDropZone>[0]> = {}) => {
  const onSelect = vi.fn();
  const onRemove = vi.fn();
  render(
    <FileDropZone
      id="doc"
      label="File"
      file={null}
      onSelect={onSelect}
      onRemove={onRemove}
      {...props}
    />
  );
  return { onSelect, onRemove };
};

describe("FileDropZone", () => {
  it("passes a browsed file to onSelect", async () => {
    const { onSelect } = renderZone();
    const file = pdf();
    await userEvent.upload(screen.getByLabelText(/browse/i), file);
    expect(onSelect).toHaveBeenCalledWith([file]);
  });

  it("passes every dropped file to onSelect", () => {
    const { onSelect } = renderZone();
    const files = [pdf("a.pdf"), pdf("b.pdf")];
    const zone = screen.getByText(/drag a file here/i).closest("div")!;
    fireEvent.drop(zone, { dataTransfer: { files, types: ["Files"] } });
    expect(onSelect).toHaveBeenCalledWith(files);
  });

  it("shows the chosen file with its size and removes it", async () => {
    const { onRemove } = renderZone({ file: pdf() });
    expect(screen.getByText("pod.pdf")).toBeInTheDocument();
    expect(screen.getByText("4 B")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove pod.pdf" }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("announces an error and ties it to the input", () => {
    renderZone({ error: "Too big" });
    expect(screen.getByRole("alert")).toHaveTextContent("Too big");
    expect(document.getElementById("doc")).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById("doc")).toHaveAttribute(
      "aria-describedby",
      "doc-error"
    );
  });
});

describe("formatFileSize", () => {
  it("formats bytes, kilobytes and megabytes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(14.2 * 1024 * 1024)).toBe("14.2 MB");
  });
});
