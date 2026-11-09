import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markChunkLoadError } from "@/lib/chunk-error";
import ErrorBoundary from "./error-boundary";

function Throws({ error }: { error: Error }): never {
  throw error;
}

describe("ErrorBoundary", () => {
  const reload = vi.fn();

  beforeEach(() => {
    // React logs every caught error; keep the test output readable.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("location", { ...window.location, reload });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    reload.mockReset();
  });

  it("offers Try again for an ordinary render error", () => {
    render(
      <ErrorBoundary>
        <Throws error={new Error("boom")} />
      </ErrorBoundary>
    );

    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reload page" })).toBeNull();
  });

  it("offers Reload page for a chunk that failed to download", async () => {
    const error = new TypeError("Failed to fetch dynamically imported module");
    markChunkLoadError(error);

    render(
      <ErrorBoundary>
        <Throws error={error} />
      </ErrorBoundary>
    );

    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Reload page" }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not treat an unmarked error with the same message as a chunk error", () => {
    render(
      <ErrorBoundary>
        <Throws
          error={new TypeError("Failed to fetch dynamically imported module")}
        />
      </ErrorBoundary>
    );

    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("keeps a custom fallback for a chunk error", () => {
    const error = new Error("chunk");
    markChunkLoadError(error);

    render(
      <ErrorBoundary fallback={<p>custom</p>}>
        <Throws error={error} />
      </ErrorBoundary>
    );

    expect(screen.getByText("custom")).toBeTruthy();
  });
});
