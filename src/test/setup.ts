import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only cleans up on its own when test globals are on; they
// aren't here (tests import from "vitest"), so unmount after every test.
afterEach(() => {
  cleanup();
});
