import { FocusEvent, Fragment, ReactNode, useEffect, useRef } from "react";
import {
  LuBuilding2,
  LuChartColumn,
  LuFileText,
  LuLayoutDashboard,
  LuLogOut,
  LuPackage,
  LuPin,
  LuPinOff,
  LuReceipt,
  LuRefreshCw,
  LuSettings,
  LuTruck,
  LuUsers,
  LuWallet,
  LuX,
} from "react-icons/lu";
import { useLocation, useNavigate } from "react-router";
import { useLocalStorage, useMediaQuery } from "@/hooks";
import { LOGIN_PATH } from "@/lib/constants";
import { Me } from "@/lib/interfaces";
import { menuForUser, MenuIconName } from "@/lib/navigation";
import { useUser } from "../providers/user-provider";
import SidebarItem, { isItemActive } from "./sidebar-item";

// One icon per entry, so no two rows on the rail look alike.
const menuIcons: Record<MenuIconName, ReactNode> = {
  dashboard: <LuLayoutDashboard />,
  invoices: <LuReceipt />,
  payments: <LuWallet />,
  shippers: <LuBuilding2 />,
  carriers: <LuTruck />,
  shipments: <LuPackage />,
  statements: <LuFileText />,
  reports: <LuChartColumn />,
  system: <LuRefreshCw />,
  users: <LuUsers />,
  settings: <LuSettings />,
};

// Below Tailwind's `xl` (small laptops, tablets, phones) the sidebar is a
// drawer, hidden until the header's menu button opens it. Must match the `xl`
// classes below and in DashboardLayout and Header.
export const DRAWER_QUERY = "(max-width: 1279.98px)";

// How long the pointer must rest on the rail before it opens, so crossing it
// on the way to the page doesn't flash the menu open.
const HOVER_DELAY_MS = 150;

