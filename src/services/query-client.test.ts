import { onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { queryClient } from "./query-client";

// FormModal can't be closed while a save is pending, so an offline save must
// fail rather than pause and wait for the connection.
describe("queryClient mutations", () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it("run and fail at once when the browser is offline", async () => {
    onlineManager.setOnline(false);
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: () => Promise.reject(new Error("Network Error")),
    });

    await expect(mutation.execute(undefined)).rejects.toThrow("Network Error");
    expect(mutation.state.status).toBe("error");
    expect(mutation.state.isPaused).toBe(false);
  });
});
