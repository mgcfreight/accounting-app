// Shared presentation for the register-based fields (the login form), so the
// text and password variants cannot drift apart. Copied from mokal-app, where
// the reasoning is written up in full: the geometry mirrors HeroUI's bordered
// Input, and the label is pinned inside the top of the field rather than
// floated, so a value the browser autofills can never sit under the label.

export const fieldWrapperClass = "relative w-full";

export const fieldInputClass = (hasError: boolean) =>
  [
    "h-14 w-full rounded-medium border-medium bg-transparent",
    "px-3 pb-2 pt-7 text-xs text-layout-foreground",
    "outline-none transition-colors placeholder:text-base-gray",
    hasError
      ? "border-base-danger focus:border-base-danger"
      : "border-base-default hover:border-base-gray focus:border-base-primary",
  ].join(" ");

// `leading-none` so the 10px label occupies exactly its own height.
export const fieldLabelClass = (hasError: boolean) =>
  [
    "pointer-events-none absolute left-3 top-2.5 z-10",
    "text-[0.625rem] leading-none",
    hasError ? "text-base-danger" : "text-base-primary",
  ].join(" ");

export const fieldErrorClass = "mt-1 text-xs text-base-danger";
