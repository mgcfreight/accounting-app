import { Link, useLocation, useSearchParams } from "react-router";
import { Me } from "@/lib/interfaces";
import { getRouteConfig, headerButtonFor } from "@/lib/routes.config";
import BaseButton from "../common/base-button";
import { ArrowLeft, CreateNewButtonIcon, HamburgerIcon } from "../icons";
import { useTriggerHeaderAction } from "../providers/header-action-provider";
import DropdownProfile from "./dropdown-profile";

// mokal-app's Header: the page title from routes.config, a back arrow on
// detail pages, an optional "create new" button, and the profile menu.
export default function Header({
  onOpenSidebar,
  user,
}: {
  onOpenSidebar: () => void;
  user: Me;
}) {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const triggerAction = useTriggerHeaderAction();
  const route = getRouteConfig(pathname);
  const button = headerButtonFor(pathname, user);
  const id = searchParams.get("id");

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
              <Link to={route.previousRoute} aria-label="Back">
                <ArrowLeft />
              </Link>
            )}
            <span>
              {route?.includeIdInHeader && id
                ? `${route.header} #${id}`
                : route?.header}
            </span>
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
