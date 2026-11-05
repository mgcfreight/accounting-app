import { useEffect, useRef } from "react";
import { useBlocker } from "react-router";

// While `when` is true, leaving the page asks first: a link or Back inside
// the app is held until the user answers (`blocked`, then `stay` or `leave`),
// and closing or reloading the tab gets the browser's own prompt. A change of
// search params alone (a filter, ?id=) isn't leaving.
//
// `allowLeave` lets the next navigation through unasked — call it before
// navigating away after a save, which happens before the form re-renders as
// clean. A router supports one blocker at a time, so use this once per page.
export default function useUnsavedChanges(when: boolean) {
  const allow = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when &&
      !allow.current &&
      currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (!when) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [when]);

  return {
    blocked: blocker.state === "blocked",
    stay: () => blocker.reset?.(),
    leave: () => blocker.proceed?.(),
    allowLeave: () => {
      allow.current = true;
    },
  };
}