// From xl up: an icon rail that opens over the page on hover (no reflow), or
// stays open beside it once pinned. Below xl: a drawer. `collapsed` is
// mokal-app's `sidebarOpen`, renamed for what it means.
export default function Sidebar({
  collapsed,
  setCollapsed,
  user,
}: {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  user: Me;
}) {
  const navigate = useNavigate();
  const { signOut } = useUser();
  const [openGroup, setOpenGroup] = useLocalStorage("selectedMenu", "");
  const [pinned, setPinned] = useLocalStorage("sidebarPinned", false);
  const drawer = useMediaQuery(DRAWER_QUERY);
  const hoverTimer = useRef<number | undefined>(undefined);
  const asideRef = useRef<HTMLElement>(null);
  const items = menuForUser(user);
  const { pathname } = useLocation();

  const pinnedRail = pinned && !drawer;
  const expanded = pinnedRail || !collapsed;

  // Open the group holding the current page, so the page you are on is
  // visible in the menu without first opening its group — also when it was
  // reached from a link rather than the menu.
  const activeGroup = items
    .find((item) => item.children && isItemActive(item, pathname))
    ?.label.toLowerCase();
  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup);
  }, [activeGroup, setOpenGroup]);

  useEffect(() => {
    if (collapsed || !drawer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCollapsed(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collapsed, drawer, setCollapsed]);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  // The drawer stays open after a tap, so close it once a page is chosen.
  const closeDrawer = () => {
    if (drawer) setCollapsed(true);
  };

  // Hover only drives the unpinned wide-screen rail. In a drawer opened from
  // the header, the pointer leaving it must not close it.
  const onMouseEnter = () => {
    if (drawer || pinned) return;
    hoverTimer.current = window.setTimeout(
      () => setCollapsed(false),
      HOVER_DELAY_MS
    );
  };
  const onMouseLeave = () => {
    window.clearTimeout(hoverTimer.current);
    if (!drawer && !pinned) setCollapsed(true);
  };

  // Keyboard focus opens the unpinned rail as hover does, so its groups and
  // the pin button can be reached without a pointer. It closes once focus
  // leaves the rail, unless the pointer is still over it.
  const onFocus = () => {
    if (!drawer && !pinned) setCollapsed(false);
  };
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (drawer || pinned) return;
    if (event.currentTarget.contains(event.relatedTarget)) return;
    if (!event.currentTarget.matches(":hover")) setCollapsed(true);
  };

  const togglePin = () => {
    // Pinning: the pin keeps the rail open, so mark it collapsed underneath —
    // otherwise dropping below xl later opens the drawer unasked. Unpinning:
    // stay open only while the pointer is over the rail, not when unpinned
    // from the keyboard with the pointer elsewhere.
    setCollapsed(pinned ? !asideRef.current?.matches(":hover") : true);
    setPinned(!pinned);
  };

  return (
    <>
      {/* Holds the rail's place in the row from xl up, so the page sits
          beside it; the open-on-hover panel floats over the page instead. */}
      <div
        aria-hidden
        className={`hidden xl:block shrink-0 transition-[width] duration-300 ease-out ${
          pinned ? "w-64" : "w-18"
        }`}
      />
      <aside
        ref={asideRef}
        // `invisible` while collapsed keeps the hidden drawer's links out of
        // the tab order; the rail is visible again from xl up.
        // z-100 covers the drawer's backdrop; from xl up the rail stays below
        // HeroUI's modals and popovers (z-50) but above the page.
        className={`fixed left-0 top-0 h-full z-100 xl:z-40 flex flex-col overflow-hidden bg-linear-to-b from-base-primary to-base-primary-300 transition-[width,visibility,box-shadow] duration-300 ease-out ${
          expanded ? "w-64" : "w-0 invisible xl:w-18 xl:visible"
        } ${expanded && !pinnedRail ? "shadow-2xl shadow-base-primary-900/40" : ""}`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <div className="relative flex items-center h-20 px-4 shrink-0 border-b border-white/10">
          {/* The monogram on the rail, the full logo when open. */}
          <span
            aria-hidden
            className={`absolute left-4 size-10 grid place-items-center rounded-xl bg-white/15 text-white font-bold tracking-wide transition-opacity duration-200 ${
              expanded ? "opacity-0" : "opacity-100"
            }`}
          >
            M
          </span>
          <div
            className={`flex flex-col transition-opacity duration-200 ${
              expanded ? "opacity-100" : "opacity-0"
            }`}
          >
            <img
              src="/mokal-logo-light.png"
              alt="MGC FREIGHT"
              width={120}
              height={16}
            />
            <span className="mt-1 text-[0.625rem] font-bold tracking-[0.2em] text-base-primary-50">
              ACCOUNTS
            </span>
          </div>
          {expanded && (
            <button
              type="button"
              // A fixed label with aria-pressed, so a screen reader announces
              // "Pin menu, pressed" rather than "Unpin menu, pressed".
              aria-label={drawer ? "Close menu" : "Pin menu"}
              aria-pressed={drawer ? undefined : pinned}
              title={drawer ? undefined : "Pin menu"}
              onClick={drawer ? () => setCollapsed(true) : togglePin}
              className="ml-auto size-8 grid place-items-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-white"
            >
              {drawer ? <LuX /> : pinned ? <LuPinOff /> : <LuPin />}
            </button>
          )}
        </div>

        <nav
          aria-label="Main"
          className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden scrollbar-none [&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex flex-col gap-1">
            {items.map((item, index) => {
              const section =
                item.section && item.section !== items[index - 1]?.section
                  ? item.section
                  : undefined;
              return (
                <Fragment key={item.label}>
                  {section && (
                    // A heading when open, a divider on the rail; the same
                    // height either way so rows don't jump as it widens.
                    <li
                      aria-hidden
                      className="relative h-8 mt-2 flex items-end px-3.5 pb-1.5"
                    >
                      <span
                        className={`text-[0.6875rem] font-semibold uppercase tracking-wider text-white/50 whitespace-nowrap transition-opacity duration-200 ${
                          expanded ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        {section}
                      </span>
                      <span
                        className={`absolute left-3 right-3 top-1/2 h-px bg-white/15 transition-opacity duration-200 ${
                          expanded ? "opacity-0" : "opacity-100"
                        }`}
                      />
                    </li>
                  )}
                  <SidebarItem
                    item={item}
                    icon={item.icon ? menuIcons[item.icon] : null}
                    collapsed={!expanded}
                    openGroup={openGroup}
                    setOpenGroup={setOpenGroup}
                    onNavigate={closeDrawer}
                  />
                </Fragment>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 px-3 py-3 border-t border-white/10">
          <button
            type="button"
            className="h-11 w-full flex items-center gap-3 rounded-xl px-3.5 text-sm font-medium text-white/75 whitespace-nowrap transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2"
            // Ends the session on the API (which clears its cookies), then
            // the user here.
            onClick={async () => {
              await signOut();
              navigate(LOGIN_PATH);
            }}
          >
            <LuLogOut className="shrink-0 text-xl" />
            <span
              className={`transition-opacity duration-200 ${
                expanded ? "opacity-100" : "opacity-0"
              }`}
            >
              Sign Out
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
