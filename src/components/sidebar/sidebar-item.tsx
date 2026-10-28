import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { MenuItem } from "@/lib/navigation";
import { DownArrowSm } from "../icons";

// Compared without the trailing slash: the links carry one, but the address
// bar may not.
const normalize = (path: string) => path.replace(/\/+$/, "") || "/";

export const isRouteActive = (route: string, pathname: string) => {
  const target = normalize(route);
  const current = normalize(pathname);
  return current === target || current.startsWith(`${target}/`);
};

export const isItemActive = (item: MenuItem, pathname: string): boolean =>
  isRouteActive(item.route, pathname) ||
  !!item.children?.some((child) => isItemActive(child, pathname));

// mokal-app's SidebarItem: a rounded row that expands to show its children.
export default function SidebarItem({
  item,
  icon,
  collapsed,
  openGroup,
  setOpenGroup,
  onNavigate,
}: {
  item: MenuItem;
  icon: ReactNode;
  collapsed: boolean;
  openGroup: string;
  setOpenGroup: (group: string) => void;
  onNavigate: () => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = isItemActive(item, pathname);
  const groupKey = item.label.toLowerCase();
  const isOpen = openGroup === groupKey;
  // The longest matching child wins, so /users/sessions/ marks "Sessions"
  // and not also "Users" (/users/).
  const activeChild = item.children
    ?.filter((child) => isRouteActive(child.route, pathname))
    .sort((a, b) => b.route.length - a.route.length)[0];

  const handleClick = () => {
    setOpenGroup(isOpen ? "" : groupKey);
    if (!item.children) {
      navigate(item.route);
      onNavigate();
    }
  };

  return (
    <li
      className={`hover:bg-[#304573] overflow-hidden ${
        collapsed ? "w-0 xl:w-[3.5rem]" : "w-[13rem]"
      } rounded-2xl ${active ? "bg-[#304573]" : ""}`}
    >
      <button
        type="button"
        onClick={handleClick}
        className={`${
          active ? "border-t-1 border-white" : ""
        } group relative h-14 w-full flex items-center gap-2 rounded-2xl px-4 py-2 text-xs text-white uppercase duration-300 ease-in-out hover:bg-[#304573] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2`}
        aria-expanded={item.children ? isOpen : undefined}
        aria-current={!item.children && active ? "page" : undefined}
      >
        {icon}
        {!collapsed && item.label}
        {item.children && !collapsed && (
          <DownArrowSm
            className={`svg-white absolute right-4 top-1/2 -translate-y-1/2 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {item.children && !collapsed && isOpen && (
        <ul className="mt-3 flex flex-col py-4 gap-1 border-t-1 border-b-1 border-white rounded-2xl text-xs">
          {item.children.map((child) => (
            <li key={child.route}>
              <Link
                to={child.route}
                onClick={onNavigate}
                aria-current={child === activeChild ? "page" : undefined}
                className={`pl-6 py-2 uppercase group relative flex items-center font-medium duration-300 ease-in-out hover:bg-[#304573] focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2 ${
                  child === activeChild
                    ? "border-l-3 border-base-primary-50 text-base-primary-50"
                    : "text-white rounded-md"
                }`}
              >
                {child.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
