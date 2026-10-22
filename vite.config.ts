import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, Plugin } from "vite";
import svgr from "vite-plugin-svgr";
import { routeConfig } from "./src/lib/routes.config";

// `vite build` writes plain HTML/JS/CSS to out/, which the Accounts API
// (NestJS) serves from the same origin. There is no server of our own in
// production. See .claude/rules/architecture.md.

const root = fileURLToPath(new URL(".", import.meta.url));
const outDir = resolve(root, "out");

// Every path the router serves (src/app/app.tsx). routes.config.ts already
// lists each screen for the header, so it is the source; the signed-out
// screens have no header and are listed here.
const routePaths = () => [
  "login",
  "forgot-password",
  "reset-password",
  ...Object.entries(routeConfig).flatMap(([path, config]) => [
    path,
    ...Object.keys(config.childRoutes ?? {}).map((child) => `${path}/${child}`),
  ]),
];

// The API serves out/ as plain files, with no fallback to index.html. Writing
// the app shell to <route>/index.html keeps /shipper-invoices/ and a refresh
// on it working without changing the API. 404.html is the shell too; the router shows the not-found screen.
function routeHtmlCopies(): Plugin {
  return {
    name: "route-html-copies",
    apply: "build",
    closeBundle() {
      const shell = resolve(outDir, "index.html");
      for (const path of routePaths()) {
        const dir = resolve(outDir, path);
        mkdirSync(dir, { recursive: true });
        copyFileSync(shell, resolve(dir, "index.html"));
      }
      copyFileSync(shell, resolve(outDir, "404.html"));
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    // Every *.svg import is a React component. For an SVG as a plain URL,
    // put it in public/ and reference it by path.
    svgr({ include: "**/*.svg" }),
    routeHtmlCopies(),
  ],
  resolve: {
    alias: { "@": resolve(root, "src") },
  },
  server: { port: 3001, strictPort: true },
  preview: { port: 3001, strictPort: true },
  build: { outDir, emptyOutDir: true },
});
