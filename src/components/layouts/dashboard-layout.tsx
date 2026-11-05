import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { useCurrentUser } from "../providers/user-provider";
import { HeaderActionProvider } from "../providers/header-action-provider";
import { HeaderDetailProvider } from "../providers/header-detail-provider";
import { Sidebar } from "../sidebar";
import Header from "../header/header";

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
  const { pathname } = useLocation();
  const id = useSearchParams()[0].get("id");
  const columnRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // The page scrolls inside <main>, not the window, and this layout stays
  // mounted between pages, so a new page would open as far down as the last
  // one was scrolled. Each page (or another ?id) starts at the top, before it
  // paints. A list's filters and page are in the query string too, but
  // changing those doesn't move the view.
  useLayoutEffect(() => {
    columnRef.current?.scrollTo(0, 0);
    mainRef.current?.scrollTo(0, 0);
  }, [pathname, id]);

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
              <div className="relative p-4 sm:p-6 w-full min-h-full">{children}</div>
            </main>
          </div>
        </div>
      </HeaderDetailProvider>
    </HeaderActionProvider>
  );
}
