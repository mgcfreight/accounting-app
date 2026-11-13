import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  useLocation,
  useNavigationType,
  useSearchParams,
} from "react-router";
import { useCurrentUser } from "../providers/user-provider";
import { HeaderActionProvider } from "../providers/header-action-provider";
import { HeaderDetailProvider } from "../providers/header-detail-provider";
import { Sidebar } from "../sidebar";
import Header from "../header/header";

// How long Back/Forward waits for a page to grow tall enough to scroll back
// to where it was left, before scrolling as far as it can.
const RESTORE_WAIT_MS = 5000;

// mokal-app's DashboardLayout: sidebar on the left, header and page on the
// right, on the same off-white background. `topBar` is a strip above the
// header, on every page.
export function DashboardLayout({
  children,
  topBar,
}: {
  children: ReactNode;
  topBar?: ReactNode;
}) {
  const user = useCurrentUser();
  const [collapsed, setCollapsed] = useState(true);
  const { pathname, key } = useLocation();
  const navigationType = useNavigationType();
  const id = useSearchParams()[0].get("id");
  const columnRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  // How far each history entry was scrolled, so Back to a list returns to
  // the row the user opened rather than the top. In memory only: a reload
  // starts at the top.
  const scrolled = useRef(new Map<string, { column: number; main: number }>());
  const page = useRef({ pathname, id });
  // The entry a scroll belongs to. Switched in the layout effect below, in
  // the same commit as the new page, so a scroll event the new page causes
  // (the scroll to the top, or shorter content clamping the position) is
  // never saved under the entry being left. Keyed by a closure swapped in a
  // passive effect, such an event could land first and save the list's
  // position as 0.
  const entry = useRef(key);
  const contentRef = useRef<HTMLDivElement>(null);
  // Stops a Back/Forward restore that is still waiting for its page to grow
  // tall enough; null when none is pending. While one is pending, scroll
  // events are not saved: the short placeholder clamps the position to ~0,
  // and saving that would overwrite the position being restored.
  const cancelRestore = useRef<(() => void) | null>(null);

  useEffect(() => {
    const column = columnRef.current;
    const main = mainRef.current;
    if (!column || !main) return;
    const remember = () => {
      if (cancelRestore.current) return;
      scrolled.current.set(entry.current, {
        column: column.scrollTop,
        main: main.scrollTop,
      });
    };
    column.addEventListener("scroll", remember, { passive: true });
    main.addEventListener("scroll", remember, { passive: true });
    return () => {
      column.removeEventListener("scroll", remember);
      main.removeEventListener("scroll", remember);
      cancelRestore.current?.();
    };
  }, []);

  // Scrolls back to `saved` once the page is tall enough to hold it. On Back
  // the lazy route or an uncached query first renders a short placeholder,
  // and scrolling then would land at the top. Re-checks whenever the content
  // resizes; gives up (scrolling as far as it can) after RESTORE_WAIT_MS, and
  // stops waiting as soon as the user scrolls by hand.
  const restore = (saved: { column: number; main: number }) => {
    const column = columnRef.current;
    const main = mainRef.current;
    const content = contentRef.current;
    if (!column || !main) return;
    const fits = (el: HTMLElement, top: number) =>
      el.scrollHeight - el.clientHeight >= top - 1;
    const apply = () => {
      column.scrollTo(0, saved.column);
      main.scrollTo(0, saved.main);
    };
    if (fits(column, saved.column) && fits(main, saved.main)) {
      apply();
      return;
    }

    let observer: ResizeObserver | undefined;
    const userEvents = ["wheel", "touchstart", "keydown", "pointerdown"];
    const finish = (scroll: boolean) => {
      observer?.disconnect();
      window.clearTimeout(timer);
      for (const type of userEvents) column.removeEventListener(type, onUser);
      if (scroll) apply();
      cancelRestore.current = null;
    };
    const onUser = () => finish(false);
    const check = () => {
      if (fits(column, saved.column) && fits(main, saved.main)) finish(true);
    };
    const timer = window.setTimeout(() => finish(true), RESTORE_WAIT_MS);
    for (const type of userEvents) {
      column.addEventListener(type, onUser, { passive: true });
    }
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(check);
      if (content) observer.observe(content);
      observer.observe(main);
      observer.observe(column);
    }
    cancelRestore.current = () => finish(false);
  };

  // The page scrolls inside <main>, not the window, and this layout stays
  // mounted between pages, so a new page would open as far down as the last
  // one was scrolled. Each page (or another ?id) starts at the top, before it
  // paints; Back or Forward returns to where that entry was left. A list's
  // filters and page are in the query string too, but changing those doesn't
  // move the view.
  useLayoutEffect(() => {
    entry.current = key;
    // A restore still waiting for the previous entry no longer applies.
    cancelRestore.current?.();
    const saved = scrolled.current.get(key);
    if (navigationType === "POP" && saved) {
      restore(saved);
    } else if (page.current.pathname !== pathname || page.current.id !== id) {
      columnRef.current?.scrollTo(0, 0);
      mainRef.current?.scrollTo(0, 0);
    }
    page.current = { pathname, id };
  }, [key, navigationType, pathname, id]);

  return (
    <HeaderActionProvider>
      <HeaderDetailProvider>
        {/* h-dvh, not h-screen: on a phone 100vh runs under the browser's
            toolbar and hides the bottom of the scrolling page. */}
        <div className="h-dvh flex">
          {/* From xl up the sidebar sits in this row and the page beside it
              narrows when it widens. Below xl it is a drawer over the page. */}
          <Sidebar
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            user={user}
          />
          {!collapsed && (
            <div
              aria-hidden
              className="fixed inset-0 z-99 bg-black/40 xl:hidden"
              onClick={() => setCollapsed(true)}
            />
          )}
          <div
            ref={columnRef}
            className="overflow-auto h-full flex flex-col w-full min-w-0"
          >
            {topBar}
            {/* The gap above the header, below the bar. */}
            <div aria-hidden className="h-5 shrink-0" />
            <Header user={user} onOpenSidebar={() => setCollapsed(false)} />
            <main
              ref={mainRef}
              className="bg-[#FAFEFF] flex-1 xl:rounded-bl-lg overflow-auto"
            >
              <div
                ref={contentRef}
                className="relative p-4 sm:p-6 w-full min-h-full"
              >
                {children}
              </div>
            </main>
          </div>
        </div>
      </HeaderDetailProvider>
    </HeaderActionProvider>
  );
}
