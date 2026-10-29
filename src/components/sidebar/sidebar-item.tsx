import { ReactNode } from "react";
import { LuChevronDown } from "react-icons/lu";
import { Link, useLocation, useNavigate } from "react-router";
import { MenuItem } from "@/lib/navigation";

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

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2";

// A row that opens in place to show its children. The label is always
// rendered, only faded out on the icon rail, so a collapsed row still has an
// accessible name.
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
  const showChildren = !!item.children && isOpen && !collapsed;
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

  // A page's own row is the white pill; a group holding the page is tinted.
  const rowState =
    active && !item.children
      ? "bg-white text-base-primary shadow-sm"
      : active
        ? "bg-white/15 text-white"
        : "text-white/75 hover:bg-white/10 hover:text-white";

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className={`relative h-11 w-full flex items-center gap-3 rounded-xl px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-200 ${rowState} ${FOCUS_RING}`}
        aria-expanded={item.children ? isOpen : undefined}
        aria-current={!item.children && active ? "page" : undefined}
      >
        <span className="shrink-0 text-xl">{icon}</span>
        <span
          className={`flex-1 text-left transition-opacity duration-200 ${
            collapsed ? "opacity-0" : "opacity-100"
          }`}
        >
          {item.label}
        </span>
        {item.children && (
          <LuChevronDown
            aria-hidden
            className={`shrink-0 text-base transition-[rotate,opacity] duration-200 ${
              isOpen ? "rotate-180" : ""
            } ${collapsed ? "opacity-0" : "opacity-70"}`}
          />
        )}
      </button>

      {item.children && (
        // Animates open by growing the grid row from 0fr to 1fr. `inert`
        // keeps the links of a closed group out of the tab order.
        <div
          inert={!showChildren}
          className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
            showChildren
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <ul className="overflow-hidden ml-6 pl-3 border-l border-white/20 flex flex-col gap-0.5">
            {item.children.map((child) => {
              const current = child === activeChild;
              return (
                <li key={child.route} className="first:mt-1 last:mb-1">
                  <Link
                    to={child.route}
                    onClick={onNavigate}
                    aria-current={current ? "page" : undefined}
                    className={`relative flex items-center h-9 px-3 rounded-lg text-[0.8125rem] whitespace-nowrap transition-colors duration-200 ${FOCUS_RING} ${
                      current
                        ? "bg-white text-base-primary font-semibold shadow-sm"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {child.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </li>
  );
}
