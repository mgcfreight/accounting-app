import "@fontsource/lato/100.css";
import "@fontsource/lato/300.css";
import "@fontsource/lato/400.css";
import "@fontsource/lato/700.css";
import "@fontsource/lato/900.css";
import "./app/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/app";

// Pages load as separate chunks (app/routes.tsx). If one fails to download, most
// often because the app was left open across a deploy and the old hashed
// files are gone, reload once to pick up the new build. React.lazy remembers
// a failed import, so the page's "Try again" alone would never recover. A
// second failure within a minute is let through to the error boundary rather
// than reloading in a loop.
const RELOADED_AT = "mgc:chunk-reload-at";
window.addEventListener("vite:preloadError", (event) => {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT));
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
