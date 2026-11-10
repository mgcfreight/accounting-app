import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  clearListReturnHrefs,
  limitParam,
  listReturnHref,
  oneOf,
  pageParam,
  searchParam,
  useListUrlState,
  useSyncListUrl,
} from "./use-list-url-state";

const schema = z.object({
  search: searchParam(5),
  status: oneOf(["ALL", "PAID"], "ALL"),
  page: pageParam,
  limit: limitParam(),
});
const DEFAULTS = { search: "", status: "ALL", page: "1", limit: "10" };

function List() {
  const fromUrl = useListUrlState(schema);
  const [status, setStatus] = useState(fromUrl.status);
  const [page, setPage] = useState(fromUrl.page);
  useSyncListUrl({ ...fromUrl, status, page }, DEFAULTS);
  return (
    <>
      <p>{JSON.stringify(fromUrl)}</p>
      <button type="button" onClick={() => setStatus("PAID")}>
        Paid
      </button>
      <button type="button" onClick={() => setPage("3")}>
        Page 3
      </button>
      <button type="button" onClick={() => setStatus("ALL")}>
        All
      </button>
    </>
  );
}

const open = (url: string) => {
  const router = createMemoryRouter([{ path: "/list/", element: <List /> }], {
    initialEntries: [url],
  });
  render(<RouterProvider router={router} />);
  return router;
};

describe("useListUrlState", () => {
  it("reads the list's values from the URL", () => {
    open("/list/?search=abc&status=PAID&page=4&limit=20");
    expect(screen.getByText(/"status"/).textContent).toBe(
      JSON.stringify({ search: "abc", status: "PAID", page: "4", limit: "20" })
    );
  });

  it("falls back to the default for a value the list doesn't offer", () => {
    open("/list/?search=abcdefgh&status=<script>&page=-3&limit=999");
    expect(screen.getByText(/"status"/).textContent).toBe(
      JSON.stringify({ search: "abcde", status: "ALL", page: "1", limit: "10" })
    );
  });

  it("uses the defaults when the URL has none", () => {
    open("/list/");
    expect(screen.getByText(/"status"/).textContent).toBe(
      JSON.stringify(DEFAULTS)
    );
  });
});

describe("useSyncListUrl", () => {
  it("writes changed values, replacing the history entry", async () => {
    const router = open("/list/");
    await userEvent.click(screen.getByRole("button", { name: "Paid" }));
    await userEvent.click(screen.getByRole("button", { name: "Page 3" }));

    expect(router.state.location.search).toBe("?status=PAID&page=3");
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("leaves default values out of the URL", async () => {
    const router = open("/list/?status=PAID");
    await userEvent.click(screen.getByRole("button", { name: "All" }));

    expect(router.state.location.search).toBe("");
  });

  it("doesn't write to another page's URL", async () => {
    const router = open("/list/?status=PAID");
    await act(() => router.navigate("/other/?id=1"));

    expect(router.state.location.pathname).toBe("/other/");
    expect(router.state.location.search).toBe("?id=1");
  });
});

describe("listReturnHref", () => {
  it("returns the list as it was left, until cleared at sign-out", async () => {
    open("/list/");
    await userEvent.click(screen.getByRole("button", { name: "Paid" }));
    expect(listReturnHref("/list/")).toBe("/list/?status=PAID");

    clearListReturnHrefs();
    expect(listReturnHref("/list/")).toBe("/list/");
  });
});
