import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Unit and component tests (`npm run test:unit`). Reuses vite.config.ts, so
// the `@/` alias, React and SVG imports work the same as in the app. Tests
// sit next to the code they cover as `*.test.ts(x)` and run in jsdom.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["./src/test/setup.ts"],
      // No test may depend on another's mocks or timers.
      restoreMocks: true,
      unstubEnvs: true,
      unstubGlobals: true,
    },
  })
);
