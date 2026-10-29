import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { useNavigate } from "react-router";
import { useEffect, useRef, useState } from "react";
import { ACCOUNT_PATH, LOGIN_PATH } from "@/lib/constants";
import { Me } from "@/lib/interfaces";
import { canAccessRoute } from "@/lib/routes.config";
import { createInitials, fullName } from "@/lib/utils";
import { DownArrowSm, Logout, Setting2, User as UserIcon } from "../icons";
import { useUser } from "../providers/user-provider";

// mokal-app's DropdownProfile: initials, name and role, opening on hover as
// well as click (click keeps it usable on touch).
export default function DropdownProfile({ user }: { user: Me }) {
  const navigate = useNavigate();
  const { signOut } = useUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveringTrigger = useRef(false);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openMenu = () => {
    cancelClose();
    setIsMenuOpen(true);
  };
  // The popover sits a few pixels below the trigger, so closing waits long
  // enough for the pointer to cross the gap.
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setIsMenuOpen(false), 150);
  };

  useEffect(() => cancelClose, []);

  return (
    <Dropdown
      isOpen={isMenuOpen}
      onOpenChange={(open) => {
        if (!open && isHoveringTrigger.current) return;
        cancelClose();
        setIsMenuOpen(open);
      }}
    >
      <DropdownTrigger>
        <div
          role="button"
          // HeroUI handles Enter and Space on the trigger but treats it as a
          // native button and adds no tabIndex, so without one Tab skips it.
          tabIndex={0}
          aria-label={`Account menu for ${fullName(user)}`}
          className="flex items-center cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-base-primary"
          onMouseEnter={() => {
            isHoveringTrigger.current = true;
            openMenu();
          }}
          onMouseLeave={() => {
            isHoveringTrigger.current = false;
            scheduleClose();
          }}
        >
          <div className="ml-6 lg:ml-10 mr-2 w-8 h-8 rounded-full bg-[#71717a] flex items-center justify-center">
            <span className="text-white text-xs">
              {createInitials(fullName(user))}
            </span>
          </div>
          <div className="hidden sm:block mr-2">
            <h2 className="text-sm font-bold text-base-primary">{fullName(user)}</h2>
            <p className="text-xs font-semibold">{user.role.name}</p>
          </div>
          <div className="hidden sm:block">
            <DownArrowSm />
          </div>
        </div>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Profile actions"
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
      >
        <DropdownItem key="profile" isReadOnly className="opacity-100">
          <div className="flex justify-center items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-[#71717a] flex items-center justify-center">
              <span className="text-white text-2xl">
                {createInitials(fullName(user))}
              </span>
            </div>
            <div>
              <p className="text-xl">{fullName(user)}</p>
              <p className="text-sm opacity-70">{user.email}</p>
            </div>
          </div>
        </DropdownItem>
        <DropdownItem
          key="account"
          startContent={
            // The icon is drawn white and 20px for the dark sidebar; here it
            // matches the Settings and Log Out icons: 24px, grey, a 1.5px line
            // (1.25 on its 20-unit grid).
            <span className="flex [&_path]:stroke-[#3F3F46]">
              <UserIcon width={24} height={24} strokeWidth={1.25} />
            </span>
          }
          onPress={() => navigate(ACCOUNT_PATH)}
        >
          My Account
        </DropdownItem>
        {canAccessRoute("/settings/", user) ? (
          <DropdownItem
            key="settings"
            startContent={<Setting2 />}
            onPress={() => navigate("/settings/")}
          >
            Settings
          </DropdownItem>
        ) : null}
        <DropdownItem
          key="logout"
          startContent={<Logout />}
          onPress={async () => {
            await signOut();
            navigate(LOGIN_PATH);
          }}
        >
          Log Out
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
