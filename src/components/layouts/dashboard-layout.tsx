import { ReactNode, useState } from "react";
import { useCurrentUser } from "../providers/user-provider";
import { HeaderActionProvider } from "../providers/header-action-provider";
import { Sidebar } from "../sidebar";
import Header from "../header/header";

// mokal-app's DashboardLayout: sidebar on the left, header and page on the
// right, on the same off-white background.
export function DashboardLayout({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const [collapsed, setCollapsed] = useState(true);

  return (
    <HeaderActionProvider>
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
        <div className="overflow-auto h-full flex flex-col w-full min-w-0 pt-5">
          <Header user={user} onOpenSidebar={() => setCollapsed(false)} />
          <main className="bg-[#FAFEFF] flex-1 xl:rounded-bl-lg overflow-auto">
            <div className="relative p-4 sm:p-6 w-full h-full">{children}</div>
          </main>
        </div>
      </div>
    </HeaderActionProvider>
  );
}
