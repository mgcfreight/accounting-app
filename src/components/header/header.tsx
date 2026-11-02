import { MouseEvent, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Me } from "@/lib/interfaces";
import { getRouteConfig, headerButtonFor } from "@/lib/routes.config";
import BaseButton from "../common/base-button";
import { ArrowLeft, CreateNewButtonIcon, HamburgerIcon } from "../icons";
import { useTriggerHeaderAction } from "../providers/header-action-provider";
import { useHeaderDetailValue } from "../providers/header-detail-provider";
import DropdownProfile from "./dropdown-profile";

// mokal-app's Header: the page title from routes.config (plus what a detail
// page adds, see useHeaderDetail), a back arrow on detail pages, an optional
// "create new" button, and the profile menu.
export default function Header({
  onOpenSidebar,
  user,
}: {
  onOpenSidebar: () => void;
  user: Me;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const triggerAction = useTriggerHeaderAction();
  const detail = useHeaderDetailValue();
  const route = getRouteConfig(pathname);
  const button = headerButtonFor(pathname, user);
  const title = route && detail ? `${route.header} ${detail}` : route?.header;

  // Name the browser tab after the page, so several open tabs can be told
  // apart.
  useEffect(() => {
    document.title = title ? `${title} · MGC Accounts` : "MGC Accounts";
  }, [title]);

  // The back arrow returns to the page the user came from (a shipment, a
  // shipper, another invoice), like the browser's Back. React Router numbers
  // this tab's history entries in `idx`, from 0, and a redirect replaces its
  // entry rather than adding one, so `idx` 0 means nothing in the app to go
  // back to — opened from a bookmark, a new tab or after signing in. Then,
  // and on a ctrl- or middle-click, the link opens `previousRoute`, the list.
  const goBack = (event: MouseEvent<HTMLAnchorElement>) => {
    const modified =
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey;
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (modified || idx < 1) return;
    event.preventDefault();
    void navigate(-1);
  };

  return (
    <header className="flex bg-[#FAFEFF] xl:rounded-tl-lg">
      <div className="mx-4 sm:mx-6 w-full flex items-center justify-between gap-2 border-b-2 pb-3 border-base-default">
        <div className="flex items-center min-w-0">
          <button
            type="button"
            aria-label="Open menu"
            className="xl:hidden shrink-0"
            onClick={onOpenSidebar}
          >
            <HamburgerIcon className="svg-black" />
          </button>
          {/* Wraps on narrow screens so the create button drops below the
              title instead of pushing the profile menu off the edge. */}
          <h2 className="text-base-primary ml-3 sm:ml-4 font-semibold text-lg sm:text-2xl flex flex-wrap gap-x-4 gap-y-2 items-center min-w-0">
            {route?.previousRoute && (
              <Link to={route.previousRoute} aria-label="Back" onClick={goBack}>
                <ArrowLeft />
              </Link>
            )}
            <span>{title}</span>
            {button && (
              <BaseButton
                className="rounded-full px-6 ml-1"
                startContent={<CreateNewButtonIcon />}
                text={button.text}
                onPress={() => triggerAction(button.action)}
              />
            )}
          </h2>
        </div>
        <DropdownProfile user={user} />
      </div>
    </header>
  );
}
