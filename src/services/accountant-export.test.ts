import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./api-client";
import { exportAccountantCsv } from "./reports";

describe("exportAccountantCsv", () => {
  afterEach(() => vi.restoreAllMocks());

  it("asks the API for the period's CSV as a file", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({
      data: new Blob(["a,b"]),
      headers: {},
    });

    const file = await exportAccountantCsv({
      period: "2026-10",
      fileName: "accountant-export-2026-10.csv",
    });

    expect(get).toHaveBeenCalledWith(
      "/report/accountant/export",
      expect.objectContaining({
        params: { period: "2026-10" },
        responseType: "blob",
      })
    );
    // No Content-Disposition: the screen's name is used.
    expect(file.fileName).toBe("accountant-export-2026-10.csv");
  });

  it("prefers the name the API sends", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: new Blob(["a,b"]),
      headers: {
        "content-disposition": "attachment; filename=\"mgc-2026-10.csv\"",
      },
    });

    const file = await exportAccountantCsv({
      period: "2026-10",
      fileName: "accountant-export-2026-10.csv",
    });
    expect(file.fileName).toBe("mgc-2026-10.csv");
  });
});
