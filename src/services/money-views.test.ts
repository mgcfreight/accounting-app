import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { errorMessage, readAllPages, UserFacingError } from "./api-client";
import { refreshMoneyViews } from "./query-client";

describe("refreshMoneyViews", () => {
  it("refreshes every view that shows money, the dashboard's included", () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    refreshMoneyViews(client);
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ["invoices"],
        ["payments"],
        // The dashboard, aging and party balances all live under "accounts".
        ["accounts"],
        ["statements"],
        ["report"],
        ["reminders"],
        ["write-offs"],
      ])
    );
  });
});

describe("readAllPages", () => {
  const page = (items: number[], totalPages: number) => ({
    items,
    meta: { totalPages },
  });

  it("reads every page, not just the first", async () => {
    const fetch = vi.fn(async (n: number) =>
      page(n === 1 ? [1, 2] : n === 2 ? [3] : [], 2)
    );
    expect(await readAllPages(fetch, "too many")).toEqual([1, 2, 3]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("stops with a message staff can read when there are too many", async () => {
    const fetch = vi.fn(async () => page([1], 99));
    const failed = readAllPages(fetch, "Too many to list.", 3);
    await expect(failed).rejects.toBeInstanceOf(UserFacingError);
    expect(errorMessage(await failed.catch((error) => error))).toBe(
      "Too many to list."
    );
  });
});
