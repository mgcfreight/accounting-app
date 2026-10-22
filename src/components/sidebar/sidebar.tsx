import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router";
import { useLocalStorage } from "@/hooks";
import { LOGIN_PATH } from "@/lib/constants";
import { UserRole } from "@/lib/enums";
import { menuForRole, MenuIconName } from "@/lib/navigation";
import {
  CarrrierTruck,
  CashIcon,
  DashboardIcon,
  HamburgerIcon,
  ReciptItemSm,
  ReportingIcon,
  RoundedCrossIcon,
  SettingsIcon,
  SignoutIcon,
  TrackingIcon,
  User,
} from "../icons";
import { useUser } from "../providers/user-provider";
import SidebarItem from "./sidebar-item";

const menuIcons: Record<MenuIconName, ReactNode> = {
  dashboard: <DashboardIcon />,
  invoices: <ReciptItemSm />,
  payments: <CashIcon className="svg-white" />,
  shippers: <User />,
  carriers: <CarrrierTruck />,
  reports: <ReportingIcon />,
  system: <TrackingIcon />,
  settings: <SettingsIcon />,
};

// Below Tailwind's `xl` (small laptops, tablets, phones) the sidebar is a
// drawer, hidden until the header's menu button opens it. Must match the `xl`
// classes below and in DashboardLayout and Header.
export const DRAWER_QUERY = "(max-width: 1279.98px)";

const isDrawer = () => window.matchMedia(DRAWER_QUERY).matches;

// mokal-app's sidebar: blue gradient, icons only until hovered, groups that
// open in place. `collapsed` is mokal-app's `sidebarOpen`, renamed for what it
// means. From xl up it is `static`, so when it widens it pushes the page
// aside rather than covering it; below xl it is a `fixed` drawer.
export default function Sidebar({
  collapsed,
  setCollapsed,
  userRole,
}: {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  userRole: UserRole;
}) {
  const navigate = useNavigate();
  const { signOut } = useUser();
  const [openGroup, setOpenGroup] = useLocalStorage("selectedMenu", "");
  const items = menuForRole(userRole);

  useEffect(() => {
    if (collapsed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isDrawer()) setCollapsed(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collapsed, setCollapsed]);

  // The drawer stays open after a tap, so close it once a page is chosen.
  const closeDrawer = () => {
    if (isDrawer()) setCollapsed(true);
  };

  return (
    <aside
      // `invisible` while collapsed keeps the hidden drawer's links out of
      // the tab order; the rail is visible again from xl up.
      className={`fixed xl:static left-0 top-0 h-full shrink-0 flex flex-col overflow-hidden bg-linear-to-b from-base-primary to-[#4562A0] transition-[width,visibility] duration-300 ease-linear z-100 ${
        collapsed ? "w-0 invisible xl:w-24 xl:visible" : "w-60"
      }`}
      // Hover only drives the wide-screen rail. In a drawer opened from the
      // header, the pointer leaving it must not close it.
      onMouseEnter={() => !isDrawer() && setCollapsed(false)}
      onMouseLeave={() => !isDrawer() && setCollapsed(true)}
    >
      <div className="flex items-center gap-8 h-22 px-3 shrink-0">
        <button
          type="button"
          aria-label="Toggle menu"
          className="hidden xl:block ml-3"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed && <HamburgerIcon />}
        </button>
        {!collapsed && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setCollapsed(true)}
            className="block xl:hidden"
          >
            <RoundedCrossIcon />
          </button>
        )}
        {!collapsed && (
          <div className="flex flex-col">
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
        )}
      </div>
      <div className="px-3 overflow-y-auto overflow-x-hidden scrollbar-none [&::-webkit-scrollbar]:hidden">
        <ul className="mb-6 flex flex-col gap-3">
          {items.map((item) => (
            <SidebarItem
              key={item.label}
              item={item}
              icon={item.icon ? menuIcons[item.icon] : null}
              collapsed={collapsed}
              openGroup={openGroup}
              setOpenGroup={setOpenGroup}
              onNavigate={closeDrawer}
            />
          ))}
          <li>
            <button
              type="button"
              className="rounded-2xl group relative h-14 flex items-center gap-2 px-4 py-2 text-xs text-white uppercase duration-300 ease-in-out hover:bg-[#304573] w-40 whitespace-nowrap"
              // Clears the user; with the API this will also call signOut().
              onClick={() => {
                signOut();
                navigate(LOGIN_PATH);
              }}
            >
              <SignoutIcon />
              {!collapsed && "Sign Out"}
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}
